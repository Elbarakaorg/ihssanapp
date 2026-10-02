revoke execute on function public.is_verified_clinician(uuid) from public, anon, authenticated;
revoke execute on function public.is_verified_ihssan_clinician(uuid) from public, anon, authenticated;

create function public.enforce_verified_clinician_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_verified_clinician(new.clinician_id) then
    raise exception 'A verified clinician is required' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_verified_clinician_link() from public, anon, authenticated;

create trigger patient_access_grants_require_verified_clinician
  before insert or update of clinician_id on public.patient_access_grants
  for each row execute function public.enforce_verified_clinician_link();

create trigger patient_favorites_require_verified_clinician
  before insert or update of clinician_id on public.patient_favorite_clinicians
  for each row execute function public.enforce_verified_clinician_link();

drop policy "patients_grant_verified_clinicians_access" on public.patient_access_grants;
create policy "patients_grant_verified_clinicians_access"
  on public.patient_access_grants for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and clinician_id <> (select auth.uid())
    and revoked_at is null
  );

drop policy "patients_manage_their_favorite_clinicians" on public.patient_favorite_clinicians;
create policy "patients_manage_their_favorite_clinicians"
  on public.patient_favorite_clinicians for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

create or replace function public.list_my_shared_patient_measurements(p_grant_id uuid)
returns table (
  id uuid,
  numeric_value numeric,
  component_values jsonb,
  unit text,
  measured_at timestamptz,
  source_kind text,
  source_label text,
  metric_key text,
  display_names jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_clinician_id uuid := (select auth.uid());
  authorized_grant public.patient_access_grants%rowtype;
begin
  if current_clinician_id is null
     or not public.is_verified_clinician(current_clinician_id) then
    raise exception 'A verified clinician account is required' using errcode = '42501';
  end if;

  select * into authorized_grant
  from public.patient_access_grants as access_grant
  where access_grant.id = p_grant_id
    and access_grant.clinician_id = current_clinician_id
    and access_grant.revoked_at is null
    and access_grant.scope ->> 'measurements' = 'true';

  if authorized_grant.id is null then
    raise exception 'Measurement access is revoked or unavailable' using errcode = '42501';
  end if;

  insert into public.patient_access_events (grant_id, patient_id, clinician_id, access_type)
  values (authorized_grant.id, authorized_grant.patient_id, current_clinician_id, 'measurements');

  return query
  select measurement.id,
         measurement.numeric_value,
         measurement.component_values,
         measurement.unit,
         measurement.measured_at,
         measurement.source_kind,
         measurement.source_label,
         definition.metric_key,
         definition.display_names
  from public.health_measurements as measurement
  join public.metric_definitions as definition on definition.id = measurement.metric_definition_id
  where measurement.patient_id = authorized_grant.patient_id
  order by measurement.measured_at desc
  limit 100;
end;
$$;

revoke all on function public.list_my_shared_patient_measurements(uuid) from public, anon;
grant execute on function public.list_my_shared_patient_measurements(uuid) to authenticated;

alter table public.patient_access_events
  add column access_type text not null default 'patient_profile'
    check (access_type in ('patient_profile', 'measurements'));

create or replace function public.get_my_shared_patient_profile(p_grant_id uuid)
returns table (
  patient_id uuid,
  patient_name text,
  granted_at timestamptz,
  access_scope jsonb,
  date_of_birth date,
  blood_type text,
  emergency_contact_name text,
  emergency_contact_relation text,
  emergency_contact_phone text,
  allergies text[],
  conditions text[],
  medications text[],
  surgeries text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_clinician_id uuid := (select auth.uid());
  authorized_grant public.patient_access_grants%rowtype;
begin
  if current_clinician_id is null
     or not public.is_verified_clinician(current_clinician_id) then
    raise exception 'A verified clinician account is required' using errcode = '42501';
  end if;

  select * into authorized_grant
  from public.patient_access_grants as access_grant
  where access_grant.id = p_grant_id
    and access_grant.clinician_id = current_clinician_id
    and access_grant.revoked_at is null
    and (
      access_grant.scope ->> 'medical_profile' = 'true'
      or access_grant.scope ->> 'measurements' = 'true'
    );

  if authorized_grant.id is null then
    raise exception 'Patient access is revoked or unavailable' using errcode = '42501';
  end if;

  insert into public.patient_access_events (grant_id, patient_id, clinician_id, access_type)
  values (authorized_grant.id, authorized_grant.patient_id, current_clinician_id, 'patient_profile');

  return query
  select patient.id,
         patient.display_name,
         authorized_grant.granted_at,
         authorized_grant.scope,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.date_of_birth else null end,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.blood_type else null end,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.emergency_contact_name else null end,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.emergency_contact_relation else null end,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.emergency_contact_phone else null end,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.allergies else null end,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.conditions else null end,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.medications else null end,
         case when authorized_grant.scope ->> 'medical_profile' = 'true' then medical.surgeries else null end
  from public.profiles as patient
  left join public.patient_medical_profiles as medical on medical.patient_id = patient.id
  where patient.id = authorized_grant.patient_id;
end;
$$;

revoke all on function public.get_my_shared_patient_profile(uuid) from public, anon;
grant execute on function public.get_my_shared_patient_profile(uuid) to authenticated;

drop policy "granted_clinicians_read_medical_profiles" on public.patient_medical_profiles;
create policy "patients_read_their_medical_profile"
  on public.patient_medical_profiles for select to authenticated
  using (patient_id = (select auth.uid()));

drop policy "patients_and_granted_clinicians_read_measurements" on public.health_measurements;
create policy "patients_read_their_own_measurements"
  on public.health_measurements for select to authenticated
  using (patient_id = (select auth.uid()));

update public.profiles
set avatar_path = null
where avatar_path is not null
  and split_part(avatar_path, '/', 1) <> id::text;

alter table public.profiles
  add constraint profiles_avatar_path_matches_owner
  check (
    avatar_path is null
    or split_part(avatar_path, '/', 1) = id::text
  );

grant update (display_name, preferred_locale, bio, avatar_path)
  on public.profiles to authenticated;
