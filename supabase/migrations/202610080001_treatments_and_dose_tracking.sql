-- Patient treatments (self-managed or prescribed by a clinician with an active patient grant) and daily dose logs.

create table public.patient_treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  prescriber_id uuid references public.clinician_verifications (user_id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  notes text check (notes is null or char_length(notes) <= 500),
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'stopped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (prescriber_id is null or prescriber_id <> patient_id)
);

create index patient_treatments_patient on public.patient_treatments (patient_id, status, starts_on desc);

create table public.treatment_medications (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.patient_treatments (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  strength text check (strength is null or char_length(strength) <= 40),
  form text check (form is null or char_length(form) <= 40),
  dose text check (dose is null or char_length(dose) <= 60),
  times_of_day text[] not null check (cardinality(times_of_day) between 1 and 6),
  instructions text check (instructions is null or char_length(instructions) <= 200),
  position int not null default 0
);

create index treatment_medications_treatment on public.treatment_medications (treatment_id, position);

create table public.medication_dose_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.treatment_medications (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_for date not null,
  slot text not null check (slot ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status text not null check (status in ('taken', 'skipped')),
  logged_at timestamptz not null default now(),
  unique (medication_id, scheduled_for, slot)
);

create index medication_dose_logs_patient_day on public.medication_dose_logs (patient_id, scheduled_for desc);

alter table public.patient_treatments enable row level security;
alter table public.treatment_medications enable row level security;
alter table public.medication_dose_logs enable row level security;

create policy "patients_read_own_treatments"
  on public.patient_treatments for select to authenticated
  using (patient_id = (select auth.uid()));

create policy "patients_read_own_treatment_medications"
  on public.treatment_medications for select to authenticated
  using (exists (
    select 1 from public.patient_treatments as treatment
    where treatment.id = treatment_id and treatment.patient_id = (select auth.uid())
  ));

create policy "patients_read_own_dose_logs"
  on public.medication_dose_logs for select to authenticated
  using (patient_id = (select auth.uid()));

grant select on public.patient_treatments, public.treatment_medications, public.medication_dose_logs to authenticated;

-- Internal: validates and applies a medication list. Existing rows keep their id (and dose history) when the id is supplied.
create function public.apply_treatment_medications(p_treatment_id uuid, p_medications jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  item_id uuid;
  slots text[];
  position_index int := 0;
  kept uuid[] := '{}';
begin
  if p_medications is null or jsonb_typeof(p_medications) <> 'array' or jsonb_array_length(p_medications) not between 1 and 20 then
    raise exception 'Add between 1 and 20 medicines';
  end if;

  for item in select * from jsonb_array_elements(p_medications) loop
    if coalesce(btrim(item ->> 'name'), '') = '' or char_length(item ->> 'name') > 80 then
      raise exception 'Each medicine needs a name of up to 80 characters';
    end if;
    select coalesce(array_agg(distinct value order by value), '{}') into slots
    from jsonb_array_elements_text(coalesce(item -> 'times', '[]'::jsonb)) as value;
    if cardinality(slots) not between 1 and 6 or exists (select 1 from unnest(slots) as slot where slot !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
      raise exception 'Each medicine needs 1 to 6 dose times like 08:00';
    end if;
    item_id := nullif(item ->> 'id', '')::uuid;

    if item_id is not null and exists (select 1 from public.treatment_medications where id = item_id and treatment_id = p_treatment_id) then
      update public.treatment_medications
      set name = btrim(item ->> 'name'), strength = nullif(btrim(item ->> 'strength'), ''), form = nullif(btrim(item ->> 'form'), ''),
          dose = nullif(btrim(item ->> 'dose'), ''), times_of_day = slots, instructions = nullif(btrim(item ->> 'instructions'), ''),
          position = position_index
      where id = item_id;
    else
      insert into public.treatment_medications (treatment_id, name, strength, form, dose, times_of_day, instructions, position)
      values (p_treatment_id, btrim(item ->> 'name'), nullif(btrim(item ->> 'strength'), ''), nullif(btrim(item ->> 'form'), ''),
              nullif(btrim(item ->> 'dose'), ''), slots, nullif(btrim(item ->> 'instructions'), ''), position_index)
      returning id into item_id;
    end if;
    kept := kept || item_id;
    position_index := position_index + 1;
  end loop;

  delete from public.treatment_medications where treatment_id = p_treatment_id and not (id = any (kept));
end;
$$;

revoke all on function public.apply_treatment_medications(uuid, jsonb) from public, anon, authenticated;

create function public.save_my_treatment(
  p_id uuid, p_name text, p_notes text, p_starts_on date, p_ends_on date, p_medications jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  treatment_id uuid := p_id;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if coalesce(btrim(p_name), '') = '' or char_length(p_name) > 80 then raise exception 'Give the treatment a name of up to 80 characters'; end if;
  if p_ends_on is not null and p_ends_on < coalesce(p_starts_on, current_date) then raise exception 'The end date must be after the start date'; end if;

  if treatment_id is null then
    insert into public.patient_treatments (patient_id, name, notes, starts_on, ends_on)
    values (me, btrim(p_name), nullif(btrim(p_notes), ''), coalesce(p_starts_on, current_date), p_ends_on)
    returning id into treatment_id;
  else
    update public.patient_treatments
    set name = btrim(p_name), notes = nullif(btrim(p_notes), ''), starts_on = coalesce(p_starts_on, starts_on), ends_on = p_ends_on, updated_at = now()
    where id = treatment_id and patient_id = me and prescriber_id is null;
    if not found then raise exception 'This treatment cannot be edited'; end if;
  end if;

  perform public.apply_treatment_medications(treatment_id, p_medications);
  return treatment_id;
end;
$$;

create function public.set_my_treatment_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('active', 'paused', 'completed', 'stopped') then raise exception 'Unknown status'; end if;
  update public.patient_treatments set status = p_status, updated_at = now()
  where id = p_id and patient_id = auth.uid();
  if not found then raise exception 'Treatment not found'; end if;
end;
$$;

create function public.delete_my_treatment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.patient_treatments where id = p_id and patient_id = auth.uid() and prescriber_id is null;
  if not found then raise exception 'Only treatments you created can be deleted. You can stop a prescribed one instead.'; end if;
end;
$$;

create function public.log_my_dose(p_medication_id uuid, p_date date, p_slot text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  if p_date > current_date + 1 or p_date < current_date - 30 then raise exception 'Doses can only be logged for the last 30 days'; end if;
  if not exists (
    select 1 from public.treatment_medications as medication
    join public.patient_treatments as treatment on treatment.id = medication.treatment_id
    where medication.id = p_medication_id and treatment.patient_id = me and p_slot = any (medication.times_of_day)
  ) then raise exception 'Medicine not found'; end if;

  if p_status is null then
    delete from public.medication_dose_logs where medication_id = p_medication_id and scheduled_for = p_date and slot = p_slot and patient_id = me;
  elsif p_status in ('taken', 'skipped') then
    insert into public.medication_dose_logs (medication_id, patient_id, scheduled_for, slot, status)
    values (p_medication_id, me, p_date, p_slot, p_status)
    on conflict (medication_id, scheduled_for, slot) do update set status = excluded.status, logged_at = now();
  else
    raise exception 'Unknown status';
  end if;
end;
$$;

-- Clinician: prescribe for a patient who currently shares their medical profile with this clinician.
create function public.prescribe_treatment(
  p_grant_id uuid, p_name text, p_notes text, p_starts_on date, p_ends_on date, p_medications jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  grant_row public.patient_access_grants%rowtype;
  treatment_id uuid;
begin
  if me is null or not public.is_verified_clinician(me) then raise exception 'A verified clinician account is required'; end if;
  select * into grant_row from public.patient_access_grants
  where id = p_grant_id and clinician_id = me and revoked_at is null and scope ->> 'medical_profile' = 'true';
  if grant_row.id is null then raise exception 'Patient access is revoked or unavailable'; end if;
  if coalesce(btrim(p_name), '') = '' or char_length(p_name) > 80 then raise exception 'Give the treatment a name of up to 80 characters'; end if;
  if p_ends_on is not null and p_ends_on < coalesce(p_starts_on, current_date) then raise exception 'The end date must be after the start date'; end if;

  insert into public.patient_treatments (patient_id, prescriber_id, name, notes, starts_on, ends_on)
  values (grant_row.patient_id, me, btrim(p_name), nullif(btrim(p_notes), ''), coalesce(p_starts_on, current_date), p_ends_on)
  returning id into treatment_id;
  perform public.apply_treatment_medications(treatment_id, p_medications);
  return treatment_id;
end;
$$;

create function public.end_prescribed_treatment(p_treatment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.patient_treatments set status = 'completed', ends_on = least(coalesce(ends_on, current_date), current_date), updated_at = now()
  where id = p_treatment_id and prescriber_id = auth.uid() and status in ('active', 'paused');
  if not found then raise exception 'Treatment not found'; end if;
end;
$$;

-- Clinician: treatments of a patient who shares the medical profile, with 7-day dose counts.
create function public.get_shared_patient_treatments(p_grant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  grant_row public.patient_access_grants%rowtype;
begin
  if me is null or not public.is_verified_clinician(me) then raise exception 'A verified clinician account is required'; end if;
  select * into grant_row from public.patient_access_grants
  where id = p_grant_id and clinician_id = me and revoked_at is null and scope ->> 'medical_profile' = 'true';
  if grant_row.id is null then raise exception 'Patient access is revoked or unavailable'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'notes', t.notes, 'status', t.status, 'starts_on', t.starts_on, 'ends_on', t.ends_on,
      'prescribed_by_me', t.prescriber_id = me, 'prescribed', t.prescriber_id is not null,
      'medications', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id, 'name', m.name, 'strength', m.strength, 'form', m.form, 'dose', m.dose, 'times', m.times_of_day,
          'instructions', m.instructions,
          'taken_7d', (select count(*) from public.medication_dose_logs l where l.medication_id = m.id and l.status = 'taken' and l.scheduled_for > current_date - 7)
        ) order by m.position), '[]'::jsonb)
        from public.treatment_medications m where m.treatment_id = t.id
      )
    ) order by t.created_at desc)
    from public.patient_treatments t where t.patient_id = grant_row.patient_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function
  public.save_my_treatment(uuid, text, text, date, date, jsonb),
  public.set_my_treatment_status(uuid, text),
  public.delete_my_treatment(uuid),
  public.log_my_dose(uuid, date, text, text),
  public.prescribe_treatment(uuid, text, text, date, date, jsonb),
  public.end_prescribed_treatment(uuid),
  public.get_shared_patient_treatments(uuid)
from public, anon;

grant execute on function
  public.save_my_treatment(uuid, text, text, date, date, jsonb),
  public.set_my_treatment_status(uuid, text),
  public.delete_my_treatment(uuid),
  public.log_my_dose(uuid, date, text, text),
  public.prescribe_treatment(uuid, text, text, date, date, jsonb),
  public.end_prescribed_treatment(uuid),
  public.get_shared_patient_treatments(uuid)
to authenticated;

-- Patient: own treatments with medicines and the prescriber's name.
create function public.list_my_treatments()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'notes', t.notes, 'status', t.status, 'starts_on', t.starts_on, 'ends_on', t.ends_on,
      'prescribed', t.prescriber_id is not null,
      'prescriber_name', (select p.display_name from public.profiles p where p.id = t.prescriber_id),
      'medications', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id, 'name', m.name, 'strength', m.strength, 'form', m.form, 'dose', m.dose, 'times', m.times_of_day,
          'instructions', m.instructions
        ) order by m.position), '[]'::jsonb)
        from public.treatment_medications m where m.treatment_id = t.id
      )
    ) order by (t.status = 'active') desc, t.created_at desc)
    from public.patient_treatments t where t.patient_id = me
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_my_treatments() from public, anon;
grant execute on function public.list_my_treatments() to authenticated;
