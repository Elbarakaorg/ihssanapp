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
  -- 1. How much: the prescribed amount for one intake.
  amount numeric(8, 2) not null check (amount > 0),
  unit text not null check (unit in ('tablet', 'capsule', 'drop', 'ml', 'mg', 'g', 'IU', 'puff', 'spray', 'sachet', 'patch', 'injection', 'teaspoon', 'tablespoon', 'suppository', 'unit')),
  -- 2. How often.
  frequency text not null default 'daily' check (frequency in ('daily', 'interval', 'weekly', 'as_needed')),
  interval_days int check (interval_days is null or interval_days between 2 and 365),
  weekdays smallint[] check (weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])),
  times_of_day text[] not null default '{}' check (cardinality(times_of_day) <= 6),
  -- 3. For how long. Null duration means ongoing.
  duration_value int check (duration_value is null or duration_value between 1 and 3650),
  duration_unit text check (duration_unit is null or duration_unit in ('days', 'weeks', 'months')),
  ends_on date,
  -- As-needed medicines: the prescribed amount above is per intake; these cap the use.
  max_daily_amount numeric(8, 2) check (max_daily_amount is null or max_daily_amount > 0),
  min_interval_hours int check (min_interval_hours is null or min_interval_hours between 1 and 24),
  instructions text check (instructions is null or char_length(instructions) <= 200),
  position int not null default 0,
  check ((duration_value is null) = (duration_unit is null)),
  check ((frequency = 'interval') = (interval_days is not null)),
  check ((frequency = 'weekly') = (weekdays is not null)),
  check ((frequency = 'as_needed') = (cardinality(times_of_day) = 0)),
  check (frequency = 'as_needed' or cardinality(times_of_day) >= 1),
  check ((frequency = 'as_needed') = (max_daily_amount is not null)),
  check (max_daily_amount is null or max_daily_amount >= amount),
  check (frequency = 'as_needed' or min_interval_hours is null)
);

create index treatment_medications_treatment on public.treatment_medications (treatment_id, position);

