alter table public.profiles
  add column if not exists bio text not null default ''
    check (char_length(trim(bio)) <= 500),
  add column if not exists avatar_path text
    check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9]+\.(jpg|jpeg|png|webp)$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users_manage_own_profile_photos" on storage.objects;
create policy "users_manage_own_profile_photos"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );