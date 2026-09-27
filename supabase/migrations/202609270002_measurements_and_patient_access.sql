create function public.is_verified_clinician(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinician_verifications as verification
    where verification.user_id = target_user_id
      and verification.verification_status = 'verified'
  );
$$;

revoke all on function public.is_verified_clinician(uuid) from public;
grant execute on function public.is_verified_clinician(uuid) to authenticated;

create table public.patient_access_grants (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  scope jsonb not null default '{"overview": true}'::jsonb check (jsonb_typeof(scope) = 'object'),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (patient_id <> clinician_id)
);

create unique index patient_access_one_active_grant
  on public.patient_access_grants (patient_id, clinician_id)
  where revoked_at is null;

create index patient_access_grants_clinician_active
  on public.patient_access_grants (clinician_id, patient_id)
  where revoked_at is null;

alter table public.patient_access_grants enable row level security;

create policy "patients_and_clinicians_read_their_grants"
  on public.patient_access_grants for select to authenticated
  using (patient_id = (select auth.uid()) or clinician_id = (select auth.uid()));

create policy "patients_grant_verified_clinicians_access"
  on public.patient_access_grants for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and clinician_id <> (select auth.uid())
    and revoked_at is null
    and (select public.is_verified_clinician(clinician_id))
  );

create policy "patients_revoke_their_access_grants"
  on public.patient_access_grants for update to authenticated
  using (patient_id = (select auth.uid()) and revoked_at is null)
  with check (patient_id = (select auth.uid()) and revoked_at is not null);

create function public.protect_patient_access_grant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.patient_id is distinct from old.patient_id
     or new.clinician_id is distinct from old.clinician_id
     or new.scope is distinct from old.scope
     or new.granted_at is distinct from old.granted_at
     or old.revoked_at is not null
     or new.revoked_at is null then
    raise exception 'Patient access grants can only be revoked by the patient';
  end if;

  new.revoked_at := now();
  return new;
end;
$$;

create trigger patient_access_grant_revoke_only
  before update on public.patient_access_grants
  for each row execute function public.protect_patient_access_grant();

grant select, insert, update on public.patient_access_grants to authenticated;

create table public.health_measurements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  metric_definition_id uuid not null references public.metric_definitions (id),
  numeric_value numeric,
  component_values jsonb,
  unit text,
  measured_at timestamptz not null,
  source_kind text not null default 'patient_entry'
    check (source_kind in ('patient_entry', 'clinician_entry', 'document_scan')),
  source_label text,
  entered_by uuid not null references auth.users (id) default auth.uid(),
  supersedes_measurement_id uuid references public.health_measurements (id),
  created_at timestamptz not null default now(),
  check (
    (numeric_value is not null and component_values is null and unit is not null)
    or
    (numeric_value is null and component_values is not null and unit is null and jsonb_typeof(component_values) = 'object')
  ),
  check (
    numeric_value is null
    or numeric_value not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  )
);

create unique index health_measurements_one_correction_per_result
  on public.health_measurements (supersedes_measurement_id)
  where supersedes_measurement_id is not null;

create index health_measurements_patient_metric_time
  on public.health_measurements (patient_id, metric_definition_id, measured_at desc);

alter table public.health_measurements enable row level security;

create policy "patients_and_granted_clinicians_read_measurements"
  on public.health_measurements for select to authenticated
  using (
    patient_id = (select auth.uid())
    or exists (
      select 1
      from public.patient_access_grants as access_grant
      where access_grant.patient_id = health_measurements.patient_id
        and access_grant.clinician_id = (select auth.uid())
        and access_grant.revoked_at is null
    )
  );

create policy "patients_record_their_own_measurements"
  on public.health_measurements for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and entered_by = (select auth.uid())
    and source_kind = 'patient_entry'
    and exists (
      select 1
      from public.metric_definitions as definition
      where definition.id = metric_definition_id
        and definition.is_active
    )
  );

grant select, insert on public.health_measurements to authenticated;

insert into public.metric_definitions (metric_key, version, display_names, value_kind, supported_units, value_shape, is_active)
values
  ('blood_glucose', 1, '{"en":"Blood sugar"}'::jsonb, 'scalar', array['mg/dL', 'mmol/L'], '{"kind":"scalar"}'::jsonb, true),
  ('inr', 1, '{"en":"INR"}'::jsonb, 'scalar', array['INR'], '{"kind":"scalar"}'::jsonb, true)
on conflict (metric_key, version) do nothing;