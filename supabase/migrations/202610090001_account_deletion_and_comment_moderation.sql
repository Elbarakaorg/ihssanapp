-- In-app account deletion and reporting/moderation of doctor comments.

-- 1. Account deletion -----------------------------------------------------------------------------------------------
-- Deletes the profile (and with it all health data, treatments, shares, comments, loves) and then the sign-in account.
-- If admin audit trails still reference the account, the account is anonymised and locked instead so nothing identifying remains.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.admin_memberships where user_id = me and role = 'platform_owner' and revoked_at is null)
     and (select count(*) from public.admin_memberships where role = 'platform_owner' and revoked_at is null) = 1 then
    raise exception 'Transfer ownership before deleting the only platform owner account';
  end if;

  delete from public.profiles where id = me;
  begin
    delete from auth.users where id = me;
  exception when foreign_key_violation then
    update auth.users
    set email = 'deleted-' || me || '@deleted.invalid', phone = null, encrypted_password = null,
        raw_user_meta_data = '{}'::jsonb, raw_app_meta_data = '{}'::jsonb, banned_until = 'infinity', updated_at = now()
    where id = me;
    delete from auth.identities where user_id = me;
    delete from auth.sessions where user_id = me;
  end;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2. Comment reports -----------------------------------------------------------------------------------------------
alter table public.clinician_comments
  add column moderation text not null default 'visible' check (moderation in ('visible', 'under_review', 'removed'));

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.clinician_comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'abusive', 'false', 'private_info', 'other')),
  details text check (details is null or char_length(details) <= 300),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  unique (comment_id, reporter_id)
);
create index comment_reports_open on public.comment_reports (status, created_at);
alter table public.comment_reports enable row level security;
revoke all on public.comment_reports from anon, authenticated;

-- Replace the public list so removed or under-review comments are visible only to their author.
create or replace function public.list_doctor_comments(p_clinician_id uuid, p_limit integer default 20)
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
         c.is_hidden or c.moderation <> 'visible'
  from public.clinician_comments c
  join public.profiles pr on pr.id = c.author_id
  join public.clinician_public_profiles p on p.clinician_id = c.clinician_id
  join public.clinician_verifications v on v.user_id = c.clinician_id and v.verification_status = 'verified'
  where c.clinician_id = p_clinician_id
    and (p.is_public or p_clinician_id = auth.uid())
    and (p.comments_enabled or p_clinician_id = auth.uid())
    and ((not c.is_hidden and c.moderation = 'visible') or c.author_id = auth.uid() or (p_clinician_id = auth.uid() and c.moderation = 'visible'))
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create function public.report_doctor_comment(p_comment_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  reporters int;
begin
  if me is null then raise exception 'Sign in to report a comment'; end if;
  if not exists (select 1 from public.clinician_comments where id = p_comment_id and author_id <> me) then raise exception 'Comment not found'; end if;
  if (select count(*) from public.comment_reports where reporter_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily report limit reached';
  end if;
  insert into public.comment_reports (comment_id, reporter_id, reason, details)
  values (p_comment_id, me, p_reason, nullif(btrim(p_details), ''))
  on conflict (comment_id, reporter_id) do nothing;

  -- Three independent reports pull a comment from view until a moderator decides.
  select count(*) into reporters from public.comment_reports where comment_id = p_comment_id and status = 'open';
  if reporters >= 3 then
    update public.clinician_comments set moderation = 'under_review' where id = p_comment_id and moderation = 'visible';
  end if;
end;
$$;

create function public.admin_list_comment_reports(p_status text default 'open')
returns table (report_id uuid, comment_id uuid, doctor_name text, author_name text, body text, moderation text, reason text, details text, reports_on_comment bigint, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.has_ihssan_permission('support.requests.manage')) then raise exception 'Not allowed'; end if;
  return query
    select r.id, c.id, coalesce(v.public_name, 'Doctor'), pr.display_name, c.body, c.moderation, r.reason, r.details,
           (select count(*) from public.comment_reports x where x.comment_id = c.id), r.created_at
    from public.comment_reports r
    join public.clinician_comments c on c.id = r.comment_id
    join public.profiles pr on pr.id = c.author_id
    left join public.clinician_verifications v on v.user_id = c.clinician_id
    where r.status = p_status
    order by r.created_at
    limit 100;
end;
$$;

create function public.admin_resolve_comment_report(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not (select public.has_ihssan_permission('support.requests.manage')) then raise exception 'Not allowed'; end if;
  if p_action not in ('remove', 'keep') then raise exception 'Unknown action'; end if;
  select comment_id into target from public.comment_reports where id = p_report_id and status = 'open';
  if target is null then raise exception 'Report not found'; end if;
  if p_action = 'remove' then
    update public.clinician_comments set moderation = 'removed' where id = target;
    update public.comment_reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now() where comment_id = target and status = 'open';
  else
    update public.clinician_comments set moderation = 'visible' where id = target and moderation = 'under_review';
    update public.comment_reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now() where comment_id = target and status = 'open';
  end if;
end;
$$;

revoke all on function public.report_doctor_comment(uuid, text, text), public.admin_list_comment_reports(text), public.admin_resolve_comment_report(uuid, text) from public, anon;
grant execute on function public.report_doctor_comment(uuid, text, text), public.admin_list_comment_reports(text), public.admin_resolve_comment_report(uuid, text) to authenticated;

create or replace function public.get_doctor_engagement(p_clinician_id uuid)
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
    'comment_count', (select count(*) from public.clinician_comments where clinician_id = p_clinician_id and not is_hidden and moderation = 'visible')
  )
  from public.clinician_public_profiles p
  join public.clinician_verifications v on v.user_id = p.clinician_id and v.verification_status = 'verified'
  where p.clinician_id = p_clinician_id and (p.is_public or p_clinician_id = auth.uid());
$$;
