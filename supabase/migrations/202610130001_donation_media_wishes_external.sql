-- Donation cases v3: RIB + account number, readable case URLs (slug), one story field, reels / videos / audio, public well-wishes,
-- "I paid" with payer name, outside (external) donations, and profile management for collectors and beneficiaries.
-- Apply after 202610120001.

-- 1. Bank: separate RIB and account number -----------------------------------------------------------------------------
-- A Moroccan RIB is 24 digits: bank (3) + city (3) + account (16) + key (2). The account number is digits 7-22.
alter table public.donation_bank_accounts add column rib text;
alter table public.donation_bank_accounts alter column account_number drop not null;

create function public.normalize_bank_account() returns trigger language plpgsql set search_path = '' as $$
begin
  new.rib := nullif(regexp_replace(coalesce(new.rib, ''), '\s', '', 'g'), '');
  new.account_number := nullif(trim(coalesce(new.account_number, '')), '');
  if new.rib is not null and new.rib ~ '^[0-9]{24}$' and new.account_number is null then
    new.account_number := substr(new.rib, 7, 16);
  end if;
  return new;
end;
$$;
create trigger donation_bank_accounts_normalize before insert or update on public.donation_bank_accounts
  for each row execute function public.normalize_bank_account();

alter table public.donation_bank_accounts disable trigger donation_bank_accounts_audit;
update public.donation_bank_accounts
set rib = regexp_replace(account_number, '\s', '', 'g'), account_number = substr(regexp_replace(account_number, '\s', '', 'g'), 7, 16)
where regexp_replace(account_number, '\s', '', 'g') ~ '^[0-9]{24}$';
alter table public.donation_bank_accounts enable trigger donation_bank_accounts_audit;

alter table public.donation_bank_accounts
  add constraint donation_bank_accounts_rib_format check (rib is null or rib ~ '^[0-9]{24}$'),
  add constraint donation_bank_accounts_has_number check (rib is not null or account_number is not null);

create or replace function public.donation_bank_json(p_case_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'bank_name', b.bank_name, 'account_holder', b.account_holder,
    'account_number', b.account_number, 'rib', b.rib, 'note', b.note) order by b.created_at), '[]'::jsonb)
  from public.donation_bank_accounts b where b.case_id = p_case_id and b.is_active;
$$;

-- 2. Slug --------------------------------------------------------------------------------------------------------------
create function public.slugify(p_text text) returns text language sql immutable set search_path = '' as $$
  select left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_text, '')), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœ', 'aaaaaaceeeeiiiinooooouuuuyyo'),
    '[^a-z0-9]+', '-', 'g')), 60);
$$;

create function public.unique_case_slug(p_base text, p_exclude uuid default null) returns text language plpgsql security definer set search_path = '' as $$
declare
  base text := coalesce(nullif(trim(both '-' from public.slugify(p_base)), ''), 'case');
  candidate text := base;
  n integer := 1;
begin
  while exists (select 1 from public.donation_cases c where c.slug = candidate and (p_exclude is null or c.id <> p_exclude)) loop
    n := n + 1;
    candidate := left(base, 56) || '-' || n;
  end loop;
  return candidate;
end;
$$;

alter table public.donation_cases add column slug text;

-- 3. One story field ---------------------------------------------------------------------------------------------------
-- bio is now the single story; summary is derived from it for cards and search.
alter table public.donation_cases disable trigger donation_cases_audit;
update public.donation_cases
set bio = left(case when nullif(trim(coalesce(bio, '')), '') is null or bio = summary then summary else summary || E'\n\n' || bio end, 4000);
update public.donation_cases set summary = left(regexp_replace(trim(bio), '\s+', ' ', 'g'), 300);
do $$
declare r record;
begin
  for r in select id, beneficiary_name, title from public.donation_cases where slug is null order by created_at loop
    update public.donation_cases set slug = public.unique_case_slug(coalesce(r.beneficiary_name, r.title), r.id) where id = r.id;
  end loop;
end $$;
alter table public.donation_cases enable trigger donation_cases_audit;

alter table public.donation_cases
  alter column slug set not null,
  add constraint donation_cases_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64
    and slug !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  add constraint donation_cases_slug_unique unique (slug);

-- 4. Pledge columns ----------------------------------------------------------------------------------------------------
alter table public.donation_pledges
  add column payer_name text check (payer_name is null or char_length(trim(payer_name)) between 2 and 80),
  add column paid_marked_at timestamptz,
  add column source text not null default 'platform' check (source in ('platform', 'external')),
  add column received_on date,
  add column created_by uuid references auth.users (id) on delete set null;

-- 5. Videos (Instagram reels and uploads) and audio ---------------------------------------------------------------------
create table public.donation_case_videos (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.donation_cases (id) on delete cascade,
  kind text not null check (kind in ('instagram', 'upload')),
  url text check (url is null or char_length(url) <= 200),
  path text check (path is null or char_length(path) <= 300),
  caption text check (caption is null or char_length(caption) <= 200),
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'instagram' and url is not null and path is null) or (kind = 'upload' and path is not null and url is null))
);
create index donation_case_videos_case on public.donation_case_videos (case_id, sort_order, created_at);
alter table public.donation_case_videos enable row level security;
revoke all on public.donation_case_videos from anon, authenticated;

create table public.donation_case_audio (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.donation_cases (id) on delete cascade,
  path text not null check (char_length(path) between 5 and 300),
  title text check (title is null or char_length(title) <= 120),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 3600),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index donation_case_audio_case on public.donation_case_audio (case_id, created_at);
