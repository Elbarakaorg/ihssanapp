-- Rich doctor profile: featured image, gallery, experience/education, owner preview, anonymous sharing.

alter table public.clinician_public_profiles
  add column featured_source text not null default 'account' check (featured_source in ('account', 'upload', 'none')),
  add column featured_image_path text check (featured_image_path is null or featured_image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('doctor-media', 'doctor-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "doctors_manage_own_media" on storage.objects;
create policy "doctors_manage_own_media"
  on storage.objects for all to authenticated
  using (bucket_id = 'doctor-media' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_verified_clinician((select auth.uid())))
  with check (bucket_id = 'doctor-media' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_verified_clinician((select auth.uid())));

-- The account photo lives in a private bucket; let patients and link visitors read it only while the
-- doctor is verified, public, and chose to use it as the featured image.
create function public.is_public_doctor_avatar(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.clinician_public_profiles cp on cp.clinician_id = pr.id
    join public.clinician_verifications v on v.user_id = pr.id
    where pr.avatar_path = p_path and cp.is_public and cp.featured_source = 'account'
      and v.verification_status = 'verified'
  );
$$;
revoke all on function public.is_public_doctor_avatar(text) from public;
grant execute on function public.is_public_doctor_avatar(text) to anon, authenticated;

drop policy if exists "public_doctor_avatars_readable" on storage.objects;
create policy "public_doctor_avatars_readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'profile-photos' and public.is_public_doctor_avatar(name));

create table public.clinician_gallery_images (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  caption text check (caption is null or char_length(caption) <= 140),
  created_at timestamptz not null default now()
);
create index clinician_gallery_images_clinician_idx on public.clinician_gallery_images (clinician_id, created_at);
alter table public.clinician_gallery_images enable row level security;
revoke all on public.clinician_gallery_images from anon, authenticated;

create table public.clinician_experience (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  kind text not null check (kind in ('work', 'education')),
  title text not null check (char_length(title) between 2 and 120),
  organization text not null check (char_length(organization) between 2 and 120),
  location text check (location is null or char_length(location) <= 80),
  start_year smallint not null check (start_year between 1950 and 2100),
  end_year smallint check (end_year is null or end_year between 1950 and 2100),
  description text check (description is null or char_length(description) <= 600),
  position smallint not null default 0,
  check (end_year is null or end_year >= start_year)
);
create index clinician_experience_clinician_idx on public.clinician_experience (clinician_id, position);
alter table public.clinician_experience enable row level security;
revoke all on public.clinician_experience from anon, authenticated;

create function public.set_my_featured_image(p_source text, p_path text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_source not in ('account', 'upload', 'none') then raise exception 'Unknown image source'; end if;
  if p_source = 'upload' and (p_path is null or p_path not like auth.uid()::text || '/%') then
    raise exception 'Upload an image first';
  end if;
  if not public.is_verified_clinician(auth.uid()) then raise exception 'Only verified doctors can edit this'; end if;
  insert into public.clinician_public_profiles (clinician_id, featured_source, featured_image_path)
  values (auth.uid(), p_source, case when p_source = 'upload' then p_path end)
  on conflict (clinician_id) do update
    set featured_source = excluded.featured_source,
        featured_image_path = case when p_source = 'upload' then p_path else public.clinician_public_profiles.featured_image_path end,
        updated_at = now();
end;
$$;

create function public.get_my_media()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'featured_source', coalesce((select featured_source from public.clinician_public_profiles where clinician_id = auth.uid()), 'account'),
    'featured_image_path', (select featured_image_path from public.clinician_public_profiles where clinician_id = auth.uid()),
    'avatar_path', (select avatar_path from public.profiles where id = auth.uid()),
    'gallery', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'path', path, 'caption', caption) order by created_at)
                         from public.clinician_gallery_images where clinician_id = auth.uid()), '[]'::jsonb)
  );
$$;

