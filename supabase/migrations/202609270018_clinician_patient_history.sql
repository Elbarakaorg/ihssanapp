create table public.patient_access_events (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.patient_access_grants (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  accessed_at timestamptz not null default now()
);

create index patient_access_events_grant_time
  on public.patient_access_events (grant_id, accessed_at desc);

alter table public.patient_access_events enable row level security;

create policy "patients_and_clinicians_read_access_events"
  on public.patient_access_events for select to authenticated
  using (
    patient_id = (select auth.uid())
    or clinician_id = (select auth.uid())
  );

grant select on public.patient_access_events to authenticated;

create or replace function public.list_my_patient_profiles()
returns table (
  grant_id uuid,
  patient_id uuid,
  patient_name text,
  granted_at timestamptz,
  revoked_at timestamptz,
  access_scope jsonb,
  last_accessed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_clinician_id uuid := auth.uid();
begin
  if current_clinician_id is null or not public.is_verified_clinician(current_clinician_id) then
    raise exception 'A verified clinician account is required';
  end if;

  return query
  select access_grant.id,
         access_grant.patient_id,
         patient.display_name,
         access_grant.granted_at,
         access_grant.revoked_at,
         access_grant.scope,
         max(access_event.accessed_at)
  from public.patient_access_grants as access_grant
  join public.profiles as patient on patient.id = access_grant.patient_id
  left join public.patient_access_events as access_event on access_event.grant_id = access_grant.id
  where access_grant.clinician_id = current_clinician_id
  group by access_grant.id, patient.id
  order by access_grant.granted_at desc;
end;
$$;

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
  current_clinician_id uuid := auth.uid();
  authorized_grant public.patient_access_grants%rowtype;
begin
  if current_clinician_id is null or not public.is_verified_clinician(current_clinician_id) then
    raise exception 'A verified clinician account is required';
  end if;

  select * into authorized_grant
  from public.patient_access_grants as access_grant
  where access_grant.id = p_grant_id
    and access_grant.clinician_id = current_clinician_id
    and access_grant.revoked_at is null
    and (access_grant.scope ->> 'medical_profile' = 'true' or access_grant.scope ->> 'measurements' = 'true');

  if authorized_grant.id is null then
    raise exception 'Patient access is revoked or unavailable';
  end if;

  insert into public.patient_access_events (grant_id, patient_id, clinician_id)
  values (authorized_grant.id, authorized_grant.patient_id, current_clinician_id);

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

revoke all on function public.list_my_patient_profiles() from public;
revoke all on function public.get_my_shared_patient_profile(uuid) from public;
grant execute on function public.list_my_patient_profiles() to authenticated;
grant execute on function public.get_my_shared_patient_profile(uuid) to authenticated;

drop policy "granted_clinicians_read_medical_profiles" on public.patient_medical_profiles;
create policy "granted_clinicians_read_medical_profiles"
  on public.patient_medical_profiles for select to authenticated
  using (
    (select public.is_verified_clinician((select auth.uid())))
    and exists (
      select 1
      from public.patient_access_grants as access_grant
      where access_grant.patient_id = patient_medical_profiles.patient_id
        and access_grant.clinician_id = (select auth.uid())
        and access_grant.revoked_at is null
        and access_grant.scope ->> 'medical_profile' = 'true'
    )
  );

drop policy "patients_and_granted_clinicians_read_measurements" on public.health_measurements;
create policy "patients_and_granted_clinicians_read_measurements"
  on public.health_measurements for select to authenticated
  using (
    patient_id = (select auth.uid())
    or (
      (select public.is_verified_clinician((select auth.uid())))
      and exists (
        select 1
        from public.patient_access_grants as access_grant
        where access_grant.patient_id = health_measurements.patient_id
          and access_grant.clinician_id = (select auth.uid())
          and access_grant.revoked_at is null
          and access_grant.scope ->> 'measurements' = 'true'
      )
    )
  );
