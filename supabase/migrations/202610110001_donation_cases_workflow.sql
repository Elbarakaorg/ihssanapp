-- Donation cases with donation orders (pledges), receipts, fund collectors and a public wall.
-- Money moves directly from donors to the case's bank account. Ihssan only records and confirms it.

-- 1. Categories --------------------------------------------------------------------------------------------------------
create table public.donation_categories (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  label_en text not null,
  label_ar text not null,
  label_fr text not null,
  sort_order integer not null default 100
);
alter table public.donation_categories enable row level security;
create policy "categories_readable" on public.donation_categories for select to anon, authenticated using (true);
revoke all on public.donation_categories from anon, authenticated;
grant select on public.donation_categories to anon, authenticated;

insert into public.donation_categories (slug, label_en, label_ar, label_fr, sort_order) values
  ('cancer', 'Cancer', 'السرطان', 'Cancer', 10),
  ('diabetes', 'Diabetes', 'السكري', 'Diabète', 20),
  ('lungs', 'Lungs & breathing', 'الرئة والتنفس', 'Poumons et respiration', 30),
  ('kidney', 'Kidney disease', 'أمراض الكلى', 'Maladies rénales', 40),
  ('heart', 'Heart disease', 'أمراض القلب', 'Maladies cardiaques', 50),
  ('surgery', 'Surgery', 'عملية جراحية', 'Chirurgie', 60),
  ('medication', 'Medication & treatment', 'الدواء والعلاج', 'Médicaments et traitement', 70),
  ('disability', 'Disability & mobility', 'الإعاقة والحركة', 'Handicap et mobilité', 80),
  ('down_syndrome_carer', 'Down syndrome carer', 'راعٍ لطفل بمتلازمة داون', 'Aidant d''un enfant trisomique', 90),
  ('special_needs_carer', 'Special-needs carer', 'راعٍ لطفل ذي احتياجات خاصة', 'Aidant d''un enfant à besoins spécifiques', 100),
  ('widow', 'Widow', 'أرملة', 'Veuve', 110),
  ('orphan', 'Orphan care', 'كفالة يتيم', 'Prise en charge d''orphelin', 120),
  ('elderly', 'Elderly care', 'رعاية كبار السن', 'Soins aux personnes âgées', 130),
  ('other', 'Other', 'أخرى', 'Autre', 999);

