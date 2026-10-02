create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('account', 'technical', 'directory', 'donation', 'other')),
  subject text not null check (char_length(trim(subject)) between 4 and 160),
  status text not null default 'open'
    check (status in ('open', 'assigned', 'waiting_for_user', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to uuid references public.admin_memberships (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index support_requests_requester_created
  on public.support_requests (requester_id, created_at desc);

create index support_requests_queue
  on public.support_requests (status, priority, created_at)
  where status not in ('resolved', 'closed');

alter table public.support_requests enable row level security;

create policy "users_create_own_support_requests"
  on public.support_requests for insert to authenticated
  with check (requester_id = (select auth.uid()) and assigned_to is null and status = 'open');

create policy "users_read_own_support_requests"
  on public.support_requests for select to authenticated
  using (
    requester_id = (select auth.uid())
    or (select public.has_ihssan_permission('support.requests.manage'))
  );

create policy "support_staff_update_support_requests"
  on public.support_requests for update to authenticated
  using ((select public.has_ihssan_permission('support.requests.manage')))
  with check ((select public.has_ihssan_permission('support.requests.manage')));

grant select, insert, update on public.support_requests to authenticated;

create trigger support_requests_set_updated_at
  before update on public.support_requests
  for each row execute function public.set_updated_at();

create table public.support_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 5000),
  is_staff_reply boolean not null default false,
  created_at timestamptz not null default now()
);

create index support_request_messages_thread
  on public.support_request_messages (request_id, created_at);

alter table public.support_request_messages enable row level security;

create policy "requesters_and_support_staff_read_messages"
  on public.support_request_messages for select to authenticated
  using (
    exists (
      select 1 from public.support_requests as request
      where request.id = request_id
        and request.requester_id = (select auth.uid())
    )
    or (select public.has_ihssan_permission('support.requests.manage'))
  );

create policy "requesters_write_customer_messages"
  on public.support_request_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and not is_staff_reply
    and exists (
      select 1 from public.support_requests as request
      where request.id = request_id
        and request.requester_id = (select auth.uid())
    )
  );

create policy "support_staff_write_staff_replies"
  on public.support_request_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and is_staff_reply
    and (select public.has_ihssan_permission('support.requests.manage'))
  );

grant select, insert on public.support_request_messages to authenticated;

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index admin_audit_events_created_at on public.admin_audit_events (created_at desc);
create index admin_audit_events_entity on public.admin_audit_events (entity_type, entity_id, created_at desc);

alter table public.admin_audit_events enable row level security;

create policy "admin_audit_read_permission"
  on public.admin_audit_events for select to authenticated
  using ((select public.has_ihssan_permission('admin.audit.read')));

grant select on public.admin_audit_events to authenticated;

create function public.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  target_id uuid;
  event_metadata jsonb;
begin
  target_id := coalesce(new_row ->> 'id', new_row ->> 'user_id', old_row ->> 'id', old_row ->> 'user_id')::uuid;
  event_metadata := jsonb_build_object('operation', tg_op);

  if tg_table_name = 'admin_memberships' then
    event_metadata := event_metadata || jsonb_build_object(
      'role', coalesce(new_row ->> 'role', old_row ->> 'role'),
      'permissions', coalesce(new_row -> 'permissions', old_row -> 'permissions'),
      'revoked', coalesce(new_row ->> 'revoked_at', old_row ->> 'revoked_at') is not null
    );
  elsif tg_table_name = 'support_requests' then
    event_metadata := event_metadata || jsonb_build_object(
      'status', coalesce(new_row ->> 'status', old_row ->> 'status'),
      'assigned_to', coalesce(new_row ->> 'assigned_to', old_row ->> 'assigned_to')
    );
  end if;

  insert into public.admin_audit_events (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), tg_table_name || '.' || lower(tg_op), tg_table_name, target_id, event_metadata);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.audit_admin_change() from public;

create trigger admin_memberships_audit
  after insert or update on public.admin_memberships
  for each row execute function public.audit_admin_change();

create trigger support_requests_audit
  after update on public.support_requests
  for each row execute function public.audit_admin_change();