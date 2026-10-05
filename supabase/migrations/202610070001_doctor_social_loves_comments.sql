-- Doctor social links, "loves" (one per signed-in person) and moderated comments.

alter table public.clinician_public_profiles
  add column social_links jsonb not null default '[]'::jsonb check (jsonb_typeof(social_links) = 'array' and jsonb_array_length(social_links) <= 8),
  add column comments_enabled boolean not null default true;

create table public.clinician_loves (
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clinician_id, user_id)
);
create index clinician_loves_user_idx on public.clinician_loves (user_id);
alter table public.clinician_loves enable row level security;
revoke all on public.clinician_loves from anon, authenticated;

create table public.clinician_comments (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.clinician_verifications (user_id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 600),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinician_id, author_id)
);
create index clinician_comments_doctor_idx on public.clinician_comments (clinician_id, created_at desc);
alter table public.clinician_comments enable row level security;
revoke all on public.clinician_comments from anon, authenticated;

create function public.get_my_engagement()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'social_links', coalesce((select social_links from public.clinician_public_profiles where clinician_id = auth.uid()), '[]'::jsonb),
    'comments_enabled', coalesce((select comments_enabled from public.clinician_public_profiles where clinician_id = auth.uid()), true),
    'love_count', (select count(*) from public.clinician_loves where clinician_id = auth.uid())
  );
$$;

create function public.set_my_engagement(p_social_links jsonb, p_comments_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned jsonb;
begin
  if not public.is_verified_clinician(auth.uid()) then raise exception 'Only verified doctors can edit this'; end if;
  if jsonb_typeof(coalesce(p_social_links, '[]'::jsonb)) <> 'array' then raise exception 'Invalid links'; end if;
  if jsonb_array_length(coalesce(p_social_links, '[]'::jsonb)) > 8 then raise exception 'You can add up to 8 links'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_social_links, '[]'::jsonb)) x(item)
    where jsonb_typeof(x.item) <> 'object'
       or x.item->>'kind' is null or x.item->>'kind' not in ('website', 'instagram', 'facebook', 'linkedin', 'x', 'youtube', 'tiktok')
       or x.item->>'url' is null or char_length(x.item->>'url') > 200
       or x.item->>'url' !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^\s<>"'']*)?$'
  ) then
    raise exception 'Links must be full https:// addresses';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.item->>'kind', 'url', x.item->>'url') order by x.ord), '[]'::jsonb)
    into cleaned from jsonb_array_elements(coalesce(p_social_links, '[]'::jsonb)) with ordinality x(item, ord);
  insert into public.clinician_public_profiles (clinician_id, social_links, comments_enabled)
  values (auth.uid(), cleaned, coalesce(p_comments_enabled, true))
  on conflict (clinician_id) do update
    set social_links = excluded.social_links, comments_enabled = excluded.comments_enabled, updated_at = now();
end;
$$;

-- Public counters and the viewer's own state; used by the public profile and the doctor list.
create function public.get_doctor_engagement(p_clinician_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'love_count', (select count(*) from public.clinician_loves where clinician_id = p_clinician_id),
    'loved_by_me', exists (select 1 from public.clinician_loves where clinician_id = p_clinician_id and user_id = auth.uid()),
    'comments_enabled', p.comments_enabled,
    'comment_count', (select count(*) from public.clinician_comments where clinician_id = p_clinician_id and not is_hidden)
  )
  from public.clinician_public_profiles p
  join public.clinician_verifications v on v.user_id = p.clinician_id and v.verification_status = 'verified'
  where p.clinician_id = p_clinician_id and (p.is_public or p_clinician_id = auth.uid());
$$;