create function public.add_gallery_image(p_path text, p_caption text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_verified_clinician(auth.uid()) then raise exception 'Only verified doctors can add photos'; end if;
  if p_path is null or p_path not like auth.uid()::text || '/%' then raise exception 'Invalid image'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gallery:' || auth.uid()::text, 0));
  if (select count(*) from public.clinician_gallery_images where clinician_id = auth.uid()) >= 12 then
    raise exception 'You can add up to 12 photos';
  end if;
  insert into public.clinician_gallery_images (clinician_id, path, caption)
  values (auth.uid(), p_path, nullif(trim(coalesce(p_caption, '')), ''))
  returning id into new_id;
  return new_id;
end;
$$;

create function public.delete_gallery_image(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed text;
begin
  delete from public.clinician_gallery_images where id = p_id and clinician_id = auth.uid() returning path into removed;
  if removed is null then raise exception 'Photo not found'; end if;
  return removed;
end;
$$;

create function public.get_my_experience()
returns table (id uuid, kind text, title text, organization text, location text, start_year smallint, end_year smallint, description text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.kind, e.title, e.organization, e.location, e.start_year, e.end_year, e.description
  from public.clinician_experience e where e.clinician_id = auth.uid()
  order by e.kind, e.position;
$$;

create function public.save_my_experience(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.clinician_verifications where user_id = auth.uid()) then
    raise exception 'A clinician account is required';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid experience list'; end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'You can add up to 40 entries'; end if;
  delete from public.clinician_experience where clinician_id = auth.uid();
  insert into public.clinician_experience (clinician_id, kind, title, organization, location, start_year, end_year, description, position)
  select auth.uid(), x.item->>'kind', trim(x.item->>'title'), trim(x.item->>'organization'),
         nullif(trim(coalesce(x.item->>'location', '')), ''), (x.item->>'start_year')::smallint,
         nullif(x.item->>'end_year', '')::smallint, nullif(trim(coalesce(x.item->>'description', '')), ''), (x.ord - 1)::smallint
  from jsonb_array_elements(p_items) with ordinality as x(item, ord);
end;
$$;

create or replace function public.get_doctor_profile(p_clinician_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'clinician_id', v.user_id,
    'name', v.public_name,
    'headline', p.headline,
    'bio', p.bio,
    'specialties', p.specialties,
    'languages', p.languages,
    'years_experience', p.years_experience,
    'is_public', p.is_public,
    'is_preview', not p.is_public,
    'featured_source', p.featured_source,
    'featured_image_path', case when p.featured_source = 'upload' then p.featured_image_path end,
    'avatar_path', case when p.featured_source = 'account' then pr.avatar_path end,
    'gallery', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'path', g.path, 'caption', g.caption) order by g.created_at)
                         from public.clinician_gallery_images g where g.clinician_id = v.user_id), '[]'::jsonb),
    'experience', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'title', e.title, 'organization', e.organization,
                         'location', e.location, 'start_year', e.start_year, 'end_year', e.end_year, 'description', e.description)
                         order by e.kind, e.position)
                         from public.clinician_experience e where e.clinician_id = v.user_id), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'venue_name', l.venue_name, 'venue_kind', l.venue_kind, 'address', l.address, 'city', l.city,
        'latitude', l.latitude, 'longitude', l.longitude, 'google_place_id', l.google_place_id,
        'specialty', l.specialty, 'consultation_modes', l.consultation_modes, 'phone', l.phone, 'schedule', l.schedule,
        'bookable', exists (select 1 from public.clinician_schedule_rules r where r.location_id = l.id)
      ) order by l.venue_name)
      from public.clinician_practice_locations l
      where l.clinician_id = v.user_id and l.status = 'verified'
    ), '[]'::jsonb)
  )
  from public.clinician_verifications v
  join public.clinician_public_profiles p on p.clinician_id = v.user_id
  join public.profiles pr on pr.id = v.user_id
  where v.user_id = p_clinician_id
    and v.verification_status = 'verified'
    and (p.is_public or p_clinician_id = (select auth.uid()));
$$;

-- search results also show the featured photo
drop function public.search_doctors(text, integer);
create function public.search_doctors(p_query text default null, p_limit integer default 20)
returns table (clinician_id uuid, name text, headline text, specialties text[], languages text[], cities text[], image_bucket text, image_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  pattern := '%' || replace(replace(replace(trim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
  select v.user_id, v.public_name, p.headline, p.specialties, p.languages,
         array(select distinct l.city from public.clinician_practice_locations l
               where l.clinician_id = v.user_id and l.status = 'verified' order by 1),
         case p.featured_source when 'upload' then 'doctor-media' when 'account' then 'profile-photos' end,
         case p.featured_source when 'upload' then p.featured_image_path when 'account' then pr.avatar_path end
  from public.clinician_verifications v
  join public.clinician_public_profiles p on p.clinician_id = v.user_id
  join public.profiles pr on pr.id = v.user_id
  where v.verification_status = 'verified'
    and p.is_public
    and exists (select 1 from public.clinician_practice_locations l where l.clinician_id = v.user_id and l.status = 'verified')
    and (char_length(trim(coalesce(p_query, ''))) = 0
         or v.public_name ilike pattern
         or p.headline ilike pattern
         or exists (select 1 from unnest(p.specialties) s where s ilike pattern)
         or exists (select 1 from public.clinician_practice_locations l
                    where l.clinician_id = v.user_id and l.status = 'verified' and l.city ilike pattern))
  order by v.public_name
  limit least(greatest(coalesce(p_limit, 20), 1), 30);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'set_my_featured_image(text,text)', 'get_my_media()', 'add_gallery_image(text,text)', 'delete_gallery_image(uuid)',
    'get_my_experience()', 'save_my_experience(jsonb)', 'search_doctors(text,integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- Public share links work without signing in.
revoke all on function public.get_doctor_profile(uuid) from public;
grant execute on function public.get_doctor_profile(uuid) to anon, authenticated;
