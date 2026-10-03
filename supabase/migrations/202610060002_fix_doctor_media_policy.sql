-- is_verified_clinician(uuid) is intentionally not executable by signed-in users, but storage
-- policies run as the caller. Use a no-argument helper that only answers for the caller.
create or replace function public.am_i_verified_clinician()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_verified_clinician(auth.uid());
$$;
revoke all on function public.am_i_verified_clinician() from public, anon;
grant execute on function public.am_i_verified_clinician() to authenticated;

drop policy if exists "doctors_manage_own_media" on storage.objects;
create policy "doctors_manage_own_media"
  on storage.objects for all to authenticated
  using (bucket_id = 'doctor-media' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.am_i_verified_clinician()))
  with check (bucket_id = 'doctor-media' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.am_i_verified_clinician()));