-- 2. Case profile ------------------------------------------------------------------------------------------------------
alter table public.donation_cases
  add column category text references public.donation_categories (slug),
  add column beneficiary_name text check (beneficiary_name is null or char_length(trim(beneficiary_name)) between 2 and 80),
  add column age integer check (age is null or age between 0 and 120),
  add column bio text check (bio is null or char_length(bio) <= 4000),
  add column photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  add column initial_raised_mad integer not null default 0 check (initial_raised_mad >= 0),
  add column donor_count integer not null default 0 check (donor_count >= 0),
  add column min_donation_mad integer not null default 20 check (min_donation_mad between 1 and 100000),
  add column is_urgent boolean not null default false,
  add column social_links jsonb not null default '[]'::jsonb check (jsonb_typeof(social_links) = 'array' and jsonb_array_length(social_links) <= 8),
  add column contact_phone text check (contact_phone is null or contact_phone ~ '^\+?[0-9 ().-]{6,20}$'),
  add column contact_email text check (contact_email is null or (char_length(contact_email) <= 120 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column show_contact boolean not null default false,
  add column verification_note text check (verification_note is null or char_length(verification_note) <= 1000);

update public.donation_cases set initial_raised_mad = raised_mad;
alter table public.donation_cases alter column goal_mad type integer;
alter table public.donation_cases add constraint donation_cases_goal_max check (goal_mad <= 100000000);
create index donation_cases_filter_idx on public.donation_cases (status, category, city);

-- Cases are read and written only through the functions below (raised/donor totals must not be edited by hand).
drop policy if exists "published_cases_readable" on public.donation_cases;
drop policy if exists "donation_reviewers_insert" on public.donation_cases;
drop policy if exists "donation_reviewers_update" on public.donation_cases;
revoke all on public.donation_cases from anon, authenticated;
grant select on public.donation_cases to authenticated;

create trigger donation_cases_audit
  after insert or update on public.donation_cases
  for each row execute function public.audit_admin_change();

-- 3. Gallery -----------------------------------------------------------------------------------------------------------
create table public.donation_case_media (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.donation_cases (id) on delete cascade,
  path text not null check (char_length(path) between 5 and 300),
  caption text check (caption is null or char_length(caption) <= 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index donation_case_media_case on public.donation_case_media (case_id, sort_order, created_at);
alter table public.donation_case_media enable row level security;
create policy "reviewers_manage_case_media" on public.donation_case_media for all to authenticated
  using ((select public.has_ihssan_permission('donations.review')))
  with check ((select public.has_ihssan_permission('donations.review')));
revoke all on public.donation_case_media from anon, authenticated;
grant select, insert, update, delete on public.donation_case_media to authenticated;

create function public.limit_case_media() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.donation_case_media where case_id = new.case_id) >= 24 then
    raise exception 'A case can have up to 24 gallery photos';
  end if;
  return new;
end;
$$;
create trigger donation_case_media_limit before insert on public.donation_case_media for each row execute function public.limit_case_media();

-- 4. Bank accounts (platform owner only) ------------------------------------------------------------------------------
create function public.is_platform_owner() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_memberships m where m.user_id = (select auth.uid()) and m.role = 'platform_owner' and m.revoked_at is null);
$$;
revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated;

create table public.donation_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.donation_cases (id) on delete cascade,
  bank_name text not null check (char_length(trim(bank_name)) between 2 and 80),
  account_holder text not null check (char_length(trim(account_holder)) between 2 and 120),
  account_number text not null check (char_length(trim(account_number)) between 8 and 40),
  note text check (note is null or char_length(note) <= 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index donation_bank_accounts_case on public.donation_bank_accounts (case_id) where is_active;
alter table public.donation_bank_accounts enable row level security;
create policy "owner_manages_bank_accounts" on public.donation_bank_accounts for all to authenticated
  using ((select public.is_platform_owner())) with check ((select public.is_platform_owner()));
revoke all on public.donation_bank_accounts from anon, authenticated;
grant select, insert, update, delete on public.donation_bank_accounts to authenticated;
create trigger donation_bank_accounts_set_updated_at before update on public.donation_bank_accounts for each row execute function public.set_updated_at();
create trigger donation_bank_accounts_audit after insert or update or delete on public.donation_bank_accounts for each row execute function public.audit_admin_change();

-- 5. Collectors and invites --------------------------------------------------------------------------------------------
create table public.donation_case_collectors (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.donation_cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text check (label is null or char_length(label) <= 80),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index donation_case_collectors_active on public.donation_case_collectors (case_id, user_id) where revoked_at is null;
create index donation_case_collectors_user on public.donation_case_collectors (user_id) where revoked_at is null;
alter table public.donation_case_collectors enable row level security;
revoke all on public.donation_case_collectors from anon, authenticated;
create trigger donation_case_collectors_audit after insert or update on public.donation_case_collectors for each row execute function public.audit_admin_change();

create table public.donation_collector_invites (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.donation_cases (id) on delete cascade,
  token_hash text not null unique,
  label text check (label is null or char_length(label) <= 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);
alter table public.donation_collector_invites enable row level security;
revoke all on public.donation_collector_invites from anon, authenticated;

-- 6. Donation orders (pledges) -----------------------------------------------------------------------------------------
create table public.donation_pledges (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  case_id uuid not null references public.donation_cases (id) on delete restrict,
  donor_user_id uuid references auth.users (id) on delete set null,
  token_hash text not null,
  amount_mad integer not null check (amount_mad between 1 and 10000000),
  display_name text check (display_name is null or char_length(trim(display_name)) between 2 and 60),
  is_anonymous boolean not null default true,
  comment text check (comment is null or char_length(comment) <= 300),
  comment_visible boolean not null default true,
  donor_contact text check (donor_contact is null or char_length(donor_contact) <= 120),
  status text not null default 'pledged' check (status in ('pledged', 'receipt_submitted', 'confirmed', 'rejected', 'expired', 'cancelled', 'reversed')),
  expires_at timestamptz not null,
  receipt_paths text[] not null default '{}' check (cardinality(receipt_paths) <= 3),
  receipt_note text check (receipt_note is null or char_length(receipt_note) <= 300),
  receipt_uploaded_at timestamptz,
  confirmed_amount_mad integer check (confirmed_amount_mad is null or confirmed_amount_mad between 1 and 10000000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  client_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('confirmed') or (confirmed_amount_mad is not null and reviewed_at is not null))
);
create index donation_pledges_case_status on public.donation_pledges (case_id, status, created_at desc);
create index donation_pledges_user on public.donation_pledges (donor_user_id, created_at desc) where donor_user_id is not null;
create index donation_pledges_open on public.donation_pledges (expires_at) where status = 'pledged';
create index donation_pledges_client on public.donation_pledges (client_hash, created_at) where client_hash is not null;
alter table public.donation_pledges enable row level security;
revoke all on public.donation_pledges from anon, authenticated;
create trigger donation_pledges_set_updated_at before update on public.donation_pledges for each row execute function public.set_updated_at();
create trigger donation_pledges_audit after update on public.donation_pledges for each row
  when (new.status in ('confirmed', 'rejected', 'reversed') and old.status is distinct from new.status)
  execute function public.audit_admin_change();

-- 7. Storage -----------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('case-media', 'case-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('donation-receipts', 'donation-receipts', false, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "reviewers_manage_case_media_files" on storage.objects for all to authenticated
  using (bucket_id = 'case-media' and (select public.has_ihssan_permission('donations.review')))
  with check (bucket_id = 'case-media' and (select public.has_ihssan_permission('donations.review')));

-- Receipts are uploaded to <pledge id>/<file>, only while that order is open, at most three files per order.
create function public.can_upload_pledge_receipt(object_name text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  pledge_id uuid;
begin
  if object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,80}$' then return false; end if;
  pledge_id := split_part(object_name, '/', 1)::uuid;
  return exists (
    select 1 from public.donation_pledges p
    where p.id = pledge_id
      and (p.status in ('pledged', 'receipt_submitted') or (p.status = 'expired' and p.expires_at > now() - interval '7 days'))
  ) and (
    select count(*) from storage.objects o where o.bucket_id = 'donation-receipts' and o.name like pledge_id::text || '/%'
  ) < 3;
end;
$$;

create function public.can_read_pledge_receipt(object_name text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  target_case uuid;
begin
  if object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then return false; end if;
  select p.case_id into target_case from public.donation_pledges p where p.id = split_part(object_name, '/', 1)::uuid;
  if target_case is null then return false; end if;
  return public.has_ihssan_permission('donations.review') or exists (
    select 1 from public.donation_case_collectors c where c.case_id = target_case and c.user_id = (select auth.uid()) and c.revoked_at is null
  );
end;
$$;
revoke all on function public.can_upload_pledge_receipt(text) from public;
revoke all on function public.can_read_pledge_receipt(text) from public, anon;
grant execute on function public.can_upload_pledge_receipt(text) to anon, authenticated;
grant execute on function public.can_read_pledge_receipt(text) to authenticated;

create policy "donors_upload_receipts" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'donation-receipts' and public.can_upload_pledge_receipt(name));
create policy "collectors_read_receipts" on storage.objects for select to authenticated
  using (bucket_id = 'donation-receipts' and public.can_read_pledge_receipt(name));

-- 8. Internal helpers --------------------------------------------------------------------------------------------------
create function public.donation_token_hash(p_token text) returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
$$;
revoke all on function public.donation_token_hash(text) from public, anon, authenticated;

create function public.expire_stale_pledges() returns void language sql security definer set search_path = '' as $$
  update public.donation_pledges set status = 'expired' where status = 'pledged' and expires_at < now();
$$;
revoke all on function public.expire_stale_pledges() from public, anon, authenticated;

create function public.recompute_case_total(p_case_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare
  confirmed_total bigint;
  confirmed_count integer;
begin
  select coalesce(sum(confirmed_amount_mad), 0), count(*) into confirmed_total, confirmed_count
  from public.donation_pledges where case_id = p_case_id and status = 'confirmed';
  update public.donation_cases c
  set raised_mad = least(2147483647, c.initial_raised_mad + confirmed_total)::integer,
      donor_count = confirmed_count,
      status = case
        when c.status in ('published', 'funded') then
          case when least(2147483647, c.initial_raised_mad + confirmed_total) >= c.goal_mad then 'funded' else 'published' end
        else c.status end
  where c.id = p_case_id;
end;
$$;
revoke all on function public.recompute_case_total(uuid) from public, anon, authenticated;

create function public.donation_bank_json(p_case_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'bank_name', b.bank_name, 'account_holder', b.account_holder, 'account_number', b.account_number, 'note', b.note) order by b.created_at), '[]'::jsonb)
  from public.donation_bank_accounts b where b.case_id = p_case_id and b.is_active;
$$;
revoke all on function public.donation_bank_json(uuid) from public, anon, authenticated;

create function public.validate_social_links(p_links jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then raise exception 'Invalid links'; end if;
  if jsonb_array_length(coalesce(p_links, '[]'::jsonb)) > 8 then raise exception 'You can add up to 8 links'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) x(item)
    where jsonb_typeof(x.item) <> 'object'
       or x.item->>'kind' is null or x.item->>'kind' not in ('website', 'instagram', 'facebook', 'linkedin', 'x', 'youtube', 'tiktok')
       or x.item->>'url' is null or char_length(x.item->>'url') > 200
       or x.item->>'url' !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^\s<>"'']*)?$'
  ) then raise exception 'Links must be full https:// addresses'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('kind', x.item->>'kind', 'url', x.item->>'url') order by x.ord), '[]'::jsonb)
          from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) with ordinality x(item, ord));
