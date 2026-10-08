-- Accepting a second invitation for a case you already belong to upgrades your role (collector > beneficiary)
-- instead of silently using up the link.
create or replace function public.accept_collector_invite(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv public.donation_collector_invites;
  existing public.donation_case_collectors;
  final_role text;
begin
  if auth.uid() is null then raise exception 'Sign in to accept this invitation'; end if;
  select * into inv from public.donation_collector_invites where token_hash = public.donation_token_hash(p_token) for update;
  if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at < now() then raise exception 'This invitation is invalid or has expired'; end if;
  select * into existing from public.donation_case_collectors where case_id = inv.case_id and user_id = auth.uid() and revoked_at is null for update;
  if not found then
    insert into public.donation_case_collectors (case_id, user_id, label, granted_by, role) values (inv.case_id, auth.uid(), inv.label, inv.created_by, inv.role);
    final_role := inv.role;
  elsif existing.role = 'beneficiary' and inv.role = 'collector' then
    update public.donation_case_collectors set role = 'collector' where id = existing.id;
    final_role := 'collector';
  else
    final_role := existing.role;
  end if;
  update public.donation_collector_invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return jsonb_build_object('case_id', inv.case_id, 'case_title', (select title from public.donation_cases where id = inv.case_id), 'role', final_role);
end;
$$;

