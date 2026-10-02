create or replace function public.protect_support_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.requester_id is distinct from old.requester_id
     or new.category is distinct from old.category
     or new.subject is distinct from old.subject
     or new.created_at is distinct from old.created_at then
    raise exception 'Support request identity fields are immutable';
  end if;

  if new.assigned_to is not null and not exists (
    select 1
    from public.admin_memberships as membership
    where membership.user_id = new.assigned_to
      and membership.revoked_at is null
      and (
        membership.role = 'platform_owner'
        or 'support.requests.manage' = any(membership.permissions)
      )
  ) then
    raise exception 'Assignee must have active support permissions';
  end if;

  if new.status in ('resolved', 'closed') then
    new.resolved_at := coalesce(new.resolved_at, now());
  else
    new.resolved_at := null;
  end if;

  return new;
end;
$$;

create trigger support_request_immutable_identity_and_assignment
  before update on public.support_requests
  for each row execute function public.protect_support_request();

revoke update on public.support_requests from authenticated;
grant update (status, priority, assigned_to, resolved_at) on public.support_requests to authenticated;
