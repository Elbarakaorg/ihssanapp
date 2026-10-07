-- Admin-managed care locations (pharmacies, clinics, hospitals, laboratories) and the public map feed.
-- Extends the existing care_providers directory; doctors come from verified clinician_practice_locations.

alter table public.care_providers drop constraint care_providers_kind_check;
alter table public.care_providers
  add constraint care_providers_kind_check check (kind in ('doctor', 'pharmacy', 'clinic', 'hospital', 'laboratory'));

alter table public.care_providers
  add column duty text not null default 'none' check (duty in ('none', 'day', 'night', '24h')),
  add column duty_until timestamptz,
  add column is_emergency boolean not null default false,
  add column website text check (website is null or (website ~* '^https://' and char_length(website) <= 300)),
  add column notes text check (notes is null or char_length(notes) <= 300),
  add constraint care_providers_duty_expiry check (duty in ('none', '24h') or duty_until is not null);

create index care_providers_geo_idx on public.care_providers (latitude, longitude) where status = 'verified';
create index care_providers_admin_idx on public.care_providers (kind, status, lower(name));

create trigger care_providers_set_updated_at
  before update on public.care_providers
  for each row execute function public.set_updated_at();

create trigger care_providers_audit
  after insert or update or delete on public.care_providers
  for each row execute function public.audit_admin_change();

create policy "provider_reviewers_delete_unpublished"
  on public.care_providers for delete to authenticated
  using ((select public.has_ihssan_permission('providers.verify')) and status <> 'verified');
grant delete on public.care_providers to authenticated;