alter table public.donation_case_audio enable row level security;
revoke all on public.donation_case_audio from anon, authenticated;

create function public.limit_case_extras() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'donation_case_videos' and (select count(*) from public.donation_case_videos where case_id = new.case_id) >= 12 then
    raise exception 'A case can have up to 12 videos';
  end if;
  if tg_table_name = 'donation_case_audio' and (select count(*) from public.donation_case_audio where case_id = new.case_id) >= 5 then
    raise exception 'A case can have up to 5 audio messages';
  end if;
  return new;
end;
$$;
create trigger donation_case_videos_limit before insert on public.donation_case_videos for each row execute function public.limit_case_extras();
create trigger donation_case_audio_limit before insert on public.donation_case_audio for each row execute function public.limit_case_extras();

-- 6. Well-wishes (comments that do not need a donation) ---------------------------------------------------------------
create table public.donation_case_wishes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.donation_cases (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text check (display_name is null or char_length(trim(display_name)) between 2 and 60),
  is_anonymous boolean not null default true,
  body text not null check (char_length(trim(body)) between 2 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  client_hash text,
  created_at timestamptz not null default now()
);
create index donation_case_wishes_case on public.donation_case_wishes (case_id, status, created_at desc);
create index donation_case_wishes_client on public.donation_case_wishes (client_hash, created_at) where client_hash is not null;
alter table public.donation_case_wishes enable row level security;
revoke all on public.donation_case_wishes from anon, authenticated;

-- 7. Storage for videos, audio and case files managed by collectors / beneficiaries ------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('case-videos', 'case-videos', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('case-audio', 'case-audio', true, 10485760, array['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/aac', 'video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function public.can_manage_case_file(object_name text) returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,100}$' then return false; end if;
  return public.can_moderate_case(split_part(object_name, '/', 1)::uuid);
end;
$$;

create policy "case_team_manage_files" on storage.objects for all to authenticated
  using (bucket_id in ('case-media', 'case-videos', 'case-audio') and public.can_manage_case_file(name))
  with check (bucket_id in ('case-media', 'case-videos', 'case-audio') and public.can_manage_case_file(name));

-- 8. Public reads ------------------------------------------------------------------------------------------------------
drop function public.list_donation_cases(text, text, text, text, boolean, text, integer, integer);
create function public.list_donation_cases(
  p_category text default null, p_city text default null, p_status text default 'active', p_search text default null,
  p_urgent boolean default false, p_sort text default 'newest', p_limit integer default 20, p_offset integer default 0
)
returns table (
  id uuid, title text, summary text, city text, category text, category_label text, beneficiary_name text, age integer, goal_mad integer,
  raised_mad integer, donor_count integer, percent integer, status text, is_urgent boolean, photo_path text, published_at timestamptz, slug text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  term text := nullif(trim(coalesce(p_search, '')), '');
begin
  if term is not null then term := '%' || replace(replace(replace(left(term, 80), '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select c.id, c.title, c.summary, c.city, c.category, cat.label_en, c.beneficiary_name, c.age, c.goal_mad, c.raised_mad, c.donor_count,
         least(100, (c.raised_mad::numeric * 100 / c.goal_mad)::integer), c.status, c.is_urgent, c.photo_path, c.published_at, c.slug
  from public.donation_cases c
  left join public.donation_categories cat on cat.slug = c.category
  where c.status in ('published', 'funded')
    and (p_status = 'all' or (p_status = 'funded' and c.status = 'funded') or (p_status not in ('funded', 'all') and c.status = 'published'))
    and (nullif(p_category, '') is null or c.category = p_category)
    and (nullif(p_city, '') is null or c.city = p_city)
    and (not coalesce(p_urgent, false) or c.is_urgent)
    and (term is null or c.title ilike term or c.summary ilike term or c.beneficiary_name ilike term or c.city ilike term or c.slug ilike term)
  order by
    case when p_sort = 'urgent' then c.is_urgent end desc nulls last,
    case when p_sort = 'nearly_funded' then c.raised_mad::numeric / c.goal_mad end desc nulls last,
    case when p_sort = 'least_funded' then c.raised_mad::numeric / c.goal_mad end asc nulls last,
    case when p_sort = 'most_funded' then c.raised_mad end desc nulls last,
    c.published_at desc, c.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.get_donation_case(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.donation_cases;
begin
  select * into c from public.donation_cases where id = p_id;
  if not found then return null; end if;
  if c.status not in ('published', 'funded', 'closed') and not coalesce(public.can_moderate_case(c.id), false) then return null; end if;
  return jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'summary', c.summary, 'bio', c.bio, 'city', c.city, 'age', c.age, 'beneficiary_name', c.beneficiary_name,
    'category', c.category, 'category_label', (select label_en from public.donation_categories where slug = c.category),
    'goal_mad', c.goal_mad, 'raised_mad', c.raised_mad, 'donor_count', c.donor_count, 'status', c.status, 'is_urgent', c.is_urgent,
    'min_donation_mad', c.min_donation_mad, 'photo_path', c.photo_path, 'social_links', c.social_links, 'published_at', c.published_at,
    'contact', case when c.show_contact then jsonb_build_object('phone', c.contact_phone, 'email', c.contact_email) else null end,
    'media', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'path', m.path, 'caption', m.caption) order by m.sort_order, m.created_at), '[]'::jsonb)
              from public.donation_case_media m where m.case_id = c.id),
    'videos', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'kind', v.kind, 'url', v.url, 'path', v.path, 'caption', v.caption) order by v.sort_order, v.created_at), '[]'::jsonb)
               from public.donation_case_videos v where v.case_id = c.id),
    'audio', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'path', a.path, 'title', a.title, 'duration_seconds', a.duration_seconds) order by a.created_at), '[]'::jsonb)
              from public.donation_case_audio a where a.case_id = c.id),
    'can_manage', coalesce(public.can_moderate_case(c.id), false)
  );