end;
$$;
revoke all on function public.validate_social_links(jsonb) from public, anon, authenticated;

-- 9. Public reads ------------------------------------------------------------------------------------------------------
create function public.list_donation_cases(
  p_category text default null, p_city text default null, p_status text default 'active', p_search text default null,
  p_urgent boolean default false, p_sort text default 'newest', p_limit integer default 20, p_offset integer default 0
)
returns table (
  id uuid, title text, summary text, city text, category text, category_label text, beneficiary_name text, age integer, goal_mad integer,
  raised_mad integer, donor_count integer, percent integer, status text, is_urgent boolean, photo_path text, published_at timestamptz
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
         least(100, (c.raised_mad::numeric * 100 / c.goal_mad)::integer), c.status, c.is_urgent, c.photo_path, c.published_at
  from public.donation_cases c
  left join public.donation_categories cat on cat.slug = c.category
  where c.status in ('published', 'funded')
    and (p_status = 'all' or (p_status = 'funded' and c.status = 'funded') or (p_status not in ('funded', 'all') and c.status = 'published'))
    and (nullif(p_category, '') is null or c.category = p_category)
    and (nullif(p_city, '') is null or c.city = p_city)
    and (not coalesce(p_urgent, false) or c.is_urgent)
    and (term is null or c.title ilike term or c.summary ilike term or c.beneficiary_name ilike term or c.city ilike term)
  order by
    case when p_sort = 'urgent' then c.is_urgent end desc nulls last,
    case when p_sort = 'nearly_funded' then c.raised_mad::numeric / c.goal_mad end desc nulls last,
    case when p_sort = 'least_funded' then c.raised_mad::numeric / c.goal_mad end asc nulls last,
    case when p_sort = 'most_funded' then c.raised_mad end desc nulls last,
    c.published_at desc, c.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create function public.list_donation_case_cities() returns table (city text, total integer) language sql stable security definer set search_path = '' as $$
  select c.city, count(*)::integer from public.donation_cases c where c.status in ('published', 'funded') and c.city is not null group by c.city order by 2 desc, 1;
$$;

create function public.get_donation_case(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.donation_cases;
  result jsonb;
begin
  select * into c from public.donation_cases where id = p_id;
  if not found then return null; end if;
  if c.status not in ('published', 'funded', 'closed') and not coalesce(public.has_ihssan_permission('donations.review'), false) then return null; end if;
  result := jsonb_build_object(
    'id', c.id, 'title', c.title, 'summary', c.summary, 'bio', c.bio, 'city', c.city, 'age', c.age, 'beneficiary_name', c.beneficiary_name,
    'category', c.category, 'category_label', (select label_en from public.donation_categories where slug = c.category),
    'goal_mad', c.goal_mad, 'raised_mad', c.raised_mad, 'donor_count', c.donor_count, 'status', c.status, 'is_urgent', c.is_urgent,
    'min_donation_mad', c.min_donation_mad, 'photo_path', c.photo_path, 'social_links', c.social_links, 'published_at', c.published_at,
    'contact', case when c.show_contact then jsonb_build_object('phone', c.contact_phone, 'email', c.contact_email) else null end,
    'media', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'path', m.path, 'caption', m.caption) order by m.sort_order, m.created_at), '[]'::jsonb)
              from public.donation_case_media m where m.case_id = c.id)
  );
  return result;
