create table public.support_admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null check (
    email_normalized = lower(trim(email_normalized))
    and char_length(email_normalized) <= 254
    and email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  permissions text[] not null check (permissions <@ array[
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
  invited_by uuid not null references auth.users (id),
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check ((accepted_by is null) = (accepted_at is null))
);

create unique index support_admin_one_pending_invite_per_email
  on public.support_admin_invitations (email_normalized)
  where accepted_at is null and revoked_at is null;

create index support_admin_invitations_owner_queue
  on public.support_admin_invitations (invited_at desc)
  where accepted_at is null and revoked_at is null;

alter table public.support_admin_invitations enable row level security;

create policy "owner_reads_support_admin_invitations"
  on public.support_admin_invitations for select to authenticated
  using ((select public.has_ihssan_permission('admin.memberships.manage')));

grant select on public.support_admin_invitations to authenticated;

create function public.invite_support_admin_by_email(target_email text, requested_permissions text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(target_email));
  invitation_id uuid;
begin
  if (select auth.uid()) is null
     or not (select public.has_ihssan_permission('admin.memberships.manage')) then
    raise exception 'Platform owner permission required' using errcode = '42501';
  end if;

  if normalized_email is null
     or char_length(normalized_email) > 254
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  if requested_permissions is null or cardinality(requested_permissions) = 0 then
    raise exception 'At least one support permission must be selected' using errcode = '22023';
  end if;

  update public.support_admin_invitations
  set revoked_at = now()
  where email_normalized = normalized_email
    and accepted_at is null
    and revoked_at is null
    and expires_at <= now();

  insert into public.support_admin_invitations (email_normalized, permissions, invited_by)
  values (normalized_email, requested_permissions, (select auth.uid()))
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create function public.revoke_support_admin_invitation(target_invitation_id uuid)
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

  update public.support_admin_invitations
  set revoked_at = now()
  where id = target_invitation_id
    and accepted_at is null
    and revoked_at is null;

  if not found then
    raise exception 'Pending support invitation not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.accept_support_admin_invitation()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  verified_email text;
  invitation public.support_admin_invitations%rowtype;
  current_membership_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select lower(email)
  into verified_email
  from auth.users
  where id = current_user_id
    and email_confirmed_at is not null;

  if verified_email is null then
    return false;
  end if;

  select * into invitation
  from public.support_admin_invitations
  where email_normalized = verified_email
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  order by invited_at desc
  for update skip locked
  limit 1;

  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.admin_memberships
    where user_id = current_user_id
      and role = 'platform_owner'
      and revoked_at is null
  ) then
    raise exception 'Platform owner cannot accept a support invitation' using errcode = '22023';
  end if;

  select id into current_membership_id
  from public.admin_memberships
  where user_id = current_user_id
    and role = 'support_admin'
    and revoked_at is null
  for update;

  if current_membership_id is null then
    insert into public.admin_memberships (user_id, role, permissions, granted_by)
    values (current_user_id, 'support_admin', invitation.permissions, invitation.invited_by);
  else
    update public.admin_memberships
    set permissions = invitation.permissions,
        granted_by = invitation.invited_by,
        granted_at = now()
    where id = current_membership_id;
  end if;

  update public.support_admin_invitations
  set accepted_by = current_user_id,
      accepted_at = now()
  where id = invitation.id;

  return true;
end;
$$;

revoke all on function public.invite_support_admin_by_email(text, text[]) from public;
revoke all on function public.revoke_support_admin_invitation(uuid) from public;
revoke all on function public.accept_support_admin_invitation() from public;

grant execute on function public.invite_support_admin_by_email(text, text[]) to authenticated;
grant execute on function public.revoke_support_admin_invitation(uuid) to authenticated;
grant execute on function public.accept_support_admin_invitation() to authenticated;
