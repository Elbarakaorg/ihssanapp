-- Resumable, rate-limited QR share codes. The code is single use and still needs the patient's approval,
-- so a 30 minute lifetime is safe; reopening the screen reuses the active code instead of minting a new one.
create or replace function public.get_or_create_patient_profile_share_code(p_force boolean default false)
returns table (share_code uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_patient_id uuid := auth.uid();
begin
  if current_patient_id is null then
    raise exception 'Authentication required';
  end if;

  if not coalesce(p_force, false) then
    return query
    select r.share_code, r.expires_at
    from public.patient_profile_share_requests as r
    where r.patient_id = current_patient_id and r.status = 'issued' and r.expires_at > now()
    order by r.created_at desc
    limit 1;
    if found then return; end if;
  end if;

  if (select count(*) from public.patient_profile_share_requests as r
      where r.patient_id = current_patient_id and r.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many codes created. Try again later.';
  end if;

  update public.patient_profile_share_requests as r
  set status = 'expired'
  where r.patient_id = current_patient_id and r.status = 'issued';

  return query
  insert into public.patient_profile_share_requests (patient_id, expires_at)
  values (current_patient_id, now() + interval '30 minutes')
  returning patient_profile_share_requests.share_code, patient_profile_share_requests.expires_at;
end;
$$;

revoke all on function public.get_or_create_patient_profile_share_code(boolean) from public, anon;
grant execute on function public.get_or_create_patient_profile_share_code(boolean) to authenticated;