end;
$$;

create function public.list_case_donations(p_case_id uuid, p_limit integer default 30)
returns table (display_name text, amount_mad integer, comment text, confirmed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select case when p.is_anonymous or p.display_name is null then 'Anonymous' else p.display_name end,
         p.confirmed_amount_mad, case when p.comment_visible then p.comment end, p.reviewed_at
  from public.donation_pledges p
  join public.donation_cases c on c.id = p.case_id and c.status in ('published', 'funded', 'closed')
  where p.case_id = p_case_id and p.status = 'confirmed'
  order by p.reviewed_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- 10. Donation orders --------------------------------------------------------------------------------------------------
create function public.create_donation_pledge(
  p_case_id uuid, p_amount integer, p_display_name text default null, p_is_anonymous boolean default true,
  p_comment text default null, p_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.donation_cases;
  raw_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_ref text;
  new_id uuid;
  expiry timestamptz := now() + interval '48 hours';
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  client_ip text := nullif(trim(split_part(coalesce(headers ->> 'cf-connecting-ip', headers ->> 'x-real-ip', headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  client text;
begin
  perform public.expire_stale_pledges();
  select * into c from public.donation_cases where id = p_case_id;
  if not found or c.status <> 'published' then raise exception 'This case is not accepting donations'; end if;
  if jsonb_array_length(public.donation_bank_json(c.id)) = 0 then raise exception 'This case cannot accept donations right now'; end if;
  if p_amount is null or p_amount < c.min_donation_mad then raise exception 'The minimum donation is % MAD', c.min_donation_mad; end if;
  if p_amount > 1000000 then raise exception 'Please contact us for donations above 1,000,000 MAD'; end if;
  if p_display_name is not null and char_length(trim(p_display_name)) not between 2 and 60 then raise exception 'Display name must be 2 to 60 characters'; end if;
  if p_comment is not null and char_length(p_comment) > 300 then raise exception 'Comments can be up to 300 characters'; end if;

  if client_ip is not null then
    client := public.donation_token_hash('ihssan-ip:' || client_ip);
    if (select count(*) from public.donation_pledges where client_hash = client and created_at > now() - interval '1 hour') >= 8 then
      raise exception 'Too many donation orders. Please try again later';
    end if;
  end if;
  if auth.uid() is not null and (select count(*) from public.donation_pledges where donor_user_id = auth.uid() and status = 'pledged') >= 10 then
    raise exception 'You have many open donation orders. Complete or cancel some first';
  end if;

  loop
    new_ref := 'IH-' || (select string_agg(substr(alphabet, 1 + floor(random() * 31)::integer, 1), '') from generate_series(1, 7));
    exit when not exists (select 1 from public.donation_pledges where reference = new_ref);
  end loop;

  insert into public.donation_pledges (reference, case_id, donor_user_id, token_hash, amount_mad, display_name, is_anonymous, comment, donor_contact, expires_at, client_hash)
  values (new_ref, c.id, auth.uid(), public.donation_token_hash(raw_token), p_amount, nullif(trim(coalesce(p_display_name, '')), ''), coalesce(p_is_anonymous, true),
          nullif(trim(coalesce(p_comment, '')), ''), nullif(trim(coalesce(p_contact, '')), ''), expiry, client)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'reference', new_ref, 'token', raw_token, 'expires_at', expiry);
end;
$$;

create function public.get_pledge(p_id uuid, p_token text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
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
    'case_id', c.id, 'case_title', c.title,
    'banks', case when p.status in ('pledged', 'receipt_submitted', 'expired') then public.donation_bank_json(c.id) else '[]'::jsonb end,
    'can_upload', (p.status in ('pledged', 'receipt_submitted') or (p.status = 'expired' and p.expires_at > now() - interval '7 days')) and cardinality(p.receipt_paths) < 3
  );
end;
$$;

create function public.list_my_pledges() returns table (id uuid, reference text, case_id uuid, case_title text, amount_mad integer, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.expire_stale_pledges();
  return query select p.id, p.reference, p.case_id, c.title, p.amount_mad, p.status, p.created_at, p.expires_at
  from public.donation_pledges p join public.donation_cases c on c.id = p.case_id
  where p.donor_user_id = auth.uid() order by p.created_at desc limit 100;
end;
$$;

create function public.submit_pledge_receipt(p_id uuid, p_token text, p_paths text[], p_note text default null) returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.donation_pledges;
  path text;
  merged text[];
begin
  select * into p from public.donation_pledges where id = p_id for update;
  if not found or not (p.token_hash = public.donation_token_hash(p_token) or (auth.uid() is not null and p.donor_user_id = auth.uid())) then
    raise exception 'Donation order not found';
  end if;
  if not (p.status in ('pledged', 'receipt_submitted') or (p.status = 'expired' and p.expires_at > now() - interval '7 days')) then
    raise exception 'This donation order is no longer open';
  end if;
  if p_paths is null or cardinality(p_paths) = 0 then raise exception 'Attach your transfer receipt'; end if;
  foreach path in array p_paths loop
    if path not like p.id::text || '/%' or not exists (select 1 from storage.objects o where o.bucket_id = 'donation-receipts' and o.name = path) then
      raise exception 'Receipt upload not found. Please try again';
    end if;
  end loop;
  select array(select distinct x from unnest(p.receipt_paths || p_paths) x) into merged;
  if cardinality(merged) > 3 then raise exception 'You can attach up to 3 files'; end if;
  update public.donation_pledges
  set receipt_paths = merged, receipt_uploaded_at = now(), status = 'receipt_submitted',
      receipt_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), receipt_note)
  where id = p.id;
end;
$$;

create function public.cancel_pledge(p_id uuid, p_token text default null) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.donation_pledges set status = 'cancelled'
  where id = p_id and status = 'pledged' and (token_hash = public.donation_token_hash(p_token) or (auth.uid() is not null and donor_user_id = auth.uid()));
  if not found then raise exception 'This order cannot be cancelled'; end if;
end;
$$;

-- 11. Collectors and reviewers ----------------------------------------------------------------------------------------
create function public.can_review_case(p_case_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_ihssan_permission('donations.review') or exists (
    select 1 from public.donation_case_collectors c where c.case_id = p_case_id and c.user_id = (select auth.uid()) and c.revoked_at is null
  );
$$;
revoke all on function public.can_review_case(uuid) from public, anon;
grant execute on function public.can_review_case(uuid) to authenticated;

create function public.list_my_collector_cases() returns table (id uuid, title text, status text, goal_mad integer, raised_mad integer, donor_count integer, awaiting_review integer, role text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.expire_stale_pledges();
  return query
  select c.id, c.title, c.status, c.goal_mad, c.raised_mad, c.donor_count,
         (select count(*)::integer from public.donation_pledges p where p.case_id = c.id and p.status = 'receipt_submitted'),
         case when public.has_ihssan_permission('donations.review') then 'admin' else 'collector' end
  from public.donation_cases c
  where public.has_ihssan_permission('donations.review')
     or exists (select 1 from public.donation_case_collectors k where k.case_id = c.id and k.user_id = auth.uid() and k.revoked_at is null)
  order by c.status = 'closed', c.updated_at desc;
end;
$$;

create function public.list_case_pledges(p_case_id uuid default null, p_status text default null, p_limit integer default 50)
returns table (
  id uuid, reference text, case_id uuid, case_title text, amount_mad integer, display_name text, is_anonymous boolean, comment text, comment_visible boolean,
  status text, created_at timestamptz, expires_at timestamptz, receipt_paths text[], receipt_note text, receipt_uploaded_at timestamptz,
  confirmed_amount_mad integer, review_note text, reviewed_at timestamptz, donor_contact text
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
         p.receipt_paths, p.receipt_note, p.receipt_uploaded_at, p.confirmed_amount_mad, p.review_note, p.reviewed_at, case when is_admin then p.donor_contact end
  from public.donation_pledges p join public.donation_cases c on c.id = p.case_id
  where (p_case_id is null or p.case_id = p_case_id) and (nullif(p_status, '') is null or p.status = p_status)
  order by (p.status = 'receipt_submitted') desc, coalesce(p.receipt_uploaded_at, p.created_at) desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

create function public.review_pledge(p_id uuid, p_decision text, p_amount integer default null, p_note text default null, p_show_comment boolean default true)
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
        review_note = note, comment_visible = coalesce(p_show_comment, true)
    where id = p.id;
  elsif p_decision = 'reject' then
    if p.status not in ('pledged', 'receipt_submitted', 'expired') then raise exception 'This donation cannot be rejected'; end if;
    if note is null then raise exception 'Add a short reason so the donor understands'; end if;
    update public.donation_pledges set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = note where id = p.id;
  elsif p_decision = 'reverse' then
    if not admin then raise exception 'Only an administrator can reverse a confirmed donation'; end if;
    if p.status <> 'confirmed' then raise exception 'Only confirmed donations can be reversed'; end if;
    if note is null then raise exception 'Add the reason for reversing'; end if;
    update public.donation_pledges set status = 'reversed', reviewed_by = auth.uid(), reviewed_at = now(), review_note = note where id = p.id;
  elsif p_decision = 'hide_comment' then
    update public.donation_pledges set comment_visible = false where id = p.id;
  else
    raise exception 'Unknown decision';
  end if;
  perform public.recompute_case_total(p.case_id);
end;
$$;

create function public.accept_collector_invite(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv public.donation_collector_invites;
begin
  if auth.uid() is null then raise exception 'Sign in to accept this invitation'; end if;
  select * into inv from public.donation_collector_invites where token_hash = public.donation_token_hash(p_token) for update;
  if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at < now() then raise exception 'This invitation is invalid or has expired'; end if;
  if not exists (select 1 from public.donation_case_collectors where case_id = inv.case_id and user_id = auth.uid() and revoked_at is null) then
    insert into public.donation_case_collectors (case_id, user_id, label, granted_by) values (inv.case_id, auth.uid(), inv.label, inv.created_by);
  end if;
  update public.donation_collector_invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return jsonb_build_object('case_id', inv.case_id, 'case_title', (select title from public.donation_cases where id = inv.case_id));
end;
$$;

-- 12. Admin ------------------------------------------------------------------------------------------------------------
create function public.admin_save_donation_case(p jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_case_id uuid := nullif(p ->> 'id', '')::uuid;
  new_status text := coalesce(nullif(p ->> 'status', ''), 'draft');
  cleaned_links jsonb := public.validate_social_links(p -> 'social_links');
  existing public.donation_cases;
begin
  if not coalesce(public.has_ihssan_permission('donations.review'), false) then raise exception 'You do not have permission to manage cases'; end if;
  if new_status not in ('draft', 'published', 'closed') then raise exception 'Invalid status'; end if;
  if v_case_id is not null then
    select * into existing from public.donation_cases where id = v_case_id;
    if not found then raise exception 'Case not found'; end if;
  end if;
  if new_status = 'published' and (v_case_id is null or not exists (select 1 from public.donation_bank_accounts where donation_bank_accounts.case_id = v_case_id and donation_bank_accounts.is_active)) then
    raise exception 'Add an active bank account before publishing';
  end if;

  if v_case_id is null then
    insert into public.donation_cases (title, summary, city, goal_mad, status, category, beneficiary_name, age, bio, photo_path, initial_raised_mad, min_donation_mad,
      is_urgent, social_links, contact_phone, contact_email, show_contact, verification_note)
    values (p ->> 'title', p ->> 'summary', nullif(trim(p ->> 'city'), ''), (p ->> 'goal_mad')::integer, 'draft', nullif(p ->> 'category', ''),
      nullif(trim(p ->> 'beneficiary_name'), ''), nullif(p ->> 'age', '')::integer, nullif(trim(p ->> 'bio'), ''), nullif(p ->> 'photo_path', ''),
      coalesce(nullif(p ->> 'initial_raised_mad', '')::integer, 0), coalesce(nullif(p ->> 'min_donation_mad', '')::integer, 20),
      coalesce((p ->> 'is_urgent')::boolean, false), cleaned_links, nullif(trim(p ->> 'contact_phone'), ''), nullif(trim(p ->> 'contact_email'), ''),
      coalesce((p ->> 'show_contact')::boolean, false), nullif(trim(p ->> 'verification_note'), ''))
    returning id into v_case_id;
  else
    update public.donation_cases set
      title = p ->> 'title', summary = p ->> 'summary', city = nullif(trim(p ->> 'city'), ''), goal_mad = (p ->> 'goal_mad')::integer,
      category = nullif(p ->> 'category', ''), beneficiary_name = nullif(trim(p ->> 'beneficiary_name'), ''), age = nullif(p ->> 'age', '')::integer,
      bio = nullif(trim(p ->> 'bio'), ''), photo_path = nullif(p ->> 'photo_path', ''),
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

create function public.admin_create_collector_invite(p_case_id uuid, p_label text default null, p_days integer default 7) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  raw_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  expiry timestamptz := now() + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30));
begin
  if not coalesce(public.has_ihssan_permission('donations.review'), false) then raise exception 'You do not have permission to manage cases'; end if;
  if not exists (select 1 from public.donation_cases where id = p_case_id) then raise exception 'Case not found'; end if;
  insert into public.donation_collector_invites (case_id, token_hash, label, created_by, expires_at)
  values (p_case_id, public.donation_token_hash(raw_token), nullif(trim(coalesce(p_label, '')), ''), auth.uid(), expiry);
  return jsonb_build_object('token', raw_token, 'expires_at', expiry);
end;
$$;

create function public.admin_list_case_collectors(p_case_id uuid)
returns table (id uuid, kind text, label text, user_name text, created_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.has_ihssan_permission('donations.review'), false) then raise exception 'You do not have permission to manage cases'; end if;
  return query
  select k.id, 'collector'::text, k.label, coalesce(pr.display_name, 'Member'), k.created_at, null::timestamptz
  from public.donation_case_collectors k left join public.profiles pr on pr.id = k.user_id
  where k.case_id = p_case_id and k.revoked_at is null
  union all
  select i.id, 'invite', i.label, null, i.created_at, i.expires_at
  from public.donation_collector_invites i where i.case_id = p_case_id and i.used_at is null and i.revoked_at is null and i.expires_at > now()
  order by 5 desc;
end;
$$;

create function public.admin_revoke_collector(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.has_ihssan_permission('donations.review'), false) then raise exception 'You do not have permission to manage cases'; end if;
  update public.donation_case_collectors set revoked_at = now() where id = p_id and revoked_at is null;
  update public.donation_collector_invites set revoked_at = now() where id = p_id and revoked_at is null and used_at is null;
end;
$$;

-- 13. Grants -----------------------------------------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'list_donation_cases(text,text,text,text,boolean,text,integer,integer)', 'list_donation_case_cities()', 'get_donation_case(uuid)', 'list_case_donations(uuid,integer)',
    'create_donation_pledge(uuid,integer,text,boolean,text,text)', 'get_pledge(uuid,text)', 'submit_pledge_receipt(uuid,text,text[],text)', 'cancel_pledge(uuid,text)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'list_my_pledges()', 'list_my_collector_cases()', 'list_case_pledges(uuid,text,integer)', 'review_pledge(uuid,text,integer,text,boolean)', 'accept_collector_invite(text)',
    'admin_save_donation_case(jsonb)', 'admin_create_collector_invite(uuid,text,integer)', 'admin_list_case_collectors(uuid)', 'admin_revoke_collector(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
