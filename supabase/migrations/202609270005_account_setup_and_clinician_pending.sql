alter table public.profiles
  add column if not exists setup_completed_at timestamptz;

update public.profiles
set setup_completed_at = created_at
where setup_completed_at is null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  requested_profile_type text;
  setup_timestamp timestamptz;
begin
  requested_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), '')
  );
  requested_profile_type := nullif(trim(lower(new.raw_user_meta_data ->> 'profile_type')), '');

  if requested_profile_type in ('patient', 'clinician') then
    setup_timestamp := now();
  else
    setup_timestamp := null;
  end if;

  insert into public.profiles (id, display_name, profile_type, setup_completed_at)
  values (
    new.id,
    coalesce(requested_name, 'New patient'),
    case
      when requested_profile_type in ('patient', 'clinician') then requested_profile_type
      else 'patient'
    end,
    setup_timestamp
  )
  on conflict (id) do nothing;

  if requested_profile_type = 'clinician' then
    insert into public.clinician_verifications (user_id, public_name, verification_status)
    values (new.id, coalesce(requested_name, 'Clinician'), 'pending')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke update on table public.profiles from authenticated;
grant update (display_name, preferred_locale) on table public.profiles to authenticated;

create or replace function public.complete_account_setup(p_display_name text, p_profile_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_name text := trim(p_display_name);
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 80 then
    raise exception 'Name must be between 2 and 80 characters' using errcode = '22023';
  end if;

  if p_profile_type not in ('patient', 'clinician') then
    raise exception 'Unsupported profile type' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = cleaned_name,
      profile_type = p_profile_type,
      setup_completed_at = now()
  where id = current_user_id
    and setup_completed_at is null;

  if not found then
    raise exception 'Profile setup is already complete or profile is missing' using errcode = '55000';
  end if;

  if p_profile_type = 'clinician' then
    insert into public.clinician_verifications (user_id, public_name, verification_status)
    values (current_user_id, cleaned_name, 'pending')
    on conflict (user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.complete_account_setup(text, text) from public;
grant execute on function public.complete_account_setup(text, text) to authenticated;
