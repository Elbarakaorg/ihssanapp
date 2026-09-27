alter table public.profiles
  drop constraint if exists profiles_profile_type_check;

alter table public.profiles
  add constraint profiles_profile_type_check
  check (profile_type in ('patient', 'clinician'));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  requested_profile_type text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  requested_profile_type := nullif(trim(lower(new.raw_user_meta_data ->> 'profile_type')), '');

  insert into public.profiles (id, display_name, profile_type)
  values (
    new.id,
    coalesce(requested_name, 'New patient'),
    case
      when requested_profile_type in ('patient', 'clinician') then requested_profile_type
      else 'patient'
    end
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        profile_type = excluded.profile_type;

  return new;
end;
$$;
