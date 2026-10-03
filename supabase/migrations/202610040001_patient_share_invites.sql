-- Patient-issued share codes/links. The patient consents up front to a specific
-- scope; a verified clinician previews the profile and then chooses to save it.

create table public.patient_share_invites (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  code_hash bytea not null unique,
  share_medical_profile boolean not null,
  share_measurements boolean not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.clinician_verifications (user_id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (share_medical_profile or share_measurements)
);

create index patient_share_invites_patient_active
  on public.patient_share_invites (patient_id, created_at desc)
  where used_at is null and revoked_at is null;

create table public.patient_share_code_attempts (
  id bigint generated always as identity primary key,
  clinician_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index patient_share_code_attempts_recent
  on public.patient_share_code_attempts (clinician_id, attempted_at desc);

-- Accessed only through the security definer functions below.
alter table public.patient_share_invites enable row level security;
alter table public.patient_share_code_attempts enable row level security;
revoke all on public.patient_share_invites from anon, authenticated;
revoke all on public.patient_share_code_attempts from anon, authenticated;

create function public.share_code_hash(p_code text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'utf8'));
$$;
revoke all on function public.share_code_hash(text) from public, anon, authenticated;

create function public.create_patient_share_invite(
  p_share_medical_profile boolean default true,
  p_share_measurements boolean default false,
  p_valid_hours integer default 24
)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_patient_id uuid := auth.uid();
  raw_code text;
  new_expiry timestamptz;
begin
  if current_patient_id is null then
    raise exception 'Authentication required';
  end if;
  if not (coalesce(p_share_medical_profile, false) or coalesce(p_share_measurements, false)) then
    raise exception 'Choose at least one information category to share';
  end if;
  if p_valid_hours is null or p_valid_hours < 1 or p_valid_hours > 72 then
    raise exception 'The code must be valid for between 1 and 72 hours';
  end if;

  update public.patient_share_invites as invite
  set revoked_at = now()
  where invite.patient_id = current_patient_id
    and invite.used_at is null
    and invite.revoked_at is null;

  raw_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  new_expiry := now() + make_interval(hours => p_valid_hours);

  insert into public.patient_share_invites (patient_id, code_hash, share_medical_profile, share_measurements, expires_at)
  values (current_patient_id, public.share_code_hash(raw_code), p_share_medical_profile, p_share_measurements, new_expiry);

  return query select substr(raw_code, 1, 4) || '-' || substr(raw_code, 5, 4) || '-' || substr(raw_code, 9, 4), new_expiry;
end;
$$;

create function public.revoke_my_patient_share_invites()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.patient_share_invites
  set revoked_at = now()
  where patient_id = (select auth.uid())
    and used_at is null
    and revoked_at is null;
$$;

create function public.preview_patient_share_invite(p_code text)
returns table (
  patient_name text,
  share_medical_profile boolean,
  share_measurements boolean,
  expires_at timestamptz,
  already_saved boolean,
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
  found_invite public.patient_share_invites%rowtype;
begin
  if current_clinician_id is null or not public.is_verified_clinician(current_clinician_id) then
    raise exception 'A verified clinician account is required';
  end if;

  delete from public.patient_share_code_attempts where attempted_at < now() - interval '1 day';
  if (select count(*) from public.patient_share_code_attempts as attempt
      where attempt.clinician_id = current_clinician_id and attempt.attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many invalid codes. Try again in an hour.';
  end if;

  select * into found_invite
  from public.patient_share_invites as invite
  where invite.code_hash = public.share_code_hash(p_code)
    and invite.used_at is null
    and invite.revoked_at is null
    and invite.expires_at > now()
    and invite.patient_id <> current_clinician_id;

  if found_invite.id is null then
    insert into public.patient_share_code_attempts (clinician_id) values (current_clinician_id);
    return;
  end if;

  return query
  select patient.display_name,
         found_invite.share_medical_profile,
         found_invite.share_measurements,
         found_invite.expires_at,
         exists (
           select 1 from public.patient_access_grants as access_grant
           where access_grant.patient_id = found_invite.patient_id
             and access_grant.clinician_id = current_clinician_id
             and access_grant.revoked_at is null
         ),
         case when found_invite.share_medical_profile then medical.date_of_birth end,
         case when found_invite.share_medical_profile then medical.blood_type end,
         case when found_invite.share_medical_profile then medical.emergency_contact_name end,
         case when found_invite.share_medical_profile then medical.emergency_contact_relation end,
         case when found_invite.share_medical_profile then medical.emergency_contact_phone end,
         case when found_invite.share_medical_profile then medical.allergies end,
         case when found_invite.share_medical_profile then medical.conditions end,
         case when found_invite.share_medical_profile then medical.medications end,
         case when found_invite.share_medical_profile then medical.surgeries end
  from public.profiles as patient
  left join public.patient_medical_profiles as medical on medical.patient_id = patient.id
  where patient.id = found_invite.patient_id;
end;
$$;

create function public.accept_patient_share_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_clinician_id uuid := auth.uid();
  found_invite public.patient_share_invites%rowtype;
  new_scope jsonb;
  grant_id uuid;
begin
  if current_clinician_id is null or not public.is_verified_clinician(current_clinician_id) then
    raise exception 'A verified clinician account is required';
  end if;

  if (select count(*) from public.patient_share_code_attempts as attempt
      where attempt.clinician_id = current_clinician_id and attempt.attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many invalid codes. Try again in an hour.';
  end if;

  select * into found_invite
  from public.patient_share_invites as invite
  where invite.code_hash = public.share_code_hash(p_code)
    and invite.used_at is null
    and invite.revoked_at is null
    and invite.expires_at > now()
    and invite.patient_id <> current_clinician_id
  for update;

  if found_invite.id is null then
    insert into public.patient_share_code_attempts (clinician_id) values (current_clinician_id);
    return null;
  end if;

  new_scope := jsonb_build_object(
    'overview', true,
    'medical_profile', found_invite.share_medical_profile,
    'measurements', found_invite.share_measurements
  );

  update public.patient_access_grants as access_grant
  set scope = new_scope
  where access_grant.patient_id = found_invite.patient_id
    and access_grant.clinician_id = current_clinician_id
    and access_grant.revoked_at is null
  returning access_grant.id into grant_id;

  if grant_id is null then
    insert into public.patient_access_grants (patient_id, clinician_id, scope)
    values (found_invite.patient_id, current_clinician_id, new_scope)
    returning id into grant_id;
  end if;

  update public.patient_share_invites
  set used_at = now(), used_by = current_clinician_id
  where id = found_invite.id;

  return grant_id;
end;
$$;

revoke all on function public.create_patient_share_invite(boolean, boolean, integer) from public, anon;
revoke all on function public.revoke_my_patient_share_invites() from public, anon;
revoke all on function public.preview_patient_share_invite(text) from public, anon;
revoke all on function public.accept_patient_share_invite(text) from public, anon;
grant execute on function public.create_patient_share_invite(boolean, boolean, integer) to authenticated;
grant execute on function public.revoke_my_patient_share_invites() to authenticated;
grant execute on function public.preview_patient_share_invite(text) to authenticated;
grant execute on function public.accept_patient_share_invite(text) to authenticated;
