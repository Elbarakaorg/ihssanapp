create table public.admin_memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('platform_owner', 'support_admin')),
  permissions text[] not null default '{}',
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (permissions <@ array[
    'admin.memberships.manage',
    'admin.audit.read',
    'support.requests.manage',
    'metrics.edit',
    'metrics.review',
    'metrics.publish',
    'articles.edit',
    'articles.review',
    'articles.publish',
    'providers.verify',
    'donations.review'
  ]::text[]),
  check (role <> 'platform_owner' or cardinality(permissions) = 0)
);

alter table public.admin_memberships enable row level security;

create function public.has_ihssan_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_memberships as membership
    where membership.user_id = (select auth.uid())
      and membership.revoked_at is null
      and (
        membership.role = 'platform_owner'
        or required_permission = any(membership.permissions)
      )
  );
$$;

revoke all on function public.has_ihssan_permission(text) from public;
grant execute on function public.has_ihssan_permission(text) to authenticated;

create function public.is_verified_ihssan_clinician(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.clinician_verifications as verification on verification.user_id = profile.id
    where profile.id = target_user_id
      and profile.profile_type = 'clinician'
      and verification.verification_status = 'verified'
      and verification.verified_at is not null
  );
$$;

revoke all on function public.is_verified_ihssan_clinician(uuid) from public;
grant execute on function public.is_verified_ihssan_clinician(uuid) to authenticated;

create policy "admins_read_own_memberships_or_owner_reads_team"
  on public.admin_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.has_ihssan_permission('admin.memberships.manage'))
  );

create policy "owner_adds_support_admin_memberships"
  on public.admin_memberships for insert to authenticated
  with check (
    (select public.has_ihssan_permission('admin.memberships.manage'))
    and role = 'support_admin'
    and granted_by = (select auth.uid())
    and revoked_at is null
  );

create policy "owner_updates_support_admin_memberships"
  on public.admin_memberships for update to authenticated
  using (
    (select public.has_ihssan_permission('admin.memberships.manage'))
    and role = 'support_admin'
  )
  with check (
    (select public.has_ihssan_permission('admin.memberships.manage'))
    and role = 'support_admin'
  );

grant select, insert, update on public.admin_memberships to authenticated;

create function public.protect_admin_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.role is distinct from old.role
     or new.granted_at is distinct from old.granted_at then
    raise exception 'Admin membership identity and role are immutable';
  end if;

  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'Revoked memberships cannot be reactivated; create a new membership';
  end if;

  return new;
end;
$$;

create trigger admin_membership_protect_identity
  before update on public.admin_memberships
  for each row execute function public.protect_admin_membership();

alter table public.metric_definitions
  add column if not exists created_by uuid references auth.users (id);

grant insert, update on public.metric_definitions to authenticated;

create policy "metric_definitions_admin_read"
  on public.metric_definitions for select to authenticated
  using (
    is_active
    or (select public.has_ihssan_permission('metrics.edit'))
    or (select public.has_ihssan_permission('metrics.review'))
    or (select public.has_ihssan_permission('metrics.publish'))
  );

create policy "metric_definitions_editors_create_drafts"
  on public.metric_definitions for insert to authenticated
  with check (
    (select public.has_ihssan_permission('metrics.edit'))
    and not is_active
    and created_by = (select auth.uid())
  );

create policy "metric_definitions_editors_update_drafts"
  on public.metric_definitions for update to authenticated
  using ((select public.has_ihssan_permission('metrics.edit')) and not is_active)
  with check ((select public.has_ihssan_permission('metrics.edit')) and not is_active);

drop index if exists public.metric_content_one_published_version_per_locale;

alter table public.metric_content_versions
  add column if not exists effective_to timestamptz,
  add column if not exists review_notes text;

create unique index metric_content_one_current_published_version
  on public.metric_content_versions (metric_definition_id, locale)
  where status = 'published' and effective_to is null;

create policy "metric_content_admin_read"
  on public.metric_content_versions for select to authenticated
  using (
    (status = 'published' and effective_from <= now() and (effective_to is null or now() < effective_to))
    or (select public.has_ihssan_permission('metrics.edit'))
    or (select public.has_ihssan_permission('metrics.review'))
    or (select public.has_ihssan_permission('metrics.publish'))
  );

grant insert, update on public.metric_content_versions to authenticated;

create policy "metric_editors_create_metric_content_drafts"
  on public.metric_content_versions for insert to authenticated
  with check (
    (select public.has_ihssan_permission('metrics.edit'))
    and status = 'draft'
    and authored_by = (select auth.uid())
    and reviewed_by is null
    and published_by is null
  );

create policy "metric_editors_update_own_drafts"
  on public.metric_content_versions for update to authenticated
  using (
    (select public.has_ihssan_permission('metrics.edit'))
    and authored_by = (select auth.uid())
    and status = 'draft'
  )
  with check (
    (select public.has_ihssan_permission('metrics.edit'))
    and authored_by = (select auth.uid())
    and status = 'draft'
  );

create function public.publish_metric_content_version(target_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_version public.metric_content_versions%rowtype;
begin
  if not (select public.has_ihssan_permission('metrics.publish')) then
    raise exception 'Metric publishing permission required' using errcode = '42501';
  end if;

  select * into target_version
  from public.metric_content_versions
  where id = target_version_id
  for update;

  if not found or target_version.status <> 'approved' then
    raise exception 'Only an approved metric content version can be published' using errcode = '55000';
  end if;

  if target_version.reviewed_by is null
     or target_version.reviewed_by = target_version.authored_by
     or not (select public.is_verified_ihssan_clinician(target_version.reviewed_by)) then
    raise exception 'A different verified clinician must approve the metric content' using errcode = '42501';
  end if;

  update public.metric_content_versions
  set effective_to = now()
  where metric_definition_id = target_version.metric_definition_id
    and locale = target_version.locale
    and status = 'published'
    and effective_to is null;

  update public.metric_content_versions
  set status = 'published',
      effective_from = now(),
      effective_to = null,
      published_by = (select auth.uid())
  where id = target_version_id;
end;
$$;

revoke all on function public.publish_metric_content_version(uuid) from public;
grant execute on function public.publish_metric_content_version(uuid) to authenticated;