-- Public feed -------------------------------------------------------------------------------------------------------
create function public.list_map_locations(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 15,
  p_limit integer default 800
)
returns table (
  id text, source text, kind text, name text, subtitle text, address text, city text, phone text, hours text, website text,
  duty text, is_emergency boolean, clinician_id uuid, latitude double precision, longitude double precision, distance_km double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  radius double precision := least(greatest(coalesce(p_radius_km, 15), 0.5), 150);
  lat_pad double precision;
  lng_pad double precision;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid position';
  end if;
  lat_pad := radius / 111.32;
  lng_pad := radius / (111.32 * greatest(cos(radians(p_lat)), 0.01));

  return query
  with candidates as (
    select 'p:' || c.id::text as id, 'provider'::text as source, c.kind, c.name,
           case c.kind when 'pharmacy' then 'Pharmacy' when 'clinic' then 'Clinic' when 'hospital' then 'Hospital' when 'laboratory' then 'Laboratory' else coalesce(c.specialty, 'Doctor') end as subtitle,
           c.address, c.city, c.phone, c.opening_hours as hours, c.website,
           case when c.duty <> 'none' and (c.duty_until is null or c.duty_until > now()) then c.duty else 'none' end as duty,
           c.is_emergency, null::uuid as clinician_id, c.latitude::double precision as latitude, c.longitude::double precision as longitude
    from public.care_providers c
    where c.status = 'verified' and c.latitude between p_lat - lat_pad and p_lat + lat_pad and c.longitude between p_lng - lng_pad and p_lng + lng_pad
    union all
    select 'd:' || l.id::text, 'doctor', 'doctor', coalesce(l.doctor_name, 'Doctor'),
           concat_ws(' · ', l.specialty, l.venue_name), l.address, l.city, l.phone, l.schedule, null,
           'none', false, l.clinician_id, l.latitude::double precision, l.longitude::double precision
    from public.clinician_practice_locations l
    join public.clinician_public_profiles pp on pp.clinician_id = l.clinician_id and pp.is_public
    join public.clinician_verifications v on v.user_id = l.clinician_id and v.verification_status = 'verified'
    where l.status = 'verified' and l.latitude between p_lat - lat_pad and p_lat + lat_pad and l.longitude between p_lng - lng_pad and p_lng + lng_pad
  ), measured as (
    select c.*, 2 * 6371 * asin(least(1, sqrt(
      power(sin(radians(c.latitude - p_lat) / 2), 2) + cos(radians(p_lat)) * cos(radians(c.latitude)) * power(sin(radians(c.longitude - p_lng) / 2), 2)
    ))) as distance_km
    from candidates c
  )
  select m.id, m.source, m.kind, m.name, m.subtitle, m.address, m.city, m.phone, m.hours, m.website, m.duty, m.is_emergency, m.clinician_id, m.latitude, m.longitude, m.distance_km
  from measured m
  where m.distance_km <= radius
  order by m.distance_km
  limit least(greatest(coalesce(p_limit, 800), 1), 1500);
end;
$$;

revoke all on function public.list_map_locations(double precision, double precision, double precision, integer) from public;
grant execute on function public.list_map_locations(double precision, double precision, double precision, integer) to anon, authenticated;

-- Admin management ---------------------------------------------------------------------------------------------------
create function public.admin_save_care_location(p_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.care_providers;
  new_status text := coalesce(p_data ->> 'status', 'draft');
  lat numeric := nullif(p_data ->> 'latitude', '')::numeric;
  lng numeric := nullif(p_data ->> 'longitude', '')::numeric;
  new_duty text := coalesce(nullif(p_data ->> 'duty', ''), 'none');
  new_until timestamptz := nullif(p_data ->> 'duty_until', '')::timestamptz;
  result uuid;
begin
  if not (select public.has_ihssan_permission('providers.verify')) then raise exception 'Not allowed'; end if;
  if char_length(trim(coalesce(p_data ->> 'name', ''))) < 2 then raise exception 'Enter a name'; end if;
  if (p_data ->> 'kind') is null or (p_data ->> 'kind') not in ('pharmacy', 'clinic', 'hospital', 'laboratory') then raise exception 'Choose a type'; end if;
  if char_length(trim(coalesce(p_data ->> 'city', ''))) < 2 then raise exception 'Enter a city'; end if;
  if new_status not in ('draft', 'verified', 'retired') then raise exception 'Unknown status'; end if;
  if (lat is null) <> (lng is null) then raise exception 'Set both latitude and longitude'; end if;
  if new_status = 'verified' and lat is null then raise exception 'Place the location on the map before publishing'; end if;
  if new_duty in ('day', 'night') and new_until is null then raise exception 'Choose when this duty ends'; end if;
  if new_duty = 'none' then new_until := null; end if;

  if p_id is not null then
    select * into existing from public.care_providers where id = p_id;
    if not found then raise exception 'Location not found'; end if;
  end if;

  if p_id is null then
    insert into public.care_providers (kind, name, city, address, phone, latitude, longitude, opening_hours, website, notes, is_emergency, duty, duty_until, status, verified_by, verified_at)
    values (p_data ->> 'kind', trim(p_data ->> 'name'), trim(p_data ->> 'city'), nullif(trim(p_data ->> 'address'), ''), nullif(trim(p_data ->> 'phone'), ''), lat, lng,
            nullif(trim(p_data ->> 'opening_hours'), ''), nullif(trim(p_data ->> 'website'), ''), nullif(trim(p_data ->> 'notes'), ''),
            coalesce((p_data ->> 'is_emergency')::boolean, false), new_duty, new_until, new_status,
            case when new_status = 'verified' then me end, case when new_status = 'verified' then now() end)
    returning id into result;
  else
    update public.care_providers set
      kind = p_data ->> 'kind', name = trim(p_data ->> 'name'), city = trim(p_data ->> 'city'),
      address = nullif(trim(p_data ->> 'address'), ''), phone = nullif(trim(p_data ->> 'phone'), ''), latitude = lat, longitude = lng,
      opening_hours = nullif(trim(p_data ->> 'opening_hours'), ''), website = nullif(trim(p_data ->> 'website'), ''), notes = nullif(trim(p_data ->> 'notes'), ''),
      is_emergency = coalesce((p_data ->> 'is_emergency')::boolean, false), duty = new_duty, duty_until = new_until, status = new_status,
      verified_by = case when new_status = 'verified' then coalesce(existing.verified_by, me) else existing.verified_by end,
      verified_at = case when new_status = 'verified' then coalesce(existing.verified_at, now()) else existing.verified_at end
    where id = p_id
    returning id into result;
  end if;
  return result;
exception
  when check_violation then raise exception 'Some values are not valid. Check the phone number (digits, spaces, + or -) and that the website starts with https://';
end;
$$;

create function public.admin_set_care_location_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_ihssan_permission('providers.verify')) then raise exception 'Not allowed'; end if;
  if p_status not in ('draft', 'verified', 'retired') then raise exception 'Unknown status'; end if;
  if p_status = 'verified' and not exists (select 1 from public.care_providers where id = p_id and latitude is not null and longitude is not null) then
    raise exception 'Place the location on the map before publishing';
  end if;
  update public.care_providers set status = p_status,
    verified_by = case when p_status = 'verified' then coalesce(verified_by, auth.uid()) else verified_by end,
    verified_at = case when p_status = 'verified' then coalesce(verified_at, now()) else verified_at end
  where id = p_id;
  if not found then raise exception 'Location not found'; end if;
end;
$$;

create function public.admin_set_care_duty(p_id uuid, p_duty text, p_until timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_ihssan_permission('providers.verify')) then raise exception 'Not allowed'; end if;
  if p_duty not in ('none', 'day', 'night', '24h') then raise exception 'Unknown duty'; end if;
  if p_duty in ('day', 'night') and (p_until is null or p_until <= now()) then raise exception 'Choose a future end time for this duty'; end if;
  update public.care_providers set duty = p_duty, duty_until = case when p_duty in ('day', 'night') then p_until else null end where id = p_id;
  if not found then raise exception 'Location not found'; end if;
end;
$$;

create function public.admin_delete_care_location(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_ihssan_permission('providers.verify')) then raise exception 'Not allowed'; end if;
  delete from public.care_providers where id = p_id and status <> 'verified';
  if not found then raise exception 'Only drafts and retired locations can be deleted. Retire it first.'; end if;
end;
$$;

-- Bulk import creates drafts only; a reviewer publishes them after checking.
create function public.admin_import_care_locations(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  row_no int := 0;
  inserted int := 0;
  skipped int := 0;
  problems jsonb := '[]'::jsonb;
  lat numeric;
  lng numeric;
begin
  if not (select public.has_ihssan_permission('providers.verify')) then raise exception 'Not allowed'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'Import up to 500 rows at a time'; end if;

  for item in select * from jsonb_array_elements(p_rows) loop
    row_no := row_no + 1;
    begin
      lat := nullif(item ->> 'latitude', '')::numeric;
      lng := nullif(item ->> 'longitude', '')::numeric;
      if (item ->> 'kind') not in ('pharmacy', 'clinic', 'hospital', 'laboratory') then raise exception 'unknown type'; end if;
      if lat is null or lng is null then raise exception 'missing coordinates'; end if;
      if exists (select 1 from public.care_providers where lower(name) = lower(trim(item ->> 'name')) and lower(city) = lower(trim(item ->> 'city'))) then
        skipped := skipped + 1;
        continue;
      end if;
      insert into public.care_providers (kind, name, city, address, phone, latitude, longitude, opening_hours, status)
      values (item ->> 'kind', trim(item ->> 'name'), trim(item ->> 'city'), nullif(trim(item ->> 'address'), ''), nullif(trim(item ->> 'phone'), ''), lat, lng, nullif(trim(item ->> 'opening_hours'), ''), 'draft');
      inserted := inserted + 1;
    exception when others then
      problems := problems || jsonb_build_object('row', row_no, 'message', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('inserted', inserted, 'skipped', skipped, 'problems', problems);
end;
$$;

revoke all on function public.admin_save_care_location(uuid, jsonb), public.admin_set_care_location_status(uuid, text), public.admin_set_care_duty(uuid, text, timestamptz),
  public.admin_delete_care_location(uuid), public.admin_import_care_locations(jsonb) from public, anon;
grant execute on function public.admin_save_care_location(uuid, jsonb), public.admin_set_care_location_status(uuid, text), public.admin_set_care_duty(uuid, text, timestamptz),
  public.admin_delete_care_location(uuid), public.admin_import_care_locations(jsonb) to authenticated;
