-- Donor email is mandatory on new orders, never public, and lets a donor find an unfinished order again.

alter table public.donation_pledges
  add column donor_email text check (
    donor_email is null
    or (char_length(donor_email) <= 254 and donor_email = lower(donor_email) and donor_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  );
create index donation_pledges_open_by_email on public.donation_pledges (donor_email, case_id) where status = 'pledged';

-- Lookup attempts, kept a day, to rate limit email recovery.
create table public.donation_lookups (
  key text not null,
  created_at timestamptz not null default now()
);
create index donation_lookups_key on public.donation_lookups (key, created_at);
alter table public.donation_lookups enable row level security;
revoke all on public.donation_lookups from anon, authenticated;

drop function public.create_donation_pledge(uuid, integer, text, boolean, text, text);
create function public.create_donation_pledge(
  p_case_id uuid, p_amount integer, p_display_name text default null, p_is_anonymous boolean default true,
  p_comment text default null, p_contact text default null, p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.donation_cases;
  raw_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_ref text;
  new_id uuid;
  expiry timestamptz := now() + interval '48 hours';
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  client_ip text := nullif(trim(split_part(coalesce(headers ->> 'cf-connecting-ip', headers ->> 'x-real-ip', headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  client text;
  mail text := lower(trim(coalesce(p_email, '')));
begin
  perform public.expire_stale_pledges();
  select * into c from public.donation_cases where id = p_case_id;
  if not found or c.status <> 'published' then raise exception 'This case is not accepting donations'; end if;
  if jsonb_array_length(public.donation_bank_json(c.id)) = 0 then raise exception 'This case cannot accept donations right now'; end if;
  if p_amount is null or p_amount < c.min_donation_mad then raise exception 'The minimum donation is % MAD', c.min_donation_mad; end if;
  if p_amount > 1000000 then raise exception 'Please contact us for donations above 1,000,000 MAD'; end if;
  if p_display_name is not null and char_length(trim(p_display_name)) not between 2 and 60 then raise exception 'Display name must be 2 to 60 characters'; end if;
  if p_comment is not null and char_length(p_comment) > 300 then raise exception 'Comments can be up to 300 characters'; end if;
  if char_length(mail) > 254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
  if exists (select 1 from public.donation_pledges where case_id = c.id and donor_email = mail and status = 'pledged') then
    raise exception 'You already have an unfinished order for this case. Continue or cancel it first';
  end if;

  if client_ip is not null then
    client := public.donation_token_hash('ihssan-ip:' || client_ip);
    if (select count(*) from public.donation_pledges where client_hash = client and created_at > now() - interval '1 hour') >= 8 then
      raise exception 'Too many donation orders. Please try again later';
    end if;
  end if;
  if auth.uid() is not null and (select count(*) from public.donation_pledges where donor_user_id = auth.uid() and status = 'pledged') >= 10 then
    raise exception 'You have many open donation orders. Complete or cancel some first';
  end if;

  loop
    new_ref := 'IH-' || (select string_agg(substr(alphabet, 1 + floor(random() * 31)::integer, 1), '') from generate_series(1, 7));
    exit when not exists (select 1 from public.donation_pledges where reference = new_ref);
  end loop;

  insert into public.donation_pledges (reference, case_id, donor_user_id, token_hash, amount_mad, display_name, is_anonymous, comment, donor_contact, donor_email, expires_at, client_hash)
  values (new_ref, c.id, auth.uid(), public.donation_token_hash(raw_token), p_amount, nullif(trim(coalesce(p_display_name, '')), ''), coalesce(p_is_anonymous, true),
          nullif(trim(coalesce(p_comment, '')), ''), nullif(trim(coalesce(p_contact, '')), ''), mail, expiry, client)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'reference', new_ref, 'token', raw_token, 'expires_at', expiry);
end;
$$;

-- Returns the unpaid, unexpired orders for an email and gives the caller a fresh key for each, replacing the old one.
-- Only orders still waiting for a transfer are returned; confirmed gifts are never exposed.
create function public.find_open_pledges(p_email text, p_case_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  mail text := lower(trim(coalesce(p_email, '')));
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  client_ip text := nullif(trim(split_part(coalesce(headers ->> 'cf-connecting-ip', headers ->> 'x-real-ip', headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  mail_key text;
  ip_key text;
  row_ record;
  raw_token text;
  result jsonb := '[]'::jsonb;
begin
  if char_length(mail) > 254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;

  delete from public.donation_lookups where created_at < now() - interval '1 day';
  mail_key := 'mail:' || public.donation_token_hash(mail);
  ip_key := case when client_ip is not null then 'ip:' || public.donation_token_hash(client_ip) end;
  if (select count(*) from public.donation_lookups where key = mail_key and created_at > now() - interval '1 hour') >= 8
     or (ip_key is not null and (select count(*) from public.donation_lookups where key = ip_key and created_at > now() - interval '1 hour') >= 30) then
    raise exception 'Too many attempts. Please try again later';
  end if;
  insert into public.donation_lookups (key) values (mail_key);
  if ip_key is not null then insert into public.donation_lookups (key) values (ip_key); end if;

  perform public.expire_stale_pledges();
  for row_ in
    select p.id, p.reference, p.case_id, c.title as case_title, p.amount_mad, p.expires_at
    from public.donation_pledges p join public.donation_cases c on c.id = p.case_id
    where p.donor_email = mail and p.status = 'pledged' and p.expires_at > now() and (p_case_id is null or p.case_id = p_case_id)
    order by p.created_at desc
    limit 5
  loop
    raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    update public.donation_pledges set token_hash = public.donation_token_hash(raw_token) where id = row_.id;
    result := result || jsonb_build_object(
      'id', row_.id, 'reference', row_.reference, 'case_id', row_.case_id, 'case_title', row_.case_title,
      'amount_mad', row_.amount_mad, 'expires_at', row_.expires_at, 'token', raw_token
    );
  end loop;
  return result;
end;
$$;

create function public.update_pledge_amount(p_id uuid, p_token text, p_amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.donation_pledges;
  c public.donation_cases;
begin
  perform public.expire_stale_pledges();
  select * into p from public.donation_pledges where id = p_id for update;
  if not found or not (p.token_hash = public.donation_token_hash(p_token) or (auth.uid() is not null and p.donor_user_id = auth.uid())) then
    raise exception 'Donation order not found';
  end if;
  if p.status <> 'pledged' then raise exception 'This order can no longer be changed'; end if;
  select * into c from public.donation_cases where id = p.case_id;
  if c.status <> 'published' then raise exception 'This case is not accepting donations'; end if;
  if p_amount is null or p_amount < c.min_donation_mad then raise exception 'The minimum donation is % MAD', c.min_donation_mad; end if;
  if p_amount > 1000000 then raise exception 'Please contact us for donations above 1,000,000 MAD'; end if;
  update public.donation_pledges set amount_mad = p_amount where id = p.id;
end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'create_donation_pledge(uuid,integer,text,boolean,text,text,text)', 'find_open_pledges(text,uuid)', 'update_pledge_amount(uuid,text,integer)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to anon, authenticated', fn);
  end loop;
end $$;