create function public.toggle_doctor_love(p_clinician_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  if auth.uid() is null then raise exception 'Sign in to show some love'; end if;
  if p_clinician_id = auth.uid() then raise exception 'You cannot love your own profile'; end if;
  if not exists (
    select 1 from public.clinician_public_profiles p
    join public.clinician_verifications v on v.user_id = p.clinician_id and v.verification_status = 'verified'
    where p.clinician_id = p_clinician_id and p.is_public
  ) then raise exception 'This doctor is not available'; end if;
  delete from public.clinician_loves where clinician_id = p_clinician_id and user_id = auth.uid();
  get diagnostics removed = row_count;
  if removed = 0 then
    insert into public.clinician_loves (clinician_id, user_id) values (p_clinician_id, auth.uid());
  end if;
  return jsonb_build_object('loved', removed = 0, 'love_count', (select count(*) from public.clinician_loves where clinician_id = p_clinician_id));
end;
$$;

create function public.list_doctor_comments(p_clinician_id uuid, p_limit integer default 20)
returns table (id uuid, author_name text, body text, created_at timestamptz, had_visit boolean, is_mine boolean, is_hidden boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         split_part(trim(pr.display_name), ' ', 1)
           || case when position(' ' in trim(pr.display_name)) > 0 then ' ' || left(regexp_replace(trim(pr.display_name), '^.* ', ''), 1) || '.' else '' end,
         c.body, c.created_at,
         exists (select 1 from public.appointments a where a.clinician_id = c.clinician_id and a.patient_id = c.author_id and a.status in ('confirmed', 'completed')),
         coalesce(c.author_id = auth.uid(), false),
         c.is_hidden
  from public.clinician_comments c
  join public.profiles pr on pr.id = c.author_id
  join public.clinician_public_profiles p on p.clinician_id = c.clinician_id
  join public.clinician_verifications v on v.user_id = c.clinician_id and v.verification_status = 'verified'
  where c.clinician_id = p_clinician_id
    and (p.is_public or p_clinician_id = auth.uid())
    and (p.comments_enabled or p_clinician_id = auth.uid())
    and (not c.is_hidden or c.author_id = auth.uid() or p_clinician_id = auth.uid())
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create function public.upsert_doctor_comment(p_clinician_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to leave a comment'; end if;
  if p_clinician_id = auth.uid() then raise exception 'You cannot comment on your own profile'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 3 and 600 then raise exception 'Write between 3 and 600 characters'; end if;
  if not exists (
    select 1 from public.clinician_public_profiles p
    join public.clinician_verifications v on v.user_id = p.clinician_id and v.verification_status = 'verified'
    where p.clinician_id = p_clinician_id and p.is_public and p.comments_enabled
  ) then raise exception 'Comments are closed for this doctor'; end if;
  if (select count(*) from public.clinician_comments where author_id = auth.uid() and updated_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily comment limit reached';
  end if;
  -- Editing keeps the doctor's hide/show decision.
  insert into public.clinician_comments (clinician_id, author_id, body)
  values (p_clinician_id, auth.uid(), trim(p_body))
  on conflict (clinician_id, author_id) do update set body = excluded.body, updated_at = now();
end;
$$;

create function public.delete_my_doctor_comment(p_clinician_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.clinician_comments where clinician_id = p_clinician_id and author_id = auth.uid();
$$;

create function public.set_comment_hidden(p_comment_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clinician_comments set is_hidden = coalesce(p_hidden, true)
  where id = p_comment_id and clinician_id = auth.uid();
  if not found then raise exception 'Comment not found'; end if;
end;
$$;

-- Keep the existing builder as an internal helper and layer the new fields on top.
alter function public.get_doctor_profile(uuid) rename to get_doctor_profile_base;

create function public.get_doctor_profile(p_clinician_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select b.profile
         || jsonb_build_object('social_links', (select p.social_links from public.clinician_public_profiles p where p.clinician_id = p_clinician_id))
         || coalesce(public.get_doctor_engagement(p_clinician_id), '{}'::jsonb)
  from (select public.get_doctor_profile_base(p_clinician_id) as profile) b
  where b.profile is not null;
$$;

drop function public.search_doctors(text, integer);
create function public.search_doctors(p_query text default null, p_limit integer default 20)
returns table (clinician_id uuid, name text, headline text, specialties text[], languages text[], cities text[], image_bucket text, image_path text, love_count bigint)
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
         case p.featured_source when 'upload' then p.featured_image_path when 'account' then pr.avatar_path end,
         (select count(*) from public.clinician_loves lv where lv.clinician_id = v.user_id)
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
    'get_my_engagement()', 'set_my_engagement(jsonb,boolean)', 'toggle_doctor_love(uuid)', 'upsert_doctor_comment(uuid,text)',
    'delete_my_doctor_comment(uuid)', 'set_comment_hidden(uuid,boolean)', 'search_doctors(text,integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- Readable without signing in so shared links show counts and comments.
revoke all on function public.get_doctor_engagement(uuid) from public;
revoke all on function public.list_doctor_comments(uuid, integer) from public;
revoke all on function public.get_doctor_profile(uuid) from public;
revoke all on function public.get_doctor_profile_base(uuid) from public, anon, authenticated;
grant execute on function public.get_doctor_engagement(uuid) to anon, authenticated;
grant execute on function public.list_doctor_comments(uuid, integer) to anon, authenticated;
grant execute on function public.get_doctor_profile(uuid) to anon, authenticated;
