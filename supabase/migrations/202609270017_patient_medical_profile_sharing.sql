create table public.patient_medical_profiles (
  patient_id uuid primary key references public.profiles (id) on delete cascade,
  date_of_birth date check (date_of_birth is null or date_of_birth <= current_date),
  blood_type text check (blood_type is null or blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  emergency_contact_name text not null default '' check (char_length(trim(emergency_contact_name)) <= 100),
  emergency_contact_relation text not null default '' check (char_length(trim(emergency_contact_relation)) <= 60),
  emergency_contact_phone text not null default '' check (char_length(trim(emergency_contact_phone)) <= 32),
  allergies text[] not null default '{}',
  conditions text[] not null default '{}',
  medications text[] not null default '{}',
  surgeries text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.patient_medical_profiles enable row level security;

create policy "patients_manage_their_medical_profile"
  on public.patient_medical_profiles for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

create policy "granted_clinicians_read_medical_profiles"
  on public.patient_medical_profiles for select to authenticated
  using (
    exists (
      select 1
      from public.patient_access_grants as access_grant
      where access_grant.patient_id = patient_medical_profiles.patient_id
        and access_grant.clinician_id = (select auth.uid())
        and access_grant.revoked_at is null
        and access_grant.scope ->> 'medical_profile' = 'true'
    )
  );

grant select, insert, update, delete on public.patient_medical_profiles to authenticated;

create trigger patient_medical_profiles_set_updated_at
  before update on public.patient_medical_profiles
  for each row execute function public.set_updated_at();

create table public.patient_favorite_clinicians (
  patient_id uuid not null references public.profiles (id) on delete cascade,
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, clinician_id),
  check (patient_id <> clinician_id)
);

alter table public.patient_favorite_clinicians enable row level security;

create policy "patients_manage_their_favorite_clinicians"
  on public.patient_favorite_clinicians for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (
    patient_id = (select auth.uid())
    and (select public.is_verified_clinician(clinician_id))
  );

grant select, insert, delete on public.patient_favorite_clinicians to authenticated;

create policy "patients_see_related_clinician_identity"
  on public.clinician_verifications for select to authenticated
  using (
    exists (
      select 1 from public.patient_access_grants as access_grant
      where access_grant.patient_id = (select auth.uid())
        and access_grant.clinician_id = clinician_verifications.user_id
    )
    or exists (
      select 1 from public.patient_favorite_clinicians as favorite
      where favorite.patient_id = (select auth.uid())
        and favorite.clinician_id = clinician_verifications.user_id
    )
  );

create table public.patient_profile_share_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  clinician_id uuid references public.clinician_verifications (user_id) on delete cascade,
  share_code uuid not null unique default gen_random_uuid(),
  status text not null default 'issued' check (status in ('issued', 'pending', 'approved', 'denied', 'expired')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  claimed_at timestamptz,
  responded_at timestamptz,
  share_medical_profile boolean,
  share_measurements boolean,
  created_at timestamptz not null default now(),
  check (clinician_id is null or clinician_id <> patient_id),
  check (status <> 'pending' or (clinician_id is not null and claimed_at is not null)),
  check (status not in ('approved', 'denied') or responded_at is not null)
);

create index patient_profile_share_requests_patient_pending
  on public.patient_profile_share_requests (patient_id, created_at desc)
  where status = 'pending';

alter table public.patient_profile_share_requests enable row level security;

create function public.create_patient_profile_share_code()
returns table (share_code uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_patient_id uuid := auth.uid();
begin
  if current_patient_id is null then
    raise exception 'Authentication required';
  end if;

  update public.patient_profile_share_requests as request
  set status = 'expired'
  where request.patient_id = current_patient_id
    and request.status = 'issued';

  return query
  insert into public.patient_profile_share_requests (patient_id)
  values (current_patient_id)
  returning patient_profile_share_requests.share_code, patient_profile_share_requests.expires_at;
end;
$$;

create function public.claim_patient_profile_share_code(p_share_code uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_clinician_id uuid := auth.uid();
  request_id uuid;
begin
  if current_clinician_id is null or not public.is_verified_clinician(current_clinician_id) then
    raise exception 'A verified clinician account is required';
  end if;

  update public.patient_profile_share_requests as request
  set clinician_id = current_clinician_id,
      claimed_at = now(),
      status = 'pending'
  where request.share_code = p_share_code
    and request.status = 'issued'
    and request.expires_at > now()
    and request.patient_id <> current_clinician_id
  returning request.id into request_id;

  if request_id is null then
    raise exception 'This share code is invalid, expired, or already used';
  end if;

  return 'pending_patient_confirmation';
end;
$$;

create function public.list_pending_patient_profile_share_requests()
returns table (id uuid, clinician_id uuid, clinician_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select request.id, request.clinician_id, verification.public_name, request.created_at
  from public.patient_profile_share_requests as request
  join public.clinician_verifications as verification on verification.user_id = request.clinician_id
  where request.patient_id = (select auth.uid())
    and request.status = 'pending'
    and verification.verification_status = 'verified'
  order by request.created_at desc;
$$;

create function public.respond_to_patient_profile_share_request(
  p_request_id uuid,
  p_approve boolean,
  p_share_medical_profile boolean default true,
  p_share_measurements boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_request public.patient_profile_share_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_approve and not p_share_medical_profile and not p_share_measurements then
    raise exception 'Choose at least one information category to share';
  end if;

  select * into pending_request
  from public.patient_profile_share_requests
  where id = p_request_id
    and patient_id = auth.uid()
    and status = 'pending'
  for update;

  if pending_request.id is null then
    raise exception 'This access request is no longer available';
  end if;

  if p_approve then
    if not public.is_verified_clinician(pending_request.clinician_id) then
      raise exception 'This clinician is no longer verified';
    end if;
    if exists (
      select 1 from public.patient_access_grants as access_grant
      where access_grant.patient_id = auth.uid()
        and access_grant.clinician_id = pending_request.clinician_id
        and access_grant.revoked_at is null
    ) then
      raise exception 'Revoke the clinician’s current access before approving a new request';
    end if;

    insert into public.patient_access_grants (patient_id, clinician_id, scope)
    values (
      auth.uid(),
      pending_request.clinician_id,
      jsonb_build_object(
        'overview', true,
        'medical_profile', p_share_medical_profile,
        'measurements', p_share_measurements
      )
    );
  end if;

  update public.patient_profile_share_requests
  set status = case when p_approve then 'approved' else 'denied' end,
      responded_at = now(),
      share_medical_profile = case when p_approve then p_share_medical_profile else false end,
      share_measurements = case when p_approve then p_share_measurements else false end
  where id = p_request_id;
end;
$$;

revoke all on function public.create_patient_profile_share_code() from public;
revoke all on function public.claim_patient_profile_share_code(uuid) from public;
revoke all on function public.list_pending_patient_profile_share_requests() from public;
revoke all on function public.respond_to_patient_profile_share_request(uuid, boolean, boolean, boolean) from public;
grant execute on function public.create_patient_profile_share_code() to authenticated;
grant execute on function public.claim_patient_profile_share_code(uuid) to authenticated;
grant execute on function public.list_pending_patient_profile_share_requests() to authenticated;
grant execute on function public.respond_to_patient_profile_share_request(uuid, boolean, boolean, boolean) to authenticated;

drop policy "patients_and_granted_clinicians_read_measurements" on public.health_measurements;
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
        and access_grant.scope ->> 'measurements' = 'true'
    )
  );
