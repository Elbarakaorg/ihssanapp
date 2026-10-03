alter table public.care_providers
  add column google_place_id text check (google_place_id is null or char_length(google_place_id) between 10 and 300);

create unique index care_providers_google_place_idx on public.care_providers (google_place_id) where google_place_id is not null;

create table public.clinician_practice_locations (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  venue_kind text not null check (venue_kind in ('clinic', 'hospital', 'private_office')),
  venue_name text not null check (char_length(trim(venue_name)) between 2 and 160),
  google_place_id text check (google_place_id is null or char_length(google_place_id) between 10 and 300),
  city text not null check (char_length(trim(city)) between 2 and 80),
  address text check (address is null or char_length(address) <= 300),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  specialty text check (specialty is null or char_length(trim(specialty)) between 2 and 120),
  consultation_modes text[] not null default '{in_person}'
    check (cardinality(consultation_modes) > 0 and consultation_modes <@ array['in_person', 'video']::text[]),
  schedule text check (schedule is null or char_length(schedule) <= 400),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'retired')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('verified', 'rejected') or (reviewed_by is not null and reviewed_at is not null))
);

create index clinician_practice_locations_owner_idx on public.clinician_practice_locations (clinician_id);
create index clinician_practice_locations_public_idx on public.clinician_practice_locations (city) where status = 'verified';

alter table public.clinician_practice_locations enable row level security;

create policy "verified_practice_locations_readable"
  on public.clinician_practice_locations for select to anon, authenticated
  using (status = 'verified');

create policy "clinicians_read_own_practice_locations"
  on public.clinician_practice_locations for select to authenticated
  using (clinician_id = (select auth.uid()));

create policy "provider_reviewers_read_practice_locations"
  on public.clinician_practice_locations for select to authenticated
  using ((select public.has_ihssan_permission('providers.verify')));

create policy "clinicians_add_own_practice_locations"
  on public.clinician_practice_locations for insert to authenticated
  with check (clinician_id = (select auth.uid()) and status = 'pending');

create policy "clinicians_edit_own_practice_locations"
  on public.clinician_practice_locations for update to authenticated
  using (clinician_id = (select auth.uid()))
  with check (clinician_id = (select auth.uid()));

create policy "provider_reviewers_update_practice_locations"
  on public.clinician_practice_locations for update to authenticated
  using ((select public.has_ihssan_permission('providers.verify')))
  with check ((select public.has_ihssan_permission('providers.verify')));

create policy "clinicians_delete_own_practice_locations"
  on public.clinician_practice_locations for delete to authenticated
  using (clinician_id = (select auth.uid()));

revoke all on public.clinician_practice_locations from anon, authenticated;
grant select on public.clinician_practice_locations to anon, authenticated;
grant insert, update, delete on public.clinician_practice_locations to authenticated;

create function public.guard_practice_location_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_reviewer boolean := (select public.has_ihssan_permission('providers.verify'));
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' and new.clinician_id <> old.clinician_id then
    raise exception 'clinician_id cannot change';
  end if;

  if new.status = 'verified' then
    if not exists (
      select 1 from public.clinician_verifications v
      where v.user_id = new.clinician_id and v.verification_status = 'verified'
    ) then
      raise exception 'clinician is not verified';
    end if;
  end if;

  if is_reviewer then
    if new.status in ('verified', 'rejected') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      new.reviewed_by := (select auth.uid());
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  -- Owners cannot self-approve; any edit sends the listing back to review.
  if tg_op = 'UPDATE' then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_practice_location_changes() from public, anon, authenticated;

create trigger guard_practice_location_changes
  before insert or update on public.clinician_practice_locations
  for each row execute function public.guard_practice_location_changes();

create function public.retire_locations_when_clinician_unverified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status <> 'verified' and old.verification_status = 'verified' then
    update public.clinician_practice_locations
      set status = 'retired'
      where clinician_id = new.user_id and status in ('verified', 'pending');
  end if;
  return new;
end;
$$;

revoke all on function public.retire_locations_when_clinician_unverified() from public, anon, authenticated;

create trigger retire_locations_when_clinician_unverified
  after update of verification_status on public.clinician_verifications
  for each row execute function public.retire_locations_when_clinician_unverified();
