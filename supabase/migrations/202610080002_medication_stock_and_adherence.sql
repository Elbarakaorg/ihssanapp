-- Medication stock (refill tracking) and adherence reports for the patient and, with consent, their clinician.

alter table public.treatment_medications
  add column stock_amount numeric(10, 2) check (stock_amount is null or stock_amount >= 0),
  add column stock_set_at timestamptz;

create or replace function public.medication_json(m public.treatment_medications)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id, 'name', m.name, 'strength', m.strength, 'form', m.form, 'amount', m.amount, 'unit', m.unit,
    'frequency', m.frequency, 'interval_days', m.interval_days, 'weekdays', to_jsonb(m.weekdays), 'times', m.times_of_day,
    'duration_value', m.duration_value, 'duration_unit', m.duration_unit, 'ends_on', m.ends_on,
    'max_daily_amount', m.max_daily_amount, 'min_interval_hours', m.min_interval_hours, 'instructions', m.instructions,
    'stock_amount', m.stock_amount,
    'stock_remaining', case when m.stock_amount is null then null else greatest(0, m.stock_amount - coalesce((
      select sum(l.amount) from public.medication_dose_logs as l
      where l.medication_id = m.id and l.status = 'taken' and l.logged_at >= m.stock_set_at
    ), 0)) end
  );
$$;

revoke all on function public.medication_json(public.treatment_medications) from public, anon, authenticated;

-- Patient sets how much of a medicine they have (for example after buying a box). Remaining stock then counts down as doses are taken.
create function public.set_my_medication_stock(p_medication_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 100000) then raise exception 'Enter a stock amount between 0 and 100000'; end if;
  update public.treatment_medications as m
  set stock_amount = p_amount, stock_set_at = case when p_amount is null then null else now() end
  from public.patient_treatments as t
  where m.id = p_medication_id and t.id = m.treatment_id and t.patient_id = auth.uid();
  if not found then raise exception 'Medicine not found'; end if;
end;
$$;

-- Internal: scheduled doses expected vs taken per medicine over the last p_days days (today included).
create function public.adherence_for(p_patient uuid, p_days int)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (select (current_date - (p_days - 1)) as from_day, current_date as to_day),
  b1 as (select 1)
  select coalesce(jsonb_agg(jsonb_build_object(
    'medication_id', m.id, 'name', m.name, 'treatment', t.name, 'frequency', m.frequency, 'unit', m.unit,
    'expected', case when m.frequency = 'as_needed' then null else (
      select count(*) * cardinality(m.times_of_day) from bounds b, generate_series(b.from_day, b.to_day, interval '1 day') as g(d)
      where public.medication_due_on(m, t.starts_on, g.d::date)
    ) end,
    'taken', (select count(*) from public.medication_dose_logs l, bounds b where l.medication_id = m.id and l.status = 'taken' and l.scheduled_for between b.from_day and b.to_day),
    'skipped', (select count(*) from public.medication_dose_logs l, bounds b where l.medication_id = m.id and l.status = 'skipped' and l.scheduled_for between b.from_day and b.to_day),
    'taken_amount', (select coalesce(sum(l.amount), 0) from public.medication_dose_logs l, bounds b where l.medication_id = m.id and l.status = 'taken' and l.scheduled_for between b.from_day and b.to_day)
  ) order by t.name, m.position), '[]'::jsonb)
  from public.treatment_medications as m join public.patient_treatments as t on t.id = m.treatment_id
  where t.patient_id = p_patient and (t.status <> 'stopped' or exists (select 1 from public.medication_dose_logs l where l.medication_id = m.id));
$$;

revoke all on function public.adherence_for(uuid, int) from public, anon, authenticated;

create function public.get_my_adherence(p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_days not between 1 and 90 then raise exception 'Choose 1 to 90 days'; end if;
  return public.adherence_for(auth.uid(), p_days);
end;
$$;

create function public.get_shared_patient_adherence(p_grant_id uuid, p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  patient uuid;
begin
  if me is null or not public.is_verified_clinician(me) then raise exception 'A verified clinician account is required'; end if;
  if p_days not between 1 and 90 then raise exception 'Choose 1 to 90 days'; end if;
  select patient_id into patient from public.patient_access_grants
  where id = p_grant_id and clinician_id = me and revoked_at is null and scope ->> 'medical_profile' = 'true';
  if patient is null then raise exception 'Patient access is revoked or unavailable'; end if;
  return public.adherence_for(patient, p_days);
end;
$$;

revoke all on function public.set_my_medication_stock(uuid, numeric), public.get_my_adherence(int), public.get_shared_patient_adherence(uuid, int) from public, anon;
grant execute on function public.set_my_medication_stock(uuid, numeric), public.get_my_adherence(int), public.get_shared_patient_adherence(uuid, int) to authenticated;
