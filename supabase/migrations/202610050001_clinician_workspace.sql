-- Clinician workspace: credentials + admin verification, public doctor profiles,
-- weekly schedules, appointments and private patient notes.
-- All writes go through security definer functions; tables are not directly writable.

-- ---------------------------------------------------------------- verification
alter table public.clinician_verifications
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text check (review_note is null or char_length(review_note) <= 500);

create table public.clinician_credentials (
  user_id uuid primary key references public.clinician_verifications (user_id) on delete cascade,
  license_number text not null check (char_length(trim(license_number)) between 3 and 40),
  issuing_body text not null check (char_length(trim(issuing_body)) between 2 and 120),
  specialty text not null check (char_length(trim(specialty)) between 2 and 120),
  city text not null check (char_length(trim(city)) between 2 and 80),
  submitted_at timestamptz not null default now()
);

alter table public.clinician_credentials enable row level security;
revoke all on public.clinician_credentials from anon, authenticated;

create function public.submit_my_credentials(
  p_license_number text, p_issuing_body text, p_specialty text, p_city text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  select verification_status into current_status
  from public.clinician_verifications where user_id = auth.uid() for update;
  if current_status is null then
    raise exception 'A clinician account is required';
  end if;
  if current_status in ('verified', 'suspended') then
    raise exception 'Contact Ihssan support to change credentials on a % account', current_status;
  end if;

  insert into public.clinician_credentials (user_id, license_number, issuing_body, specialty, city)
  values (auth.uid(), trim(p_license_number), trim(p_issuing_body), trim(p_specialty), trim(p_city))
  on conflict (user_id) do update
    set license_number = excluded.license_number,
        issuing_body = excluded.issuing_body,
        specialty = excluded.specialty,
        city = excluded.city,
        submitted_at = now();

  update public.clinician_verifications
  set verification_status = 'pending', review_note = null
  where user_id = auth.uid();
end;
$$;

create function public.get_my_credentials()
returns table (license_number text, issuing_body text, specialty text, city text, submitted_at timestamptz,
               verification_status text, review_note text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.license_number, c.issuing_body, c.specialty, c.city, c.submitted_at, v.verification_status, v.review_note
  from public.clinician_verifications v
  left join public.clinician_credentials c on c.user_id = v.user_id
  where v.user_id = (select auth.uid());
$$;

create function public.list_clinician_verifications(p_status text default 'pending')
returns table (
  user_id uuid, public_name text, email text, verification_status text, created_at timestamptz,
  license_number text, issuing_body text, specialty text, city text, submitted_at timestamptz,
  review_note text, reviewed_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_ihssan_permission('providers.verify') then
    raise exception 'Provider verification permission required' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'verified', 'rejected', 'suspended') then
    raise exception 'Unknown status';
  end if;
  return query
  select v.user_id, v.public_name, u.email::text, v.verification_status, v.created_at,
         c.license_number, c.issuing_body, c.specialty, c.city, c.submitted_at, v.review_note, v.reviewed_at
  from public.clinician_verifications v
  join auth.users u on u.id = v.user_id
  left join public.clinician_credentials c on c.user_id = v.user_id
  where v.verification_status = p_status
  order by coalesce(c.submitted_at, v.created_at) asc
  limit 200;
end;
$$;

create function public.review_clinician_verification(p_user_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.has_ihssan_permission('providers.verify') then
    raise exception 'Provider verification permission required' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'rejected', 'suspended') then
    raise exception 'Decision must be verified, rejected or suspended';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot review your own verification';
  end if;
  if p_decision <> 'verified' and (note is null or char_length(note) < 5) then
    raise exception 'A reason of at least 5 characters is required';
  end if;
  if note is not null and char_length(note) > 500 then
    raise exception 'The note is too long';
  end if;
  if p_decision = 'verified' and not exists (select 1 from public.clinician_credentials where user_id = p_user_id) then
    raise exception 'This clinician has not submitted credentials yet';
  end if;

  update public.clinician_verifications
  set verification_status = p_decision,
      verified_at = case when p_decision = 'verified' then now() else null end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = note
  where user_id = p_user_id;
  if not found then
    raise exception 'Clinician not found';
  end if;

  insert into public.admin_audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'clinician_verification.' || p_decision, 'clinician_verifications', p_user_id,
          jsonb_build_object('note_present', note is not null));
end;
$$;

create function public.list_pending_practice_locations()
returns table (
  id uuid, clinician_id uuid, doctor_name text, clinician_status text, venue_kind text, venue_name text,
  city text, address text, specialty text, phone text, google_place_id text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_ihssan_permission('providers.verify') then
    raise exception 'Provider verification permission required' using errcode = '42501';
  end if;
  return query
  select l.id, l.clinician_id, v.public_name, v.verification_status, l.venue_kind, l.venue_name,
         l.city, l.address, l.specialty, l.phone, l.google_place_id
  from public.clinician_practice_locations l
  join public.clinician_verifications v on v.user_id = l.clinician_id
  where l.status = 'pending'
  order by l.id
  limit 200;
end;
$$;

create function public.review_practice_location(p_location_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_ihssan_permission('providers.verify') then
    raise exception 'Provider verification permission required' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'rejected') then
    raise exception 'Decision must be verified or rejected';
  end if;
  update public.clinician_practice_locations
  set status = p_decision
  where id = p_location_id and status = 'pending';
  if not found then
    raise exception 'This location is no longer pending review';
  end if;
  insert into public.admin_audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'practice_location.' || p_decision, 'clinician_practice_locations', p_location_id, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------- schedules
create table public.clinician_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  location_id uuid not null references public.clinician_practice_locations (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  slot_minutes smallint not null check (slot_minutes in (10, 15, 20, 30, 45, 60)),
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((extract(epoch from (end_time - start_time)) / 60)::int >= slot_minutes)
);

create index clinician_schedule_rules_clinician_idx on public.clinician_schedule_rules (clinician_id, weekday);
create index clinician_schedule_rules_location_idx on public.clinician_schedule_rules (location_id);

alter table public.clinician_schedule_rules enable row level security;
create policy "clinicians_read_own_schedule" on public.clinician_schedule_rules for select to authenticated
  using (clinician_id = (select auth.uid()));
revoke all on public.clinician_schedule_rules from anon, authenticated;
grant select on public.clinician_schedule_rules to authenticated;

create function public.add_schedule_rule(
  p_location_id uuid, p_weekday smallint, p_start time, p_end time, p_slot_minutes smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_verified_clinician(auth.uid()) then
    raise exception 'Only verified clinicians can set a schedule';
  end if;
  if not exists (
    select 1 from public.clinician_practice_locations l
    where l.id = p_location_id and l.clinician_id = auth.uid() and l.status = 'verified'
  ) then
    raise exception 'Choose one of your approved practice locations';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 7));
  if exists (
    select 1 from public.clinician_schedule_rules r
    where r.clinician_id = auth.uid() and r.weekday = p_weekday
      and r.start_time < p_end and r.end_time > p_start
  ) then
    raise exception 'This overlaps another time block on the same day';
  end if;
  if (select count(*) from public.clinician_schedule_rules where clinician_id = auth.uid()) >= 60 then
    raise exception 'Too many time blocks';
  end if;
  insert into public.clinician_schedule_rules (clinician_id, location_id, weekday, start_time, end_time, slot_minutes)
  values (auth.uid(), p_location_id, p_weekday, p_start, p_end, p_slot_minutes)
  returning id into new_id;
  return new_id;
end;
$$;

create function public.delete_schedule_rule(p_rule_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.clinician_schedule_rules where id = p_rule_id and clinician_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------- public profile
create table public.clinician_public_profiles (
  clinician_id uuid primary key references public.clinician_verifications (user_id) on delete cascade,
  headline text check (headline is null or char_length(headline) <= 120),
  bio text check (bio is null or char_length(bio) <= 1500),
  specialties text[] not null default '{}' check (cardinality(specialties) <= 5),
  languages text[] not null default '{}' check (languages <@ array['ar', 'fr', 'en', 'es', 'zgh']::text[]),
  years_experience smallint check (years_experience is null or years_experience between 0 and 70),
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.clinician_public_profiles enable row level security;
revoke all on public.clinician_public_profiles from anon, authenticated;

create function public.get_my_public_profile()
returns table (headline text, bio text, specialties text[], languages text[], years_experience smallint, is_public boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.headline, p.bio, p.specialties, p.languages, p.years_experience, p.is_public
  from public.clinician_public_profiles p where p.clinician_id = (select auth.uid());
$$;

create function public.upsert_my_public_profile(
  p_headline text, p_bio text, p_specialties text[], p_languages text[], p_years smallint, p_is_public boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_specialties text[];
begin
  if not exists (select 1 from public.clinician_verifications where user_id = auth.uid()) then
    raise exception 'A clinician account is required';
  end if;
  select coalesce(array_agg(distinct trim(s)) filter (where char_length(trim(s)) between 2 and 60), '{}')
  into cleaned_specialties from unnest(coalesce(p_specialties, '{}')) as s;

  insert into public.clinician_public_profiles (clinician_id, headline, bio, specialties, languages, years_experience, is_public)
  values (auth.uid(), nullif(trim(coalesce(p_headline, '')), ''), nullif(trim(coalesce(p_bio, '')), ''),
          cleaned_specialties, coalesce(p_languages, '{}'), p_years, coalesce(p_is_public, false))
  on conflict (clinician_id) do update
    set headline = excluded.headline, bio = excluded.bio, specialties = excluded.specialties,
        languages = excluded.languages, years_experience = excluded.years_experience,
        is_public = excluded.is_public, updated_at = now();
end;
$$;

create function public.get_doctor_profile(p_clinician_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'clinician_id', v.user_id,
    'name', v.public_name,
    'headline', p.headline,
    'bio', p.bio,
    'specialties', p.specialties,
    'languages', p.languages,
    'years_experience', p.years_experience,
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'venue_name', l.venue_name, 'venue_kind', l.venue_kind, 'address', l.address, 'city', l.city,
        'latitude', l.latitude, 'longitude', l.longitude, 'google_place_id', l.google_place_id,
        'specialty', l.specialty, 'consultation_modes', l.consultation_modes, 'phone', l.phone, 'schedule', l.schedule,
        'bookable', exists (select 1 from public.clinician_schedule_rules r where r.location_id = l.id)
      ) order by l.venue_name)
      from public.clinician_practice_locations l
      where l.clinician_id = v.user_id and l.status = 'verified'
    ), '[]'::jsonb)
  )
  from public.clinician_verifications v
  join public.clinician_public_profiles p on p.clinician_id = v.user_id
  where v.user_id = p_clinician_id
    and v.verification_status = 'verified'
    and p.is_public
    and (select auth.uid()) is not null;
$$;

create function public.search_doctors(p_query text default null, p_limit integer default 20)
returns table (clinician_id uuid, name text, headline text, specialties text[], languages text[], cities text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  pattern := '%' || replace(replace(replace(trim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
  select v.user_id, v.public_name, p.headline, p.specialties, p.languages,
         array(select distinct l.city from public.clinician_practice_locations l
               where l.clinician_id = v.user_id and l.status = 'verified' order by 1)
  from public.clinician_verifications v
  join public.clinician_public_profiles p on p.clinician_id = v.user_id
  where v.verification_status = 'verified'
    and p.is_public
    and exists (select 1 from public.clinician_practice_locations l where l.clinician_id = v.user_id and l.status = 'verified')
    and (char_length(trim(coalesce(p_query, ''))) = 0
         or v.public_name ilike pattern
         or p.headline ilike pattern
         or exists (select 1 from unnest(p.specialties) s where s ilike pattern)
         or exists (select 1 from public.clinician_practice_locations l
                    where l.clinician_id = v.user_id and l.status = 'verified' and l.city ilike pattern))
  order by v.public_name
  limit least(greatest(coalesce(p_limit, 20), 1), 30);
end;
$$;

-- ---------------------------------------------------------------- appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  location_id uuid references public.clinician_practice_locations (id) on delete set null,
  venue_name text not null,
  venue_address text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null check (mode in ('in_person', 'video')),
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (clinician_id <> patient_id)
);

create unique index appointments_no_double_booking
  on public.appointments (clinician_id, starts_at) where status in ('requested', 'confirmed');
create index appointments_patient_idx on public.appointments (patient_id, starts_at desc);
create index appointments_clinician_idx on public.appointments (clinician_id, starts_at desc);

alter table public.appointments enable row level security;
create policy "parties_read_appointments" on public.appointments for select to authenticated
  using (patient_id = (select auth.uid()) or clinician_id = (select auth.uid()));
revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;

create function public.list_available_slots(p_clinician_id uuid, p_location_id uuid, p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select greatest(p_from, (now() at time zone 'Africa/Casablanca')::date) as d0,
           least(p_to, (now() at time zone 'Africa/Casablanca')::date + 30) as d1
  ),
  days as (
    select gs::date as day from bounds, generate_series(bounds.d0::timestamp, bounds.d1::timestamp, interval '1 day') gs
  ),
  slots as (
    select ((day + r.start_time + n * r.slot_minutes * interval '1 minute') at time zone 'Africa/Casablanca') as s,
           r.slot_minutes
    from days
    join public.clinician_schedule_rules r
      on r.clinician_id = p_clinician_id and r.location_id = p_location_id
     and r.weekday = extract(isodow from days.day)::int
    cross join lateral generate_series(0, (extract(epoch from (r.end_time - r.start_time)) / 60)::int / r.slot_minutes - 1) n
    where (select auth.uid()) is not null
      and public.is_verified_clinician(p_clinician_id)
      and exists (select 1 from public.clinician_practice_locations l
                  where l.id = p_location_id and l.clinician_id = p_clinician_id and l.status = 'verified')
  )
  select s, s + slot_minutes * interval '1 minute'
  from slots
  where s > now() + interval '2 hours'
    and not exists (
      select 1 from public.appointments a
      where a.clinician_id = p_clinician_id and a.status in ('requested', 'confirmed')
        and a.starts_at < s + slot_minutes * interval '1 minute' and a.ends_at > s
    )
  order by s;
$$;

create function public.book_appointment(
  p_clinician_id uuid, p_location_id uuid, p_starts_at timestamptz, p_mode text, p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  slot record;
  location_row public.clinician_practice_locations%rowtype;
  new_id uuid;
  cleaned_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if me is null then
    raise exception 'Authentication required';
  end if;
  if me = p_clinician_id then
    raise exception 'You cannot book an appointment with yourself';
  end if;
  if cleaned_reason is not null and char_length(cleaned_reason) > 500 then
    raise exception 'The reason is too long';
  end if;

  select * into location_row from public.clinician_practice_locations
  where id = p_location_id and clinician_id = p_clinician_id and status = 'verified';
  if location_row.id is null then
    raise exception 'This location is not available for booking';
  end if;
  if not (p_mode = any(location_row.consultation_modes)) then
    raise exception 'This consultation type is not offered here';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_clinician_id::text, 11));

  select s.starts_at, s.ends_at into slot
  from public.list_available_slots(
    p_clinician_id, p_location_id,
    (p_starts_at at time zone 'Africa/Casablanca')::date, (p_starts_at at time zone 'Africa/Casablanca')::date
  ) s
  where s.starts_at = p_starts_at;
  if slot.starts_at is null then
    raise exception 'That time is no longer available. Pick another slot.';
  end if;

  if (select count(*) from public.appointments a
      where a.patient_id = me and a.status in ('requested', 'confirmed') and a.starts_at > now()) >= 5 then
    raise exception 'You have too many upcoming appointments. Cancel one first.';
  end if;
  if exists (select 1 from public.appointments a
             where a.patient_id = me and a.status in ('requested', 'confirmed')
               and a.starts_at < slot.ends_at and a.ends_at > slot.starts_at) then
    raise exception 'You already have an appointment at that time';
  end if;

  insert into public.appointments (clinician_id, patient_id, location_id, venue_name, venue_address, starts_at, ends_at, mode, reason)
  values (p_clinician_id, me, location_row.id, location_row.venue_name,
          concat_ws(', ', location_row.address, location_row.city), slot.starts_at, slot.ends_at, p_mode, cleaned_reason)
  returning id into new_id;
  return new_id;
end;
$$;

create function public.update_appointment_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  row_ public.appointments%rowtype;
  note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if me is null then
    raise exception 'Authentication required';
  end if;
  if note is not null and char_length(note) > 300 then
    raise exception 'The note is too long';
  end if;
  select * into row_ from public.appointments
  where id = p_id and (patient_id = me or clinician_id = me) for update;
  if row_.id is null then
    raise exception 'Appointment not found';
  end if;

  if p_status = 'cancelled' then
    if row_.status not in ('requested', 'confirmed') or row_.starts_at <= now() then
      raise exception 'This appointment can no longer be cancelled';
    end if;
  elsif p_status in ('confirmed', 'declined') then
    if row_.clinician_id <> me then raise exception 'Only the doctor can do this'; end if;
    if row_.status <> 'requested' or row_.starts_at <= now() then
      raise exception 'This request can no longer be answered';
    end if;
  elsif p_status in ('completed', 'no_show') then
    if row_.clinician_id <> me then raise exception 'Only the doctor can do this'; end if;
    if row_.status <> 'confirmed' or row_.starts_at > now() then
      raise exception 'Only a confirmed appointment that has started can be closed';
    end if;
  else
    raise exception 'Unknown status';
  end if;

  update public.appointments set status = p_status, decision_note = coalesce(note, decision_note), updated_at = now()
  where id = p_id;
end;
$$;

create function public.list_my_appointments(p_scope text default 'upcoming')
returns table (
  id uuid, viewer_role text, counterpart_name text, clinician_id uuid, location_id uuid,
  venue_name text, venue_address text, starts_at timestamptz, ends_at timestamptz,
  mode text, reason text, status text, decision_note text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_scope not in ('upcoming', 'past') then
    raise exception 'Unknown scope';
  end if;
  return query
  select a.id,
         case when a.patient_id = auth.uid() then 'patient' else 'clinician' end,
         case when a.patient_id = auth.uid() then v.public_name else p.display_name end,
         a.clinician_id, a.location_id, a.venue_name, a.venue_address, a.starts_at, a.ends_at, a.mode, a.reason,
         case when a.status = 'requested' and a.starts_at <= now() then 'expired' else a.status end,
         a.decision_note, a.created_at
  from public.appointments a
  join public.clinician_verifications v on v.user_id = a.clinician_id
  join public.profiles p on p.id = a.patient_id
  where (a.patient_id = auth.uid() or a.clinician_id = auth.uid())
    and (case when p_scope = 'upcoming'
              then a.ends_at > now() and a.status in ('requested', 'confirmed')
              else not (a.ends_at > now() and a.status in ('requested', 'confirmed')) end)
  order by case when p_scope = 'upcoming' then a.starts_at end asc, a.starts_at desc
  limit 100;
end;
$$;

-- Cancel future appointments when a doctor stops being verified.
create function public.cancel_appointments_when_clinician_unverified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status <> 'verified' and old.verification_status = 'verified' then
    update public.appointments
    set status = 'cancelled', decision_note = 'The doctor is no longer available on Ihssan.', updated_at = now()
    where clinician_id = new.user_id and status in ('requested', 'confirmed') and starts_at > now();
  end if;
  return new;
end;
$$;
revoke all on function public.cancel_appointments_when_clinician_unverified() from public, anon, authenticated;
create trigger cancel_appointments_when_clinician_unverified
  after update of verification_status on public.clinician_verifications
  for each row execute function public.cancel_appointments_when_clinician_unverified();

-- ---------------------------------------------------------------- private patient notes
create table public.clinician_patient_notes (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinician_patient_notes_idx on public.clinician_patient_notes (clinician_id, patient_id, created_at desc);

alter table public.clinician_patient_notes enable row level security;
revoke all on public.clinician_patient_notes from anon, authenticated;

create function public.list_patient_notes(p_grant_id uuid)
returns table (id uuid, body text, created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  select g.patient_id into target from public.patient_access_grants g
  where g.id = p_grant_id and g.clinician_id = auth.uid() and g.revoked_at is null;
  if target is null or not public.is_verified_clinician(auth.uid()) then
    raise exception 'Patient access is revoked or unavailable';
  end if;
  return query
  select n.id, n.body, n.created_at, n.updated_at from public.clinician_patient_notes n
  where n.clinician_id = auth.uid() and n.patient_id = target
  order by n.created_at desc limit 200;
end;
$$;

create function public.add_patient_note(p_grant_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  new_id uuid;
begin
  select g.patient_id into target from public.patient_access_grants g
  where g.id = p_grant_id and g.clinician_id = auth.uid() and g.revoked_at is null;
  if target is null or not public.is_verified_clinician(auth.uid()) then
    raise exception 'Patient access is revoked or unavailable';
  end if;
  if (select count(*) from public.clinician_patient_notes where clinician_id = auth.uid() and patient_id = target) >= 200 then
    raise exception 'Note limit reached for this patient';
  end if;
  insert into public.clinician_patient_notes (clinician_id, patient_id, body)
  values (auth.uid(), target, trim(p_body)) returning id into new_id;
  return new_id;
end;
$$;

create function public.update_patient_note(p_note_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clinician_patient_notes n
  set body = trim(p_body), updated_at = now()
  where n.id = p_note_id and n.clinician_id = auth.uid()
    and public.is_verified_clinician(auth.uid())
    and exists (select 1 from public.patient_access_grants g
                where g.patient_id = n.patient_id and g.clinician_id = auth.uid() and g.revoked_at is null);
  if not found then
    raise exception 'Note not found or patient access revoked';
  end if;
end;
$$;

create function public.delete_patient_note(p_note_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.clinician_patient_notes where id = p_note_id and clinician_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------- grants
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'submit_my_credentials(text,text,text,text)',
    'get_my_credentials()',
    'list_clinician_verifications(text)',
    'review_clinician_verification(uuid,text,text)',
    'review_practice_location(uuid,text)',
    'list_pending_practice_locations()',
    'get_my_public_profile()',
    'upsert_my_public_profile(text,text,text[],text[],smallint,boolean)',
    'get_doctor_profile(uuid)',
    'search_doctors(text,integer)',
    'add_schedule_rule(uuid,smallint,time,time,smallint)',
    'delete_schedule_rule(uuid)',
    'list_available_slots(uuid,uuid,date,date)',
    'book_appointment(uuid,uuid,timestamptz,text,text)',
    'update_appointment_status(uuid,text,text)',
    'list_my_appointments(text)',
    'list_patient_notes(uuid)',
    'add_patient_note(uuid,text)',
    'update_patient_note(uuid,text)',
    'delete_patient_note(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
