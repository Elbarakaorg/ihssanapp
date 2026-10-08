-- Well-wishes are published immediately; the patient, collectors and admins can delete them afterwards.
update public.donation_case_wishes set status = 'approved' where status = 'pending';
alter table public.donation_case_wishes alter column status set default 'approved';

create or replace function public.post_case_wish(p_case_id uuid, p_body text, p_display_name text default null, p_is_anonymous boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  client_ip text := nullif(trim(split_part(coalesce(headers ->> 'cf-connecting-ip', headers ->> 'x-real-ip', headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  client text;
  body text := trim(coalesce(p_body, ''));
  name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if not exists (select 1 from public.donation_cases where id = p_case_id and status in ('published', 'funded')) then raise exception 'This case is not open for messages'; end if;
  if char_length(body) not between 2 and 500 then raise exception 'Messages must be 2 to 500 characters'; end if;
  if name is not null and char_length(name) not between 2 and 60 then raise exception 'Name must be 2 to 60 characters'; end if;
  if not coalesce(p_is_anonymous, true) and name is null then raise exception 'Add your name or post anonymously'; end if;
  if client_ip is not null then
    client := public.donation_token_hash('ihssan-ip:' || client_ip);
    if (select count(*) from public.donation_case_wishes where client_hash = client and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Too many messages. Please try again later';
    end if;
  end if;
  if auth.uid() is not null and (select count(*) from public.donation_case_wishes where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many messages. Please try again later';
  end if;
  insert into public.donation_case_wishes (case_id, user_id, display_name, is_anonymous, body, client_hash, status)
  values (p_case_id, auth.uid(), case when coalesce(p_is_anonymous, true) then null else name end, coalesce(p_is_anonymous, true), body, client, 'approved');
end;
$$;

create or replace function public.delete_case_wish(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare
  w public.donation_case_wishes;
begin
  select * into w from public.donation_case_wishes where id = p_id;
  if not found or auth.uid() is null or not public.can_moderate_case(w.case_id) then raise exception 'Message not found'; end if;
  delete from public.donation_case_wishes where id = p_id;
end;
$$;
revoke all on function public.delete_case_wish(uuid) from public, anon;
grant execute on function public.delete_case_wish(uuid) to authenticated;
revoke all on function public.post_case_wish(uuid, text, text, boolean) from public;
grant execute on function public.post_case_wish(uuid, text, text, boolean) to anon, authenticated;

-- The video and audio tables are not readable directly, so the admin portal and case managers list them through these functions.
create or replace function public.list_case_videos(p_case_id uuid) returns table (id uuid, kind text, url text, path text, caption text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_moderate_case(p_case_id) then raise exception 'You cannot view this case'; end if;
  return query select v.id, v.kind, v.url, v.path, v.caption from public.donation_case_videos v where v.case_id = p_case_id order by v.sort_order, v.created_at;
end;
$$;

create or replace function public.list_case_audio(p_case_id uuid) returns table (id uuid, path text, title text, duration_seconds integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_moderate_case(p_case_id) then raise exception 'You cannot view this case'; end if;
  return query select a.id, a.path, a.title, a.duration_seconds from public.donation_case_audio a where a.case_id = p_case_id order by a.created_at;
end;
$$;

revoke all on function public.list_case_videos(uuid) from public, anon;
revoke all on function public.list_case_audio(uuid) from public, anon;
grant execute on function public.list_case_videos(uuid) to authenticated;
grant execute on function public.list_case_audio(uuid) to authenticated;
