alter table public.profiles
  add column if not exists profile_type text not null default 'patient'
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

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
