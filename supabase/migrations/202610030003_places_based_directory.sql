-- Locations now come from Google Places (via the API service). The hand-entered provider table is unused.
drop table if exists public.care_providers;

alter table public.clinician_practice_locations
  add column doctor_name text;

alter table public.clinician_practice_locations
  alter column google_place_id set not null;

create unique index clinician_practice_locations_unique_place
  on public.clinician_practice_locations (clinician_id, google_place_id);

create or replace function public.guard_practice_location_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_reviewer boolean := (select public.has_ihssan_permission('providers.verify'));
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' and new.clinician_id <> old.clinician_id then
    raise exception 'clinician_id cannot change';
  end if;

  -- Public doctor name always comes from the verified registration, never from client input.
  new.doctor_name := (select v.public_name from public.clinician_verifications v where v.user_id = new.clinician_id);

  if new.status = 'verified' then
    if not exists (
      select 1 from public.clinician_verifications v
      where v.user_id = new.clinician_id and v.verification_status = 'verified'
    ) then
      raise exception 'clinician is not verified';
    end if;
  end if;

  if is_reviewer then
    if new.status in ('verified', 'rejected') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      new.reviewed_by := (select auth.uid());
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
