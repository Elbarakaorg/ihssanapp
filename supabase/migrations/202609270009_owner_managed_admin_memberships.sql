alter table public.support_requests
  drop constraint if exists support_requests_assigned_to_fkey;

alter table public.support_requests
  add constraint support_requests_assigned_to_fkey
  foreign key (assigned_to) references auth.users (id);

alter table public.admin_memberships
  drop constraint if exists admin_memberships_pkey;

alter table public.admin_memberships
  add column if not exists id uuid default gen_random_uuid();

update public.admin_memberships
set id = gen_random_uuid()
where id is null;

alter table public.admin_memberships
  alter column id set not null;

alter table public.admin_memberships
  add constraint admin_memberships_pkey primary key (id);

create unique index admin_memberships_one_active_per_user
  on public.admin_memberships (user_id)
  where revoked_at is null;

update public.admin_memberships
set permissions = array_remove(permissions, 'admin.memberships.manage')
where 'admin.memberships.manage' = any(permissions);

alter table public.admin_memberships
  add constraint admin_memberships_cannot_delegate_membership_management
  check (not ('admin.memberships.manage' = any(permissions)));

create or replace function public.grant_support_admin(target_user_id uuid, requested_permissions text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_id uuid;
begin
  if (select auth.uid()) is null
     or not (select public.has_ihssan_permission('admin.memberships.manage')) then
    raise exception 'Platform owner permission required' using errcode = '42501';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'The platform owner cannot be added as a support admin' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.admin_memberships as current_membership
    where current_membership.user_id = target_user_id
      and current_membership.role = 'platform_owner'
      and current_membership.revoked_at is null
  ) then
    raise exception 'A platform owner cannot be changed into a support admin' using errcode = '22023';
  end if;

  insert into public.admin_memberships (user_id, role, permissions, granted_by)
  values (target_user_id, 'support_admin', coalesce(requested_permissions, '{}'), (select auth.uid()))
  returning id into membership_id;

  return membership_id;
end;
$$;

create or replace function public.update_support_admin_permissions(target_membership_id uuid, requested_permissions text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not (select public.has_ihssan_permission('admin.memberships.manage')) then
    raise exception 'Platform owner permission required' using errcode = '42501';
  end if;

  update public.admin_memberships
  set permissions = coalesce(requested_permissions, '{}')
  where id = target_membership_id
    and role = 'support_admin'
    and revoked_at is null;

  if not found then
    raise exception 'Active support-admin membership not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.revoke_support_admin(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not (select public.has_ihssan_permission('admin.memberships.manage')) then
    raise exception 'Platform owner permission required' using errcode = '42501';
  end if;

  update public.admin_memberships
  set revoked_at = now(),
      permissions = '{}'
  where id = target_membership_id
    and role = 'support_admin'
    and revoked_at is null;

  if not found then
    raise exception 'Active support-admin membership not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.grant_support_admin(uuid, text[]) from public;
revoke all on function public.update_support_admin_permissions(uuid, text[]) from public;
revoke all on function public.revoke_support_admin(uuid) from public;

grant execute on function public.grant_support_admin(uuid, text[]) to authenticated;
grant execute on function public.update_support_admin_permissions(uuid, text[]) to authenticated;
grant execute on function public.revoke_support_admin(uuid) to authenticated;
