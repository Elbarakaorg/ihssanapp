create table public.care_providers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('doctor', 'pharmacy')),
  name text not null check (char_length(trim(name)) between 2 and 160),
  specialty text check (specialty is null or char_length(trim(specialty)) between 2 and 120),
  city text not null check (char_length(trim(city)) between 2 and 80),
  address text check (address is null or char_length(address) <= 300),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 300),
  status text not null default 'draft' check (status in ('draft', 'verified', 'retired')),
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'verified' or (verified_by is not null and verified_at is not null)),
  check (status <> 'verified' or (latitude is not null and longitude is not null))
);

create index care_providers_directory_idx on public.care_providers (city, kind) where status = 'verified';

alter table public.care_providers enable row level security;

create policy "verified_providers_readable"
  on public.care_providers for select to anon, authenticated
  using (status = 'verified');

create policy "provider_reviewers_read_all"
  on public.care_providers for select to authenticated
  using ((select public.has_ihssan_permission('providers.verify')));

create policy "provider_reviewers_insert"
  on public.care_providers for insert to authenticated
  with check ((select public.has_ihssan_permission('providers.verify')));

create policy "provider_reviewers_update"
  on public.care_providers for update to authenticated
  using ((select public.has_ihssan_permission('providers.verify')))
  with check ((select public.has_ihssan_permission('providers.verify')));

revoke all on public.care_providers from anon, authenticated;
grant select on public.care_providers to anon, authenticated;
grant insert, update on public.care_providers to authenticated;

create table public.donation_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 4 and 160),
  summary text not null check (char_length(trim(summary)) between 20 and 1000),
  city text check (city is null or char_length(trim(city)) between 2 and 80),
  goal_mad integer not null check (goal_mad > 0),
  raised_mad integer not null default 0 check (raised_mad >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'funded', 'closed')),
  reviewed_by uuid references auth.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or (reviewed_by is not null and published_at is not null))
);

create index donation_cases_public_idx on public.donation_cases (published_at desc) where status in ('published', 'funded');

alter table public.donation_cases enable row level security;

create policy "published_cases_readable"
  on public.donation_cases for select to anon, authenticated
  using (status in ('published', 'funded'));

create policy "donation_reviewers_read_all"
  on public.donation_cases for select to authenticated
  using ((select public.has_ihssan_permission('donations.review')));

create policy "donation_reviewers_insert"
  on public.donation_cases for insert to authenticated
  with check ((select public.has_ihssan_permission('donations.review')));

create policy "donation_reviewers_update"
  on public.donation_cases for update to authenticated
  using ((select public.has_ihssan_permission('donations.review')))
  with check ((select public.has_ihssan_permission('donations.review')));

revoke all on public.donation_cases from anon, authenticated;
grant select on public.donation_cases to anon, authenticated;
grant insert, update on public.donation_cases to authenticated;
