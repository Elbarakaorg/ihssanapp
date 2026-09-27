create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  preferred_locale text not null default 'en' check (preferred_locale in ('ar', 'fr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_self"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, update on public.profiles to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  insert into public.profiles (id, display_name)
  values (new.id, coalesce(requested_name, 'New patient'))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create table public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null check (metric_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  version smallint not null check (version > 0),
  display_names jsonb not null check (jsonb_typeof(display_names) = 'object'),
  value_kind text not null check (value_kind in ('scalar', 'composite')),
  supported_units text[] not null default '{}',
  value_shape jsonb not null default '{}'::jsonb check (jsonb_typeof(value_shape) = 'object'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (metric_key, version)
);

alter table public.metric_definitions enable row level security;

create policy "active_metric_definitions_readable_by_authenticated"
  on public.metric_definitions for select to authenticated
  using (is_active);

grant select on public.metric_definitions to authenticated;

create table public.metric_content_versions (
  id uuid primary key default gen_random_uuid(),
  metric_definition_id uuid not null references public.metric_definitions (id),
  locale text not null check (locale in ('ar', 'fr', 'en')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  reference_ranges jsonb check (reference_ranges is null or jsonb_typeof(reference_ranges) = 'array'),
  evidence_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_sources) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published', 'retired')),
  effective_from timestamptz,
  authored_by uuid references auth.users (id),
  reviewed_by uuid references auth.users (id),
  published_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (reviewed_by is null or reviewed_by <> authored_by),
  check (status <> 'published' or (reviewed_by is not null and published_by is not null and effective_from is not null))
);

create unique index metric_content_one_published_version_per_locale
  on public.metric_content_versions (metric_definition_id, locale)
  where status = 'published';

alter table public.metric_content_versions enable row level security;

create policy "published_metric_content_readable_by_authenticated"
  on public.metric_content_versions for select to authenticated
  using (status = 'published' and effective_from <= now());

grant select on public.metric_content_versions to authenticated;

create table public.clinician_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  public_name text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (verification_status <> 'verified' or verified_at is not null)
);

alter table public.clinician_verifications enable row level security;

create policy "clinicians_read_own_verification"
  on public.clinician_verifications for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.clinician_verifications to authenticated;