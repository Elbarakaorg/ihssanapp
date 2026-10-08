-- Donation comment moderation, beneficiary (patient/family) access and analytics.
-- Apply after 202610110001.

-- 1. Comment moderation ------------------------------------------------------------------------------------------------
-- Donor comments are public text, so they are reviewed before showing: confirming a donation no longer publishes the comment by itself.
alter table public.donation_pledges add column comment_status text not null default 'pending' check (comment_status in ('pending', 'approved', 'hidden'));
update public.donation_pledges set comment_status = case when comment is null then 'approved' when comment_visible and status = 'confirmed' then 'approved' when comment_visible then 'pending' else 'hidden' end;
create index donation_pledges_comment_queue on public.donation_pledges (case_id, comment_status) where comment is not null and status = 'confirmed';

-- 2. Beneficiary role --------------------------------------------------------------------------------------------------
-- A beneficiary is the patient or family member linked to a case. They see progress and moderate comments, but cannot confirm
-- donations or open receipts.
alter table public.donation_case_collectors add column role text not null default 'collector' check (role in ('collector', 'beneficiary'));
alter table public.donation_collector_invites add column role text not null default 'collector' check (role in ('collector', 'beneficiary'));

create or replace function public.can_review_case(p_case_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_ihssan_permission('donations.review') or exists (
    select 1 from public.donation_case_collectors c
    where c.case_id = p_case_id and c.user_id = (select auth.uid()) and c.revoked_at is null and c.role = 'collector'
  );
$$;

create function public.can_moderate_case(p_case_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_ihssan_permission('donations.review') or exists (
    select 1 from public.donation_case_collectors c where c.case_id = p_case_id and c.user_id = (select auth.uid()) and c.revoked_at is null
  );
$$;
revoke all on function public.can_moderate_case(uuid) from public, anon;
grant execute on function public.can_moderate_case(uuid) to authenticated;

create or replace function public.can_read_pledge_receipt(object_name text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  target_case uuid;
begin
  if object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then return false; end if;
  select p.case_id into target_case from public.donation_pledges p where p.id = split_part(object_name, '/', 1)::uuid;
  if target_case is null then return false; end if;
  return public.can_review_case(target_case);
end;
$$;

-- Public donor wall: comments only once approved.
create or replace function public.list_case_donations(p_case_id uuid, p_limit integer default 30)
returns table (display_name text, amount_mad integer, comment text, confirmed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select case when p.is_anonymous or p.display_name is null then 'Anonymous' else p.display_name end,
         p.confirmed_amount_mad, case when p.comment_status = 'approved' then p.comment end, p.reviewed_at
  from public.donation_pledges p
  join public.donation_cases c on c.id = p.case_id and c.status in ('published', 'funded', 'closed')
  where p.case_id = p_case_id and p.status = 'confirmed'
  order by p.reviewed_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Confirming only publishes the comment when the reviewer explicitly asks for it.
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
    if not admin then raise exception 'Only an administrator can reverse a confirmed donation'; end if;
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

create function public.list_case_comments(p_case_id uuid default null, p_status text default 'pending', p_limit integer default 100)
returns table (id uuid, reference text, case_id uuid, case_title text, display_name text, is_anonymous boolean, comment text, comment_status text, amount_mad integer, confirmed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  is_admin boolean := coalesce(public.has_ihssan_permission('donations.review'), false);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_case_id is null and not is_admin then raise exception 'Choose a case'; end if;
  if p_case_id is not null and not public.can_moderate_case(p_case_id) then raise exception 'You cannot moderate this case'; end if;
  return query
  select p.id, p.reference, p.case_id, c.title, p.display_name, p.is_anonymous, p.comment, p.comment_status, p.confirmed_amount_mad, p.reviewed_at
  from public.donation_pledges p join public.donation_cases c on c.id = p.case_id
  where p.status = 'confirmed' and p.comment is not null and (p_case_id is null or p.case_id = p_case_id)
    and (nullif(p_status, '') is null or p.comment_status = p_status)
  order by p.reviewed_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create function public.bulk_review_comments(p_ids uuid[], p_decision text) returns integer language plpgsql security definer set search_path = '' as $$
declare
  changed integer := 0;
  row_case uuid;
  new_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approve', 'hide') then raise exception 'Unknown decision'; end if;
  if coalesce(cardinality(p_ids), 0) = 0 or cardinality(p_ids) > 200 then raise exception 'Select between 1 and 200 comments'; end if;
  new_status := case p_decision when 'approve' then 'approved' else 'hidden' end;
  for row_case in select distinct p.case_id from public.donation_pledges p where p.id = any (p_ids) loop
    if not public.can_moderate_case(row_case) then raise exception 'You cannot moderate one of the selected cases'; end if;
  end loop;
  update public.donation_pledges set comment_status = new_status, comment_visible = (new_status = 'approved')
  where id = any (p_ids) and status = 'confirmed' and comment is not null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- 3. Invitations carry a role ------------------------------------------------------------------------------------------
drop function public.admin_create_collector_invite(uuid, text, integer);
create function public.admin_create_collector_invite(p_case_id uuid, p_label text default null, p_days integer default 7, p_role text default 'collector') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  raw_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  expiry timestamptz := now() + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30));
begin
  if not coalesce(public.has_ihssan_permission('donations.review'), false) then raise exception 'You do not have permission to manage cases'; end if;
  if p_role not in ('collector', 'beneficiary') then raise exception 'Unknown role'; end if;
  if not exists (select 1 from public.donation_cases where id = p_case_id) then raise exception 'Case not found'; end if;
  insert into public.donation_collector_invites (case_id, token_hash, label, created_by, expires_at, role)
  values (p_case_id, public.donation_token_hash(raw_token), nullif(trim(coalesce(p_label, '')), ''), auth.uid(), expiry, p_role);
  return jsonb_build_object('token', raw_token, 'expires_at', expiry, 'role', p_role);
end;
$$;

drop function public.admin_list_case_collectors(uuid);
create function public.admin_list_case_collectors(p_case_id uuid)
returns table (id uuid, kind text, label text, user_name text, created_at timestamptz, expires_at timestamptz, role text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.has_ihssan_permission('donations.review'), false) then raise exception 'You do not have permission to manage cases'; end if;
  return query
  select k.id, 'collector'::text, k.label, coalesce(pr.display_name, 'Member'), k.created_at, null::timestamptz, k.role
  from public.donation_case_collectors k left join public.profiles pr on pr.id = k.user_id
  where k.case_id = p_case_id and k.revoked_at is null
  union all
  select i.id, 'invite', i.label, null, i.created_at, i.expires_at, i.role
  from public.donation_collector_invites i where i.case_id = p_case_id and i.used_at is null and i.revoked_at is null and i.expires_at > now()
  order by 5 desc;
end;
$$;

create or replace function public.accept_collector_invite(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv public.donation_collector_invites;
begin
  if auth.uid() is null then raise exception 'Sign in to accept this invitation'; end if;
  select * into inv from public.donation_collector_invites where token_hash = public.donation_token_hash(p_token) for update;
  if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at < now() then raise exception 'This invitation is invalid or has expired'; end if;
  if not exists (select 1 from public.donation_case_collectors where case_id = inv.case_id and user_id = auth.uid() and revoked_at is null) then
    insert into public.donation_case_collectors (case_id, user_id, label, granted_by, role) values (inv.case_id, auth.uid(), inv.label, inv.created_by, inv.role);
  end if;
  update public.donation_collector_invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return jsonb_build_object('case_id', inv.case_id, 'case_title', (select title from public.donation_cases where id = inv.case_id), 'role', inv.role);
end;
$$;

-- "Your cases" for the signed-in member, including the role they hold.
drop function public.list_my_collector_cases();
create function public.list_my_collector_cases() returns table (id uuid, title text, status text, goal_mad integer, raised_mad integer, donor_count integer, awaiting_review integer, role text, pending_comments integer)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.expire_stale_pledges();
  return query
  select c.id, c.title, c.status, c.goal_mad, c.raised_mad, c.donor_count,
         case when public.can_review_case(c.id) then (select count(*)::integer from public.donation_pledges p where p.case_id = c.id and p.status = 'receipt_submitted') else 0 end,
         case when public.has_ihssan_permission('donations.review') then 'admin'
              else (select k.role from public.donation_case_collectors k where k.case_id = c.id and k.user_id = auth.uid() and k.revoked_at is null limit 1) end,
         (select count(*)::integer from public.donation_pledges p where p.case_id = c.id and p.status = 'confirmed' and p.comment is not null and p.comment_status = 'pending')
  from public.donation_cases c
  where public.has_ihssan_permission('donations.review')
     or exists (select 1 from public.donation_case_collectors k where k.case_id = c.id and k.user_id = auth.uid() and k.revoked_at is null)
  order by c.status = 'closed', c.updated_at desc;
end;
$$;

-- 4. Analytics ---------------------------------------------------------------------------------------------------------
-- One call for the overview (all cases, admins only) or for a single case (admins and the case's collectors/beneficiaries).
create function public.donation_analytics(p_case_id uuid default null, p_days integer default 30) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  is_admin boolean := coalesce(public.has_ihssan_permission('donations.review'), false);
  days integer := least(greatest(coalesce(p_days, 30), 7), 365);
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_case_id is null and not is_admin then raise exception 'You do not have permission to view analytics'; end if;
  if p_case_id is not null and not public.can_moderate_case(p_case_id) then raise exception 'You cannot view this case'; end if;
  perform public.expire_stale_pledges();

  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'cases', count(*), 'published', count(*) filter (where c.status = 'published'), 'funded', count(*) filter (where c.status = 'funded'),
        'draft', count(*) filter (where c.status = 'draft'), 'closed', count(*) filter (where c.status = 'closed'),
        'goal_mad', coalesce(sum(c.goal_mad), 0), 'raised_mad', coalesce(sum(c.raised_mad), 0), 'initial_mad', coalesce(sum(c.initial_raised_mad), 0))
      from public.donation_cases c where p_case_id is null or c.id = p_case_id),
    'pledges', (
      select jsonb_build_object(
        'confirmed', count(*) filter (where p.status = 'confirmed'), 'awaiting_review', count(*) filter (where p.status = 'receipt_submitted'),
        'pending_transfer', count(*) filter (where p.status = 'pledged'), 'rejected', count(*) filter (where p.status = 'rejected'),
        'expired', count(*) filter (where p.status = 'expired'), 'reversed', count(*) filter (where p.status = 'reversed'),
        'confirmed_mad', coalesce(sum(p.confirmed_amount_mad) filter (where p.status = 'confirmed'), 0),
        'average_mad', coalesce(round(avg(p.confirmed_amount_mad) filter (where p.status = 'confirmed')), 0),
        'largest_mad', coalesce(max(p.confirmed_amount_mad) filter (where p.status = 'confirmed'), 0),
        'anonymous', count(*) filter (where p.status = 'confirmed' and p.is_anonymous),
        'pending_comments', count(*) filter (where p.status = 'confirmed' and p.comment is not null and p.comment_status = 'pending'),
        'oldest_awaiting', min(p.receipt_uploaded_at) filter (where p.status = 'receipt_submitted'))
      from public.donation_pledges p where p_case_id is null or p.case_id = p_case_id),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'amount_mad', coalesce(s.amount, 0), 'count', coalesce(s.n, 0)) order by d.day), '[]'::jsonb)
      from generate_series((now()::date - (days - 1)), now()::date, interval '1 day') as d(day)
      left join (
        select p.reviewed_at::date as day, sum(p.confirmed_amount_mad) as amount, count(*) as n
        from public.donation_pledges p
        where p.status = 'confirmed' and (p_case_id is null or p.case_id = p_case_id) and p.reviewed_at >= now()::date - (days - 1)
        group by 1) s on s.day = d.day::date),
    'by_category', case when p_case_id is not null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('category', coalesce(c.category, 'other'), 'label', coalesce(cat.label_en, 'Other'), 'cases', c.n, 'goal_mad', c.goal, 'raised_mad', c.raised) order by c.raised desc), '[]'::jsonb)
      from (select category, count(*) n, sum(goal_mad) goal, sum(raised_mad) raised from public.donation_cases group by category) c
      left join public.donation_categories cat on cat.slug = c.category) end,
    'top_cases', case when p_case_id is not null then '[]'::jsonb else (
      select coalesce(jsonb_agg(t order by t.raised_mad desc), '[]'::jsonb) from (
        select c.id, c.title, c.status, c.goal_mad, c.raised_mad, c.donor_count,
               (select count(*) from public.donation_pledges p where p.case_id = c.id and p.status = 'receipt_submitted') as awaiting
        from public.donation_cases c order by c.raised_mad desc limit 8) t) end)
  into result;
  return result;
end;
$$;

-- 5. Grants ------------------------------------------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'list_case_comments(uuid,text,integer)', 'bulk_review_comments(uuid[],text)', 'donation_analytics(uuid,integer)',
    'admin_create_collector_invite(uuid,text,integer,text)', 'admin_list_case_collectors(uuid)', 'list_my_collector_cases()', 'accept_collector_invite(text)',
    'review_pledge(uuid,text,integer,text,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  revoke all on function public.list_case_donations(uuid, integer) from public;
  grant execute on function public.list_case_donations(uuid, integer) to anon, authenticated;
end $$;