end;
$$;

create function public.get_donation_case_by_slug(p_slug text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  found_id uuid;
begin
  select id into found_id from public.donation_cases where slug = lower(trim(coalesce(p_slug, '')));
  if found_id is null then return null; end if;
  return public.get_donation_case(found_id);
end;
$$;

create function public.list_case_wishes(p_case_id uuid, p_limit integer default 30)
returns table (id uuid, display_name text, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.id, case when w.is_anonymous or w.display_name is null then 'Anonymous' else w.display_name end, w.body, w.created_at
  from public.donation_case_wishes w
  join public.donation_cases c on c.id = w.case_id and c.status in ('published', 'funded', 'closed')
  where w.case_id = p_case_id and w.status = 'approved'
  order by w.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create function public.post_case_wish(p_case_id uuid, p_body text, p_display_name text default null, p_is_anonymous boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  client_ip text := nullif(trim(split_part(coalesce(headers ->> 'cf-connecting-ip', headers ->> 'x-real-ip', headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  client text;
  body text := trim(coalesce(p_body, ''));
  name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if not exists (select 1 from public.donation_cases where id = p_case_id and status in ('published', 'funded')) then raise exception 'This case is not open for messages'; end if;
  if char_length(body) not between 2 and 500 then raise exception 'Messages must be 2 to 500 characters'; end if;
  if name is not null and char_length(name) not between 2 and 60 then raise exception 'Name must be 2 to 60 characters'; end if;
  if not coalesce(p_is_anonymous, true) and name is null then raise exception 'Add your name or post anonymously'; end if;
  if client_ip is not null then
    client := public.donation_token_hash('ihssan-ip:' || client_ip);
    if (select count(*) from public.donation_case_wishes where client_hash = client and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Too many messages. Please try again later';
    end if;
  end if;
  if auth.uid() is not null and (select count(*) from public.donation_case_wishes where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many messages. Please try again later';
  end if;
  if (select count(*) from public.donation_case_wishes where case_id = p_case_id and status = 'pending') >= 200 then
    raise exception 'This case has many messages waiting for review. Please try again later';
  end if;
  insert into public.donation_case_wishes (case_id, user_id, display_name, is_anonymous, body, client_hash)
  values (p_case_id, auth.uid(), case when coalesce(p_is_anonymous, true) then null else name end, coalesce(p_is_anonymous, true), body, client);
end;
$$;

-- 9. Orders: payer name, "I paid" and receipt submission ---------------------------------------------------------------
create or replace function public.get_pledge(p_id uuid, p_token text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.donation_pledges;
  c public.donation_cases;
begin
  perform public.expire_stale_pledges();
  select * into p from public.donation_pledges where id = p_id;
  if not found then return null; end if;
  if not (p.token_hash = public.donation_token_hash(p_token) or (auth.uid() is not null and p.donor_user_id = auth.uid())) then return null; end if;
  select * into c from public.donation_cases where id = p.case_id;
  return jsonb_build_object(
    'id', p.id, 'reference', p.reference, 'status', p.status, 'amount_mad', p.amount_mad, 'confirmed_amount_mad', p.confirmed_amount_mad,
    'display_name', p.display_name, 'is_anonymous', p.is_anonymous, 'comment', p.comment, 'expires_at', p.expires_at, 'created_at', p.created_at,
    'receipt_count', cardinality(p.receipt_paths), 'review_note', case when p.status in ('rejected', 'reversed') then p.review_note end,
    'case_id', c.id, 'case_title', c.title, 'case_slug', c.slug,
    'payer_name', p.payer_name, 'paid_marked_at', p.paid_marked_at,
    'banks', case when p.status in ('pledged', 'receipt_submitted', 'expired') then public.donation_bank_json(c.id) else '[]'::jsonb end,
    'can_upload', (p.status in ('pledged', 'receipt_submitted') or (p.status = 'expired' and p.expires_at > now() - interval '7 days')) and cardinality(p.receipt_paths) < 3,
    'can_mark_paid', p.status = 'pledged' or (p.status = 'expired' and p.expires_at > now() - interval '7 days')
  );
end;
$$;

create function public.mark_pledge_paid(p_id uuid, p_token text, p_payer_name text default null, p_note text default null) returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.donation_pledges;
  payer text := nullif(trim(coalesce(p_payer_name, '')), '');
begin
  select * into p from public.donation_pledges where id = p_id for update;
  if not found or not (p.token_hash = public.donation_token_hash(p_token) or (auth.uid() is not null and p.donor_user_id = auth.uid())) then
    raise exception 'Donation order not found';
  end if;
  if not (p.status = 'pledged' or (p.status = 'expired' and p.expires_at > now() - interval '7 days')) then
    raise exception 'This donation order is no longer open';
  end if;
  if payer is null and p.payer_name is null and cardinality(p.receipt_paths) = 0 then
    raise exception 'Write the name of the account you paid from so we can confirm the transfer';
  end if;
  if payer is not null and char_length(payer) not between 2 and 80 then raise exception 'Name must be 2 to 80 characters'; end if;
  update public.donation_pledges
  set status = 'receipt_submitted', payer_name = coalesce(payer, payer_name), paid_marked_at = now(),
      receipt_note = coalesce(left(nullif(trim(coalesce(p_note, '')), ''), 300), receipt_note)
  where id = p.id;
end;
$$;

drop function public.submit_pledge_receipt(uuid, text, text[], text);
create function public.submit_pledge_receipt(p_id uuid, p_token text, p_paths text[], p_note text default null, p_payer_name text default null) returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.donation_pledges;
  path text;
  merged text[];
  payer text := nullif(trim(coalesce(p_payer_name, '')), '');
begin
  select * into p from public.donation_pledges where id = p_id for update;
  if not found or not (p.token_hash = public.donation_token_hash(p_token) or (auth.uid() is not null and p.donor_user_id = auth.uid())) then
    raise exception 'Donation order not found';
  end if;
  if not (p.status in ('pledged', 'receipt_submitted') or (p.status = 'expired' and p.expires_at > now() - interval '7 days')) then
    raise exception 'This donation order is no longer open';
  end if;
  if p_paths is null or cardinality(p_paths) = 0 then raise exception 'Attach your transfer receipt'; end if;
  if payer is not null and char_length(payer) not between 2 and 80 then raise exception 'Name must be 2 to 80 characters'; end if;
  foreach path in array p_paths loop
    if path not like p.id::text || '/%' or not exists (select 1 from storage.objects o where o.bucket_id = 'donation-receipts' and o.name = path) then
      raise exception 'Receipt upload not found. Please try again';
    end if;
  end loop;
  select array(select distinct x from unnest(p.receipt_paths || p_paths) x) into merged;
  if cardinality(merged) > 3 then raise exception 'You can attach up to 3 files'; end if;
  update public.donation_pledges
  set receipt_paths = merged, receipt_uploaded_at = now(), status = 'receipt_submitted',
      receipt_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), receipt_note),
      payer_name = coalesce(payer, payer_name)
  where id = p.id;
end;
$$;

drop function public.list_case_pledges(uuid, text, integer);
create function public.list_case_pledges(p_case_id uuid default null, p_status text default null, p_limit integer default 50)
returns table (
  id uuid, reference text, case_id uuid, case_title text, amount_mad integer, display_name text, is_anonymous boolean, comment text, comment_visible boolean,
  status text, created_at timestamptz, expires_at timestamptz, receipt_paths text[], receipt_note text, receipt_uploaded_at timestamptz,
  confirmed_amount_mad integer, review_note text, reviewed_at timestamptz, donor_contact text,
  payer_name text, paid_marked_at timestamptz, source text, received_on date
)
language plpgsql security definer set search_path = '' as $$
declare
  is_admin boolean := coalesce(public.has_ihssan_permission('donations.review'), false);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_case_id is null and not is_admin then raise exception 'Choose a case'; end if;
  if p_case_id is not null and not public.can_review_case(p_case_id) then raise exception 'You cannot review this case'; end if;
  perform public.expire_stale_pledges();
  return query
  select p.id, p.reference, p.case_id, c.title, p.amount_mad, p.display_name, p.is_anonymous, p.comment, p.comment_visible, p.status, p.created_at, p.expires_at,
         p.receipt_paths, p.receipt_note, p.receipt_uploaded_at, p.confirmed_amount_mad, p.review_note, p.reviewed_at, case when is_admin then p.donor_contact end,
         p.payer_name, p.paid_marked_at, p.source, p.received_on
  from public.donation_pledges p join public.donation_cases c on c.id = p.case_id
  where (p_case_id is null or p.case_id = p_case_id) and (nullif(p_status, '') is null or p.status = p_status)
  order by (p.status = 'receipt_submitted') desc, coalesce(p.receipt_uploaded_at, p.paid_marked_at, p.reviewed_at, p.created_at) desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- 10. External (outside the platform) donations -----------------------------------------------------------------------
create function public.add_external_donation(
  p_case_id uuid, p_amount integer, p_donor_name text default null, p_is_anonymous boolean default false,
  p_received_on date default null, p_note text default null, p_comment text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_ref text;
  new_id uuid;
  name text := nullif(trim(coalesce(p_donor_name, '')), '');
  note text := nullif(trim(coalesce(p_note, '')), '');
  cmt text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_review_case(p_case_id) then raise exception 'You cannot record donations for this case'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000000 then raise exception 'Enter the amount received'; end if;
  if name is not null and char_length(name) not between 2 and 60 then raise exception 'Name must be 2 to 60 characters'; end if;
  if cmt is not null and char_length(cmt) > 300 then raise exception 'Comments can be up to 300 characters'; end if;
  if note is not null and char_length(note) > 500 then raise exception 'Notes can be up to 500 characters'; end if;
  if p_received_on is not null and p_received_on > current_date then raise exception 'The date cannot be in the future'; end if;
  loop
    new_ref := 'EX-' || (select string_agg(substr(alphabet, 1 + floor(random() * 31)::integer, 1), '') from generate_series(1, 7));
    exit when not exists (select 1 from public.donation_pledges where reference = new_ref);
  end loop;
  insert into public.donation_pledges (reference, case_id, token_hash, amount_mad, display_name, is_anonymous, comment, comment_status, comment_visible, status, expires_at,
    confirmed_amount_mad, reviewed_by, reviewed_at, review_note, source, received_on, created_by)
  values (new_ref, p_case_id, public.donation_token_hash(gen_random_uuid()::text), p_amount, name, coalesce(p_is_anonymous, false) or name is null, cmt,
    'approved', cmt is not null, 'confirmed', now(), p_amount, auth.uid(), now(), note, 'external', coalesce(p_received_on, current_date), auth.uid())
  returning id into new_id;
  perform public.recompute_case_total(p_case_id);
  return new_id;
end;
$$;

-- Collectors may also reverse an outside donation they recorded; reversing platform donations stays admin-only.
create or replace function public.review_pledge(p_id uuid, p_decision text, p_amount integer default null, p_note text default null, p_show_comment boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.donation_pledges;
  admin boolean := coalesce(public.has_ihssan_permission('donations.review'), false);
  note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into p from public.donation_pledges where id = p_id for update;
  if not found or not public.can_review_case(p.case_id) then raise exception 'Donation order not found'; end if;
  if p.donor_user_id is not null and p.donor_user_id = auth.uid() and not admin then raise exception 'You cannot review your own donation'; end if;

  if p_decision = 'confirm' then
    if p.status not in ('pledged', 'receipt_submitted', 'expired') then raise exception 'This donation cannot be confirmed'; end if;
    if coalesce(p_amount, p.amount_mad) < 1 or coalesce(p_amount, p.amount_mad) > 10000000 then raise exception 'Enter the amount actually received'; end if;
    update public.donation_pledges
    set status = 'confirmed', confirmed_amount_mad = coalesce(p_amount, p.amount_mad), reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = note,
        comment_status = case when p.comment is null then 'approved' when coalesce(p_show_comment, false) then 'approved' else 'pending' end,
        comment_visible = p.comment is not null and coalesce(p_show_comment, false)
    where id = p.id;
  elsif p_decision = 'reject' then
    if p.status not in ('pledged', 'receipt_submitted', 'expired') then raise exception 'This donation cannot be rejected'; end if;
    if note is null then raise exception 'Add a short reason so the donor understands'; end if;
    update public.donation_pledges set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = note where id = p.id;
  elsif p_decision = 'reverse' then
    if not admin and p.source <> 'external' then raise exception 'Only an administrator can reverse a confirmed donation'; end if;
    if p.status <> 'confirmed' then raise exception 'Only confirmed donations can be reversed'; end if;
    if note is null then raise exception 'Add the reason for reversing'; end if;
    update public.donation_pledges set status = 'reversed', reviewed_by = auth.uid(), reviewed_at = now(), review_note = note where id = p.id;
  elsif p_decision = 'hide_comment' then
    update public.donation_pledges set comment_status = 'hidden', comment_visible = false where id = p.id;
  else
    raise exception 'Unknown decision';
  end if;
  perform public.recompute_case_total(p.case_id);
end;
$$;

-- 11. Comment moderation covers donation comments and well-wishes -------------------------------------------------------
drop function public.list_case_comments(uuid, text, integer);
create function public.list_case_comments(p_case_id uuid default null, p_status text default 'pending', p_limit integer default 100)
returns table (id uuid, reference text, case_id uuid, case_title text, display_name text, is_anonymous boolean, comment text, comment_status text, amount_mad integer, confirmed_at timestamptz, kind text)
language plpgsql stable security definer set search_path = '' as $$
declare
  is_admin boolean := coalesce(public.has_ihssan_permission('donations.review'), false);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_case_id is null and not is_admin then raise exception 'Choose a case'; end if;
  if p_case_id is not null and not public.can_moderate_case(p_case_id) then raise exception 'You cannot moderate this case'; end if;
  return query
  select * from (
    select p.id, p.reference, p.case_id, c.title as case_title, p.display_name, p.is_anonymous, p.comment, p.comment_status, p.confirmed_amount_mad as amount_mad,
           p.reviewed_at as at, 'donation'::text as kind
    from public.donation_pledges p join public.donation_cases c on c.id = p.case_id
    where p.status = 'confirmed' and p.comment is not null and (p_case_id is null or p.case_id = p_case_id)
      and (nullif(p_status, '') is null or p.comment_status = p_status)
    union all
    select w.id, null::text, w.case_id, c.title, w.display_name, w.is_anonymous, w.body, w.status, null::integer, w.created_at, 'wish'::text
    from public.donation_case_wishes w join public.donation_cases c on c.id = w.case_id
    where (p_case_id is null or w.case_id = p_case_id) and (nullif(p_status, '') is null or w.status = p_status)
  ) u
  order by u.at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.bulk_review_comments(p_ids uuid[], p_decision text) returns integer language plpgsql security definer set search_path = '' as $$
declare
  changed integer := 0;
  more integer := 0;
  row_case uuid;
  new_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approve', 'hide') then raise exception 'Unknown decision'; end if;
  if coalesce(cardinality(p_ids), 0) = 0 or cardinality(p_ids) > 200 then raise exception 'Select between 1 and 200 comments'; end if;
  new_status := case p_decision when 'approve' then 'approved' else 'hidden' end;
  for row_case in
    select p.case_id from public.donation_pledges p where p.id = any (p_ids)
    union select w.case_id from public.donation_case_wishes w where w.id = any (p_ids)
  loop
    if not public.can_moderate_case(row_case) then raise exception 'You cannot moderate one of the selected cases'; end if;
  end loop;
  update public.donation_pledges set comment_status = new_status, comment_visible = (new_status = 'approved')
  where id = any (p_ids) and status = 'confirmed' and comment is not null;
  get diagnostics changed = row_count;
  update public.donation_case_wishes set status = new_status where id = any (p_ids);
  get diagnostics more = row_count;
  return changed + more;
end;
$$;

-- Analytics and "your cases" count waiting well-wishes as pending comments, and analytics also reports outside donations.
alter function public.donation_analytics(uuid, integer) rename to donation_analytics_base;
revoke all on function public.donation_analytics_base(uuid, integer) from public, anon, authenticated;
create function public.donation_analytics(p_case_id uuid default null, p_days integer default 30) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb := public.donation_analytics_base(p_case_id, p_days);
  extra_wishes integer;
  external_mad bigint;
  external_count integer;
begin
  select count(*) into extra_wishes from public.donation_case_wishes w where w.status = 'pending' and (p_case_id is null or w.case_id = p_case_id);
  select coalesce(sum(p.confirmed_amount_mad), 0), count(*) into external_mad, external_count
  from public.donation_pledges p where p.status = 'confirmed' and p.source = 'external' and (p_case_id is null or p.case_id = p_case_id);
  result := jsonb_set(result, '{pledges,pending_comments}', to_jsonb(coalesce((result #>> '{pledges,pending_comments}')::integer, 0) + extra_wishes));
  result := jsonb_set(result, '{pledges,external_mad}', to_jsonb(external_mad));
  result := jsonb_set(result, '{pledges,external_count}', to_jsonb(external_count));
  return result;
end;
$$;

alter function public.list_my_collector_cases() rename to list_my_collector_cases_base;
revoke all on function public.list_my_collector_cases_base() from public, anon, authenticated;
create function public.list_my_collector_cases() returns table (id uuid, title text, status text, goal_mad integer, raised_mad integer, donor_count integer, awaiting_review integer, role text, pending_comments integer, slug text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  select b.id, b.title, b.status, b.goal_mad, b.raised_mad, b.donor_count, b.awaiting_review, b.role,
         b.pending_comments + (select count(*)::integer from public.donation_case_wishes w where w.case_id = b.id and w.status = 'pending'),
         c.slug
  from public.list_my_collector_cases_base() b join public.donation_cases c on c.id = b.id;
end;
$$;

-- 12. Case profile management for collectors and beneficiaries ---------------------------------------------------------
create function public.update_case_profile(p_case_id uuid, p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.donation_cases;
  new_bio text;
  new_title text;
  new_photo text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_moderate_case(p_case_id) then raise exception 'You cannot edit this case'; end if;
  select * into c from public.donation_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;

  new_bio := case when p ? 'bio' then nullif(trim(p ->> 'bio'), '') else c.bio end;
  if new_bio is null or char_length(new_bio) not between 20 and 4000 then raise exception 'The story must be 20 to 4000 characters'; end if;
  new_title := case when p ? 'title' then trim(coalesce(p ->> 'title', '')) else c.title end;
  if char_length(new_title) not between 3 and 120 then raise exception 'The title must be 3 to 120 characters'; end if;
  new_photo := case when p ? 'photo_path' then nullif(p ->> 'photo_path', '') else c.photo_path end;
  if new_photo is not null and (new_photo not like p_case_id::text || '/%' or new_photo !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'Invalid photo';
  end if;

  update public.donation_cases set
    title = new_title, bio = new_bio, summary = left(regexp_replace(new_bio, '\s+', ' ', 'g'), 300), photo_path = new_photo,
    city = case when p ? 'city' then nullif(trim(p ->> 'city'), '') else city end,
    age = case when p ? 'age' then nullif(p ->> 'age', '')::integer else age end,
    beneficiary_name = case when p ? 'beneficiary_name' then nullif(trim(p ->> 'beneficiary_name'), '') else beneficiary_name end,
    social_links = case when p ? 'social_links' then public.validate_social_links(p -> 'social_links') else social_links end,
    contact_phone = case when p ? 'contact_phone' then nullif(trim(p ->> 'contact_phone'), '') else contact_phone end,
    contact_email = case when p ? 'contact_email' then nullif(trim(p ->> 'contact_email'), '') else contact_email end,
    show_contact = case when p ? 'show_contact' then coalesce((p ->> 'show_contact')::boolean, false) else show_contact end
  where id = p_case_id;
end;
$$;

create function public.add_case_media(p_case_id uuid, p_path text, p_caption text default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if auth.uid() is null or not public.can_moderate_case(p_case_id) then raise exception 'You cannot edit this case'; end if;
  if p_path is null or p_path not like p_case_id::text || '/%' or not exists (select 1 from storage.objects o where o.bucket_id = 'case-media' and o.name = p_path) then
    raise exception 'Upload not found. Please try again';
  end if;
  insert into public.donation_case_media (case_id, path, caption, sort_order)
  values (p_case_id, p_path, left(nullif(trim(coalesce(p_caption, '')), ''), 300), (select coalesce(max(sort_order), 0) + 1 from public.donation_case_media where case_id = p_case_id))
  returning id into new_id;
  return new_id;
end;
$$;

create function public.delete_case_media(p_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare
  m public.donation_case_media;
begin
  select * into m from public.donation_case_media where id = p_id;
  if not found or auth.uid() is null or not public.can_moderate_case(m.case_id) then raise exception 'Photo not found'; end if;
  delete from public.donation_case_media where id = p_id;
  return m.path;
end;
$$;

create function public.add_case_video(p_case_id uuid, p_kind text, p_value text, p_caption text default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  parts text[];
  clean text;
  caption text := left(nullif(trim(coalesce(p_caption, '')), ''), 200);
  next_order integer := (select coalesce(max(sort_order), 0) + 1 from public.donation_case_videos where case_id = p_case_id);
begin
  if auth.uid() is null or not public.can_moderate_case(p_case_id) then raise exception 'You cannot edit this case'; end if;
  if p_kind = 'instagram' then
    clean := split_part(split_part(trim(coalesce(p_value, '')), '#', 1), '?', 1);
    parts := regexp_match(clean, '^https://(?:www\.)?instagram\.com/(?:[A-Za-z0-9._]{1,30}/)?(reel|p|tv)/([A-Za-z0-9_-]{5,40})/?$');
    if parts is null then raise exception 'Paste a public Instagram reel or post link, for example https://www.instagram.com/reel/AbCdEfG/'; end if;
    insert into public.donation_case_videos (case_id, kind, url, caption, sort_order, created_by)
    values (p_case_id, 'instagram', 'https://www.instagram.com/' || parts[1] || '/' || parts[2] || '/', caption, next_order, auth.uid()) returning id into new_id;
  elsif p_kind = 'upload' then
    if p_value is null or p_value not like p_case_id::text || '/%' or not exists (select 1 from storage.objects o where o.bucket_id = 'case-videos' and o.name = p_value) then
      raise exception 'Upload not found. Please try again';
    end if;
    insert into public.donation_case_videos (case_id, kind, path, caption, sort_order, created_by)
    values (p_case_id, 'upload', p_value, caption, next_order, auth.uid()) returning id into new_id;
  else
    raise exception 'Unknown video type';
  end if;
  return new_id;
end;
$$;

create function public.delete_case_video(p_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.donation_case_videos;
begin
  select * into v from public.donation_case_videos where id = p_id;
  if not found or auth.uid() is null or not public.can_moderate_case(v.case_id) then raise exception 'Video not found'; end if;
  delete from public.donation_case_videos where id = p_id;
  return v.path;
end;
$$;

create function public.add_case_audio(p_case_id uuid, p_path text, p_title text default null, p_duration integer default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if auth.uid() is null or not public.can_moderate_case(p_case_id) then raise exception 'You cannot edit this case'; end if;
  if p_path is null or p_path not like p_case_id::text || '/%' or not exists (select 1 from storage.objects o where o.bucket_id = 'case-audio' and o.name = p_path) then
    raise exception 'Upload not found. Please try again';
  end if;
  insert into public.donation_case_audio (case_id, path, title, duration_seconds, created_by)
  values (p_case_id, p_path, left(nullif(trim(coalesce(p_title, '')), ''), 120), case when p_duration between 0 and 3600 then p_duration end, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create function public.delete_case_audio(p_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare
  a public.donation_case_audio;
begin
  select * into a from public.donation_case_audio where id = p_id;
  if not found or auth.uid() is null or not public.can_moderate_case(a.case_id) then raise exception 'Audio not found'; end if;
  delete from public.donation_case_audio where id = p_id;
  return a.path;
end;
$$;

-- 13. Admin save: single story, slug --------------------------------------------------------------------------------------
create or replace function public.admin_save_donation_case(p jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_case_id uuid := nullif(p ->> 'id', '')::uuid;
  new_status text := coalesce(nullif(p ->> 'status', ''), 'draft');
  cleaned_links jsonb := public.validate_social_links(p -> 'social_links');
  story text := nullif(trim(coalesce(p ->> 'bio', '')), '');
  wanted_slug text := nullif(public.slugify(p ->> 'slug'), '');
  existing public.donation_cases;
begin
  if not coalesce(public.has_ihssan_permission('donations.review'), false) then raise exception 'You do not have permission to manage cases'; end if;
  if new_status not in ('draft', 'published', 'closed') then raise exception 'Invalid status'; end if;
  if story is null or char_length(story) not between 20 and 4000 then raise exception 'The story must be 20 to 4000 characters'; end if;
  if v_case_id is not null then
    select * into existing from public.donation_cases where id = v_case_id;
    if not found then raise exception 'Case not found'; end if;
  end if;
  if new_status = 'published' and (v_case_id is null or not exists (select 1 from public.donation_bank_accounts where donation_bank_accounts.case_id = v_case_id and donation_bank_accounts.is_active)) then
    raise exception 'Add an active bank account before publishing';
  end if;
  if wanted_slug is not null and exists (select 1 from public.donation_cases c where c.slug = wanted_slug and (v_case_id is null or c.id <> v_case_id)) then
    raise exception 'This link name is already used by another case';
  end if;

  if v_case_id is null then
    insert into public.donation_cases (title, summary, slug, city, goal_mad, status, category, beneficiary_name, age, bio, photo_path, initial_raised_mad, min_donation_mad,
      is_urgent, social_links, contact_phone, contact_email, show_contact, verification_note)
    values (p ->> 'title', left(regexp_replace(story, '\s+', ' ', 'g'), 300),
      coalesce(wanted_slug, public.unique_case_slug(coalesce(nullif(trim(p ->> 'beneficiary_name'), ''), p ->> 'title'))),
      nullif(trim(p ->> 'city'), ''), (p ->> 'goal_mad')::integer, 'draft', nullif(p ->> 'category', ''),
      nullif(trim(p ->> 'beneficiary_name'), ''), nullif(p ->> 'age', '')::integer, story, nullif(p ->> 'photo_path', ''),
      coalesce(nullif(p ->> 'initial_raised_mad', '')::integer, 0), coalesce(nullif(p ->> 'min_donation_mad', '')::integer, 20),
      coalesce((p ->> 'is_urgent')::boolean, false), cleaned_links, nullif(trim(p ->> 'contact_phone'), ''), nullif(trim(p ->> 'contact_email'), ''),
      coalesce((p ->> 'show_contact')::boolean, false), nullif(trim(p ->> 'verification_note'), ''))
    returning id into v_case_id;
  else
    update public.donation_cases set
      title = p ->> 'title', summary = left(regexp_replace(story, '\s+', ' ', 'g'), 300), slug = coalesce(wanted_slug, slug),
      city = nullif(trim(p ->> 'city'), ''), goal_mad = (p ->> 'goal_mad')::integer,
      category = nullif(p ->> 'category', ''), beneficiary_name = nullif(trim(p ->> 'beneficiary_name'), ''), age = nullif(p ->> 'age', '')::integer,
      bio = story, photo_path = nullif(p ->> 'photo_path', ''),
      initial_raised_mad = coalesce(nullif(p ->> 'initial_raised_mad', '')::integer, 0), min_donation_mad = coalesce(nullif(p ->> 'min_donation_mad', '')::integer, 20),
      is_urgent = coalesce((p ->> 'is_urgent')::boolean, false), social_links = cleaned_links,
      contact_phone = nullif(trim(p ->> 'contact_phone'), ''), contact_email = nullif(trim(p ->> 'contact_email'), ''),
      show_contact = coalesce((p ->> 'show_contact')::boolean, false), verification_note = nullif(trim(p ->> 'verification_note'), '')
    where id = v_case_id;
  end if;

  if new_status = 'published' then
    update public.donation_cases set status = case when status = 'funded' then 'funded' else 'published' end, reviewed_by = auth.uid(), published_at = coalesce(published_at, now())
    where id = v_case_id;
  elsif new_status = 'closed' then
    update public.donation_cases set status = 'closed' where id = v_case_id;
  else
    update public.donation_cases set status = 'draft' where id = v_case_id and status <> 'draft';
  end if;
  perform public.recompute_case_total(v_case_id);
  return v_case_id;
end;
$$;

-- 14. Grants -----------------------------------------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'list_donation_cases(text,text,text,text,boolean,text,integer,integer)', 'get_donation_case(uuid)', 'get_donation_case_by_slug(text)',
    'list_case_wishes(uuid,integer)', 'post_case_wish(uuid,text,text,boolean)', 'get_pledge(uuid,text)', 'mark_pledge_paid(uuid,text,text,text)',
    'submit_pledge_receipt(uuid,text,text[],text,text)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'list_case_pledges(uuid,text,integer)', 'list_case_comments(uuid,text,integer)', 'bulk_review_comments(uuid[],text)', 'review_pledge(uuid,text,integer,text,boolean)',
    'add_external_donation(uuid,integer,text,boolean,date,text,text)', 'donation_analytics(uuid,integer)', 'list_my_collector_cases()',
    'update_case_profile(uuid,jsonb)', 'add_case_media(uuid,text,text)', 'delete_case_media(uuid)', 'add_case_video(uuid,text,text,text)', 'delete_case_video(uuid)',
    'add_case_audio(uuid,text,text,integer)', 'delete_case_audio(uuid)', 'admin_save_donation_case(jsonb)', 'can_manage_case_file(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  revoke all on function public.slugify(text) from public, anon, authenticated;
  revoke all on function public.unique_case_slug(text, uuid) from public, anon, authenticated;
  revoke all on function public.donation_bank_json(uuid) from public, anon, authenticated;
end $$;

-- Accepting a second invitation for a case you already belong to upgrades your role (collector > beneficiary)
-- instead of silently using up the link.
create or replace function public.accept_collector_invite(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv public.donation_collector_invites;
  existing public.donation_case_collectors;
  final_role text;
begin
  if auth.uid() is null then raise exception 'Sign in to accept this invitation'; end if;
  select * into inv from public.donation_collector_invites where token_hash = public.donation_token_hash(p_token) for update;
  if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at < now() then raise exception 'This invitation is invalid or has expired'; end if;
  select * into existing from public.donation_case_collectors where case_id = inv.case_id and user_id = auth.uid() and revoked_at is null for update;
  if not found then
    insert into public.donation_case_collectors (case_id, user_id, label, granted_by, role) values (inv.case_id, auth.uid(), inv.label, inv.created_by, inv.role);
    final_role := inv.role;
  elsif existing.role = 'beneficiary' and inv.role = 'collector' then
    update public.donation_case_collectors set role = 'collector' where id = existing.id;
    final_role := 'collector';
  else
    final_role := existing.role;
  end if;
  update public.donation_collector_invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return jsonb_build_object('case_id', inv.case_id, 'case_title', (select title from public.donation_cases where id = inv.case_id), 'role', final_role);
end;
$$;
