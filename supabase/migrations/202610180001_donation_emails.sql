-- Donation emails: an unfinished-order reminder (2 hours after the order) and a confirmation, both only for donors who opted in.
-- The API worker reaches this data only through the three email_worker_* functions, guarded by a secret whose hash is stored in
-- email_worker_config (set outside this migration, never in git).

alter table public.donation_pledges
  add column email_updates boolean not null default false,
  add column email_locale text check (email_locale in ('en', 'fr', 'ar')),
  add column email_consent_at timestamptz;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('order_reminder', 'donation_confirmed')),
  pledge_id uuid not null references public.donation_pledges (id) on delete cascade,
  dedupe_key text not null unique,
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0,
  locked_until timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  resend_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_due on public.email_outbox (run_at) where status in ('pending', 'processing');
create index email_outbox_pledge on public.email_outbox (pledge_id);

create table public.email_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null default 'opt_out',
  created_at timestamptz not null default now()
);

create table public.email_worker_config (
  id boolean primary key default true check (id),
  secret_hash text not null
);

alter table public.email_outbox enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_worker_config enable row level security;
revoke all on public.email_outbox, public.email_suppressions, public.email_worker_config from anon, authenticated;

create function public.email_worker_ok(p_secret text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.email_worker_config where secret_hash = public.donation_token_hash(p_secret));
$$;
revoke all on function public.email_worker_ok(text) from public, anon, authenticated;

-- The donor (holding the order key) turns updates on or off right after creating the order. Consent time and language are recorded.
create function public.set_pledge_email_updates(p_id uuid, p_token text, p_enabled boolean, p_locale text default 'en')
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.donation_pledges;
  enabled boolean := coalesce(p_enabled, false);
begin
  select * into p from public.donation_pledges where id = p_id for update;
  if not found or not (p.token_hash = public.donation_token_hash(p_token) or (auth.uid() is not null and p.donor_user_id = auth.uid())) then
    raise exception 'Donation order not found';
  end if;
  if p.donor_email is null then return; end if;
  update public.donation_pledges
  set email_updates = enabled,
      email_locale = case when p_locale in ('en', 'fr', 'ar') then p_locale else 'en' end,
      email_consent_at = case when enabled then now() end
  where id = p.id;
  if enabled and p.status = 'pledged' and p.source = 'platform' then
    insert into public.email_outbox (kind, pledge_id, dedupe_key, run_at)
    values ('order_reminder', p.id, 'reminder:' || p.id, p.created_at + interval '2 hours')
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

-- Confirmation is queued by the status change itself, so it works for every version of review_pledge. The dedupe key means a
-- reversed-then-reconfirmed gift never emails twice.
create function public.enqueue_donation_confirmed_email() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' and new.email_updates and new.donor_email is not null and new.source = 'platform' then
    insert into public.email_outbox (kind, pledge_id, dedupe_key, run_at)
    values ('donation_confirmed', new.id, 'confirmed:' || new.id, now())
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_donation_confirmed_email() from public, anon, authenticated;
create trigger donation_pledges_confirmed_email after update of status on public.donation_pledges
  for each row execute function public.enqueue_donation_confirmed_email();

-- Claims due jobs, drops the ones that no longer apply, and returns only what the email needs (no bank details, receipts or tokens).
create function public.email_worker_claim(p_secret text, p_limit integer default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.email_outbox;
  p public.donation_pledges;
  c public.donation_cases;
  skip_reason text;
  jobs jsonb := '[]'::jsonb;
  ids uuid[];
  job_id uuid;
begin
  if not public.email_worker_ok(p_secret) then raise exception 'Not allowed'; end if;

  select coalesce(array_agg(due.id), '{}') into ids from (
    select e.id from public.email_outbox e
    where e.status in ('pending', 'processing') and e.run_at <= now() and (e.locked_until is null or e.locked_until < now())
    order by e.run_at
    limit greatest(1, least(coalesce(p_limit, 10), 25))
    for update skip locked
  ) due;

  foreach job_id in array ids loop
    select * into o from public.email_outbox where id = job_id;
    select * into p from public.donation_pledges where id = o.pledge_id;
    select * into c from public.donation_cases where id = p.case_id;

    skip_reason := case
      when not p.email_updates or p.donor_email is null then 'no consent'
      when exists (select 1 from public.email_suppressions s where s.email = p.donor_email) then 'opted out'
      when o.kind = 'order_reminder' and (p.status <> 'pledged' or p.expires_at <= now()) then 'order no longer open'
      when o.kind = 'order_reminder' and exists (
        select 1 from public.email_outbox o2 join public.donation_pledges p2 on p2.id = o2.pledge_id
        where o2.kind = 'order_reminder' and o2.id <> o.id and p2.donor_email = p.donor_email
          and (o2.status = 'processing' or (o2.status = 'sent' and o2.sent_at > now() - interval '24 hours'))
      ) then 'recent reminder to this address'
      when o.kind = 'donation_confirmed' and p.status <> 'confirmed' then 'not confirmed'
    end;

    if skip_reason is not null then
      update public.email_outbox set status = 'skipped', last_error = skip_reason, locked_until = null where id = job_id;
      continue;
    end if;

    update public.email_outbox set status = 'processing', attempts = attempts + 1, locked_until = now() + interval '5 minutes' where id = job_id;
    jobs := jobs || jsonb_build_object(
      'id', o.id, 'kind', o.kind, 'pledge_id', p.id, 'email', p.donor_email, 'locale', coalesce(p.email_locale, 'en'),
      'reference', p.reference, 'amount_mad', case when o.kind = 'donation_confirmed' then coalesce(p.confirmed_amount_mad, p.amount_mad) else p.amount_mad end,
      'expires_at', p.expires_at, 'case_title', c.title, 'case_slug', coalesce(c.slug, c.id::text), 'attempt', o.attempts + 1
    );
  end loop;
  return jobs;
end;
$$;

create function public.email_worker_complete(p_secret text, p_id uuid, p_ok boolean, p_resend_id text default null, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.email_worker_ok(p_secret) then raise exception 'Not allowed'; end if;
  if p_ok then
    update public.email_outbox set status = 'sent', sent_at = now(), resend_id = left(p_resend_id, 100), locked_until = null, last_error = null
    where id = p_id and status = 'processing';
  else
    update public.email_outbox
    set status = case when attempts >= 5 then 'failed' else 'pending' end,
        run_at = now() + (interval '1 minute' * power(2, attempts)::double precision),
        locked_until = null, last_error = left(coalesce(p_error, 'send failed'), 300)
    where id = p_id and status = 'processing';
  end if;
end;
$$;

-- One click from any email: stops everything for that address and cancels what is still queued.
create function public.email_worker_optout(p_secret text, p_pledge_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare
  mail text;
begin
  if not public.email_worker_ok(p_secret) then raise exception 'Not allowed'; end if;
  select donor_email into mail from public.donation_pledges where id = p_pledge_id;
  if mail is null then return; end if;
  insert into public.email_suppressions (email) values (mail) on conflict do nothing;
  update public.donation_pledges set email_updates = false where donor_email = mail and email_updates;
  update public.email_outbox set status = 'skipped', last_error = 'opted out', locked_until = null
  where status in ('pending', 'processing') and pledge_id in (select id from public.donation_pledges where donor_email = mail);
end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'set_pledge_email_updates(uuid,text,boolean,text)', 'email_worker_claim(text,integer)',
    'email_worker_complete(text,uuid,boolean,text,text)', 'email_worker_optout(text,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to anon, authenticated', fn);
  end loop;
end $$;