create table public.medication_dose_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.treatment_medications (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_for date not null,
  slot text not null check (slot ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status text not null check (status in ('taken', 'skipped')),
  amount numeric(8, 2),
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

-- Internal: is a scheduled medicine due on a date (as-needed medicines are never "due").
create function public.medication_due_on(m public.treatment_medications, p_starts_on date, p_date date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_date >= p_starts_on and (m.ends_on is null or p_date <= m.ends_on) and case m.frequency
    when 'daily' then true
    when 'interval' then (p_date - p_starts_on) % m.interval_days = 0
    when 'weekly' then extract(dow from p_date)::smallint = any (m.weekdays)
    else false
  end;
$$;

create function public.medication_json(m public.treatment_medications)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id, 'name', m.name, 'strength', m.strength, 'form', m.form, 'amount', m.amount, 'unit', m.unit,
    'frequency', m.frequency, 'interval_days', m.interval_days, 'weekdays', to_jsonb(m.weekdays), 'times', m.times_of_day,
    'duration_value', m.duration_value, 'duration_unit', m.duration_unit, 'ends_on', m.ends_on,
    'max_daily_amount', m.max_daily_amount, 'min_interval_hours', m.min_interval_hours, 'instructions', m.instructions
  );
$$;

revoke all on function public.medication_due_on(public.treatment_medications, date, date), public.medication_json(public.treatment_medications) from public, anon, authenticated;

-- Internal: validates and applies a medication list. Existing rows keep their id (and dose history) when the id is supplied.
create function public.apply_treatment_medications(p_treatment_id uuid, p_starts_on date, p_medications jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  item_id uuid;
  med_name text;
  freq text;
  med_amount numeric;
  med_unit text;
  slots text[];
  days int;
  wdays smallint[];
  dur_value int;
  dur_unit text;
  med_ends date;
  max_amount numeric;
  min_hours int;
  position_index int := 0;
  kept uuid[] := '{}';
begin
  if p_medications is null or jsonb_typeof(p_medications) <> 'array' or jsonb_array_length(p_medications) not between 1 and 20 then
    raise exception 'Add between 1 and 20 medicines';
  end if;

  for item in select * from jsonb_array_elements(p_medications) loop
    med_name := btrim(coalesce(item ->> 'name', ''));
    if med_name = '' or char_length(med_name) > 80 then raise exception 'Each medicine needs a name of up to 80 characters'; end if;

    med_amount := nullif(btrim(coalesce(item ->> 'amount', '')), '')::numeric;
    if med_amount is null or med_amount <= 0 or med_amount > 10000 then raise exception 'Enter how much to take each time for %', med_name; end if;
    med_unit := coalesce(item ->> 'unit', '');
    if med_unit not in ('tablet', 'capsule', 'drop', 'ml', 'mg', 'g', 'IU', 'puff', 'spray', 'sachet', 'patch', 'injection', 'teaspoon', 'tablespoon', 'suppository', 'unit') then
      raise exception 'Choose a unit for %', med_name;
    end if;

    freq := coalesce(nullif(item ->> 'frequency', ''), 'daily');
    if freq not in ('daily', 'interval', 'weekly', 'as_needed') then raise exception 'Unknown frequency for %', med_name; end if;

    select coalesce(array_agg(distinct value order by value), '{}') into slots
    from jsonb_array_elements_text(coalesce(item -> 'times', '[]'::jsonb)) as value;
    if exists (select 1 from unnest(slots) as slot where slot !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Dose times must look like 08:00'; end if;
    if freq = 'as_needed' then slots := '{}';
    elsif cardinality(slots) not between 1 and 6 then raise exception 'Choose 1 to 6 dose times for %', med_name;
    end if;

    days := null;
    if freq = 'interval' then
      days := nullif(item ->> 'interval_days', '')::int;
      if days is null or days not between 2 and 365 then raise exception 'Choose how many days apart each dose is (2 to 365) for %', med_name; end if;
    end if;

    wdays := null;
    if freq = 'weekly' then
      select array_agg(distinct value::smallint order by value::smallint) into wdays
      from jsonb_array_elements_text(coalesce(item -> 'weekdays', '[]'::jsonb)) as value;
      if wdays is null or cardinality(wdays) not between 1 and 7 or not (wdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]) then raise exception 'Choose the weekdays for %', med_name; end if;
    end if;

    dur_unit := nullif(item ->> 'duration_unit', '');
    dur_value := case when dur_unit is null then null else nullif(item ->> 'duration_value', '')::int end;
    med_ends := null;
    if dur_unit is not null then
      if dur_unit not in ('days', 'weeks', 'months') or dur_value is null or dur_value < 1
         or dur_value > (select (array[3650, 520, 120])[array_position(array['days', 'weeks', 'months'], dur_unit)]) then
        raise exception 'Enter how long to take % for', med_name;
      end if;
      med_ends := case dur_unit
        when 'days' then p_starts_on + dur_value - 1
        when 'weeks' then p_starts_on + dur_value * 7 - 1
        else (p_starts_on + (dur_value || ' months')::interval)::date - 1
      end;
    end if;

    max_amount := null;
    min_hours := null;
    if freq = 'as_needed' then
      max_amount := nullif(btrim(coalesce(item ->> 'max_daily_amount', '')), '')::numeric;
      if max_amount is null or max_amount < med_amount or max_amount > 100000 then raise exception 'Set a maximum amount per day for % that is at least one dose', med_name; end if;
      min_hours := nullif(item ->> 'min_interval_hours', '')::int;
      if min_hours is not null and min_hours not between 1 and 24 then raise exception 'Hours between doses must be 1 to 24'; end if;
    end if;

    item_id := nullif(item ->> 'id', '')::uuid;
    if item_id is not null and exists (select 1 from public.treatment_medications where id = item_id and treatment_id = p_treatment_id) then
      update public.treatment_medications
      set name = med_name, strength = nullif(btrim(item ->> 'strength'), ''), form = nullif(btrim(item ->> 'form'), ''),
          amount = med_amount, unit = med_unit, frequency = freq, interval_days = days, weekdays = wdays, times_of_day = slots,
          duration_value = dur_value, duration_unit = dur_unit, ends_on = med_ends, max_daily_amount = max_amount, min_interval_hours = min_hours,
          instructions = nullif(btrim(item ->> 'instructions'), ''), position = position_index
      where id = item_id;
    else
      insert into public.treatment_medications (treatment_id, name, strength, form, amount, unit, frequency, interval_days, weekdays, times_of_day,
        duration_value, duration_unit, ends_on, max_daily_amount, min_interval_hours, instructions, position)
      values (p_treatment_id, med_name, nullif(btrim(item ->> 'strength'), ''), nullif(btrim(item ->> 'form'), ''), med_amount, med_unit, freq, days, wdays, slots,
        dur_value, dur_unit, med_ends, max_amount, min_hours, nullif(btrim(item ->> 'instructions'), ''), position_index)
      returning id into item_id;
    end if;
    kept := kept || item_id;
    position_index := position_index + 1;
  end loop;

  delete from public.treatment_medications where treatment_id = p_treatment_id and not (id = any (kept));

  -- The treatment ends when its last medicine ends; any ongoing medicine keeps it open.
  update public.patient_treatments as t
  set ends_on = case
    when exists (select 1 from public.treatment_medications as m where m.treatment_id = t.id and m.ends_on is null) then null
    else (select max(m.ends_on) from public.treatment_medications as m where m.treatment_id = t.id)
  end
  where t.id = p_treatment_id;
end;
$$;

revoke all on function public.apply_treatment_medications(uuid, date, jsonb) from public, anon, authenticated;

create function public.save_my_treatment(
  p_id uuid, p_name text, p_notes text, p_starts_on date, p_medications jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  treatment_id uuid := p_id;
  start_date date;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if coalesce(btrim(p_name), '') = '' or char_length(p_name) > 80 then raise exception 'Give the treatment a name of up to 80 characters'; end if;

  if treatment_id is null then
    insert into public.patient_treatments (patient_id, name, notes, starts_on)
    values (me, btrim(p_name), nullif(btrim(p_notes), ''), coalesce(p_starts_on, current_date))
    returning id, starts_on into treatment_id, start_date;
  else
    update public.patient_treatments
    set name = btrim(p_name), notes = nullif(btrim(p_notes), ''), starts_on = coalesce(p_starts_on, starts_on), updated_at = now()
    where id = treatment_id and patient_id = me and prescriber_id is null
    returning starts_on into start_date;
    if not found then raise exception 'This treatment cannot be edited'; end if;
  end if;

  perform public.apply_treatment_medications(treatment_id, start_date, p_medications);
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

-- Scheduled medicines: log (or clear) one dose slot on a day the medicine is actually due.
create function public.log_my_dose(p_medication_id uuid, p_date date, p_slot text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  med public.treatment_medications%rowtype;
  start_date date;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if p_date > current_date + 1 or p_date < current_date - 30 then raise exception 'Doses can only be logged for the last 30 days'; end if;
  select m.* into med from public.treatment_medications as m
  join public.patient_treatments as t on t.id = m.treatment_id
  where m.id = p_medication_id and t.patient_id = me;
  select t.starts_on into start_date from public.patient_treatments as t where t.id = med.treatment_id;
  if med.id is null or med.frequency = 'as_needed' or not (p_slot = any (med.times_of_day)) or not public.medication_due_on(med, start_date, p_date) then
    raise exception 'This dose is not scheduled for that day';
  end if;

  if p_status is null then
    delete from public.medication_dose_logs where medication_id = p_medication_id and scheduled_for = p_date and slot = p_slot and patient_id = me;
  elsif p_status in ('taken', 'skipped') then
    insert into public.medication_dose_logs (medication_id, patient_id, scheduled_for, slot, status, amount)
    values (p_medication_id, me, p_date, p_slot, p_status, case when p_status = 'taken' then med.amount end)
    on conflict (medication_id, scheduled_for, slot) do update set status = excluded.status, amount = excluded.amount, logged_at = now();
  else
    raise exception 'Unknown status';
  end if;
end;
$$;

-- As-needed medicines: log one intake (the prescribed amount) at a time of day, never beyond the daily maximum or the minimum gap.
create function public.log_my_as_needed_dose(p_medication_id uuid, p_date date, p_slot text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  med public.treatment_medications%rowtype;
  start_date date;
  treatment_status text;
  taken_today numeric;
  moment timestamp;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if p_slot !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid time'; end if;
  if p_date > current_date + 1 or p_date < current_date - 30 then raise exception 'Doses can only be logged for the last 30 days'; end if;
  select m.* into med from public.treatment_medications as m
  join public.patient_treatments as t on t.id = m.treatment_id
  where m.id = p_medication_id and t.patient_id = me;
  select t.starts_on, t.status into start_date, treatment_status from public.patient_treatments as t where t.id = med.treatment_id;
  if med.id is null or med.frequency <> 'as_needed' or p_date < start_date or (med.ends_on is not null and p_date > med.ends_on) then
    raise exception 'This medicine is not available to log on that day';
  end if;

  if p_status is null then
    delete from public.medication_dose_logs where medication_id = p_medication_id and scheduled_for = p_date and slot = p_slot and patient_id = me;
    return;
  end if;
  if p_status <> 'taken' then raise exception 'Unknown status'; end if;
  if treatment_status <> 'active' then raise exception 'This treatment is not active'; end if;

  select coalesce(sum(l.amount), 0) into taken_today from public.medication_dose_logs as l
  where l.medication_id = med.id and l.scheduled_for = p_date and l.status = 'taken' and l.slot <> p_slot;
  if taken_today + med.amount > med.max_daily_amount then
    raise exception 'Daily maximum of % % reached. Do not take more; if you already did, tell your doctor or pharmacist.', trim_scale(med.max_daily_amount), med.unit;
  end if;

  moment := p_date + p_slot::time;
  if med.min_interval_hours is not null and exists (
    select 1 from public.medication_dose_logs as l
    where l.medication_id = med.id and l.status = 'taken' and not (l.scheduled_for = p_date and l.slot = p_slot)
      and abs(extract(epoch from ((l.scheduled_for + l.slot::time) - moment))) < med.min_interval_hours * 3600
  ) then
    raise exception 'Wait at least % hours between doses.', med.min_interval_hours;
  end if;

  insert into public.medication_dose_logs (medication_id, patient_id, scheduled_for, slot, status, amount)
  values (med.id, me, p_date, p_slot, 'taken', med.amount)
  on conflict (medication_id, scheduled_for, slot) do nothing;
end;
$$;

-- Clinician: prescribe for a patient who currently shares their medical profile with this clinician.
create function public.prescribe_treatment(
  p_grant_id uuid, p_name text, p_notes text, p_starts_on date, p_medications jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  grant_row public.patient_access_grants%rowtype;
  treatment_id uuid;
  start_date date := coalesce(p_starts_on, current_date);
begin
  if me is null or not public.is_verified_clinician(me) then raise exception 'A verified clinician account is required'; end if;
  select * into grant_row from public.patient_access_grants
  where id = p_grant_id and clinician_id = me and revoked_at is null and scope ->> 'medical_profile' = 'true';
  if grant_row.id is null then raise exception 'Patient access is revoked or unavailable'; end if;
  if coalesce(btrim(p_name), '') = '' or char_length(p_name) > 80 then raise exception 'Give the treatment a name of up to 80 characters'; end if;

  insert into public.patient_treatments (patient_id, prescriber_id, name, notes, starts_on)
  values (grant_row.patient_id, me, btrim(p_name), nullif(btrim(p_notes), ''), start_date)
  returning id into treatment_id;
  perform public.apply_treatment_medications(treatment_id, start_date, p_medications);
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
        select coalesce(jsonb_agg(public.medication_json(m) || jsonb_build_object(
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
  public.save_my_treatment(uuid, text, text, date, jsonb),
  public.set_my_treatment_status(uuid, text),
  public.delete_my_treatment(uuid),
  public.log_my_dose(uuid, date, text, text),
  public.log_my_as_needed_dose(uuid, date, text, text),
  public.prescribe_treatment(uuid, text, text, date, jsonb),
  public.end_prescribed_treatment(uuid),
  public.get_shared_patient_treatments(uuid)
from public, anon;

grant execute on function
  public.save_my_treatment(uuid, text, text, date, jsonb),
  public.set_my_treatment_status(uuid, text),
  public.delete_my_treatment(uuid),
  public.log_my_dose(uuid, date, text, text),
  public.log_my_as_needed_dose(uuid, date, text, text),
  public.prescribe_treatment(uuid, text, text, date, jsonb),
  public.end_prescribed_treatment(uuid),
  public.get_shared_patient_treatments(uuid)
to authenticated;

-- Patient: own treatments with medicines and the prescriber's name.
create function public.list_my_treatments()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  -- Treatments whose last medicine has ended complete themselves.
  update public.patient_treatments set status = 'completed', updated_at = now()
  where patient_id = me and status = 'active' and ends_on is not null and ends_on < current_date;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'notes', t.notes, 'status', t.status, 'starts_on', t.starts_on, 'ends_on', t.ends_on,
      'prescribed', t.prescriber_id is not null,
      'prescriber_name', (select p.display_name from public.profiles p where p.id = t.prescriber_id),
      'medications', (
        select coalesce(jsonb_agg(public.medication_json(m) order by m.position), '[]'::jsonb)
        from public.treatment_medications m where m.treatment_id = t.id
      )
    ) order by (t.status = 'active') desc, t.created_at desc)
    from public.patient_treatments t where t.patient_id = me
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_my_treatments() from public, anon;
grant execute on function public.list_my_treatments() to authenticated;
