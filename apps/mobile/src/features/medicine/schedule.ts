export type Frequency = 'daily' | 'interval' | 'weekly' | 'as_needed';
export type DurationUnit = 'days' | 'weeks' | 'months';

/** Must match the unit check in the treatments migration. */
export const doseUnits = ['tablet', 'capsule', 'drop', 'ml', 'mg', 'g', 'IU', 'puff', 'spray', 'sachet', 'patch', 'injection', 'teaspoon', 'tablespoon', 'suppository', 'unit'] as const;
export type DoseUnit = (typeof doseUnits)[number];
const invariantUnits = new Set<string>(['ml', 'mg', 'g', 'IU', 'unit']);

export type TreatmentMedication = {
  id: string; name: string; strength: string | null; form: string | null;
  amount: number; unit: string;
  frequency: Frequency; interval_days: number | null; weekdays: number[] | null; times: string[];
  duration_value: number | null; duration_unit: DurationUnit | null; ends_on: string | null;
  max_daily_amount: number | null; min_interval_hours: number | null; instructions: string | null;
};
export type Treatment = {
  id: string; name: string; notes: string | null; status: 'active' | 'paused' | 'completed' | 'stopped';
  starts_on: string; ends_on: string | null; prescribed: boolean; prescriber_name?: string | null; medications: TreatmentMedication[];
};
export type DoseLog = { medication_id: string; scheduled_for: string; slot: string; status: 'taken' | 'skipped'; amount?: number | null };
export type Dose = { key: string; medicationId: string; treatmentId: string; treatmentName: string; name: string; label: string; slot: string; instructions: string | null; status: 'taken' | 'skipped' | 'due' | 'missed' };

export const toLocalDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayNumber = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
const trimNumber = (n: number) => String(Number(n.toFixed(2)));

export function formatAmount(amount: number, unit: string) {
  const plural = amount !== 1 && !invariantUnits.has(unit);
  return `${trimNumber(amount)} ${unit}${plural ? 's' : ''}`;
}

export function describeDuration(m: Pick<TreatmentMedication, 'duration_value' | 'duration_unit'>) {
  if (!m.duration_value || !m.duration_unit) return 'ongoing';
  const unit = m.duration_value === 1 ? m.duration_unit.slice(0, -1) : m.duration_unit;
  return `for ${m.duration_value} ${unit}`;
}

/** "1 capsule · every 15 days · for 3 months". As-needed medicines state their maximum instead. */
export function describeSchedule(m: TreatmentMedication) {
  const dose = formatAmount(m.amount, m.unit);
  const times = m.times.length ? ` at ${m.times.join(', ')}` : '';
  const cadence = {
    daily: `${m.times.length === 1 ? 'once' : `${m.times.length} times`} a day${times}`,
    interval: `every ${m.interval_days} days${times}`,
    weekly: `${(m.weekdays ?? []).map((d) => weekdayNames[d]).join(', ')}${times}`,
    as_needed: `as needed, max ${formatAmount(m.max_daily_amount ?? m.amount, m.unit)} a day${m.min_interval_hours ? `, ${m.min_interval_hours} h apart` : ''}`,
  }[m.frequency];
  return `${dose} · ${cadence} · ${describeDuration(m)}`;
}

/** Whether a scheduled (not as-needed) medicine is due on a day. Mirrors medication_due_on in the migration. */
export function isMedicationDue(treatment: Pick<Treatment, 'starts_on'>, m: TreatmentMedication, dateKey: string) {
  if (dateKey < treatment.starts_on || (m.ends_on && dateKey > m.ends_on)) return false;
  switch (m.frequency) {
    case 'daily': return true;
    case 'interval': return !!m.interval_days && (dayNumber(dateKey) - dayNumber(treatment.starts_on)) % m.interval_days === 0;
    case 'weekly': return !!m.weekdays?.includes(new Date(`${dateKey}T00:00:00Z`).getUTCDay());
    default: return false;
  }
}

export function isTreatmentRunning(treatment: Treatment, dateKey: string) {
  return treatment.status === 'active' && treatment.starts_on <= dateKey && (!treatment.ends_on || treatment.ends_on >= dateKey);
}

/** All scheduled doses for a day with their logged state. A dose later than `now` is "due"; an unlogged earlier one is "missed" once an hour has passed. */
export function dosesForDay(treatments: Treatment[], logs: DoseLog[], dateKey: string, now = new Date()): Dose[] {
  const logged = new Map(logs.filter((l) => l.scheduled_for === dateKey).map((l) => [`${l.medication_id}|${l.slot}`, l.status]));
  const today = toLocalDateKey(now) === dateKey;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const doses: Dose[] = [];
  for (const treatment of treatments) {
    if (!isTreatmentRunning(treatment, dateKey)) continue;
    for (const medication of treatment.medications) {
      if (!isMedicationDue(treatment, medication, dateKey)) continue;
      for (const slot of medication.times) {
        const [h, m] = slot.split(':').map(Number);
        const state = logged.get(`${medication.id}|${slot}`);
        const overdue = dateKey < toLocalDateKey(now) || (today && h * 60 + m + 60 < nowMinutes);
        doses.push({
          key: `${medication.id}|${slot}`, medicationId: medication.id, treatmentId: treatment.id, treatmentName: treatment.name,
          name: medication.name, label: [medication.strength, formatAmount(medication.amount, medication.unit)].filter(Boolean).join(' · '), slot,
          instructions: medication.instructions, status: state ?? (overdue ? 'missed' : 'due'),
        });
      }
    }
  }
  return doses.sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
}

export function progressOf(doses: Dose[]) {
  const taken = doses.filter((d) => d.status === 'taken').length;
  return { taken, total: doses.length, percent: doses.length ? Math.round((taken / doses.length) * 100) : 0 };
}

/** Taken / scheduled for each of the last `days` days ending at `end`, oldest first. */
export function weeklyAdherence(treatments: Treatment[], logs: DoseLog[], end: Date, days = 7) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() - (days - 1 - i));
    const key = toLocalDateKey(d);
    return { dateKey: key, date: d, ...progressOf(dosesForDay(treatments, logs, key, end)) };
  });
}

export type AsNeededState = {
  medication: TreatmentMedication; treatment: Treatment; takenAmount: number; remaining: number;
  intakes: DoseLog[]; canTake: boolean; reason: string | null;
};

const minutesOf = (dateKey: string, slot: string) => dayNumber(dateKey) * 1440 + Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3, 5));

/** As-needed medicines available today, with what has been taken against the daily maximum and the minimum gap between doses. */
export function asNeededForDay(treatments: Treatment[], logs: DoseLog[], dateKey: string, now = new Date()): AsNeededState[] {
  const nowSlot = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const result: AsNeededState[] = [];
  for (const treatment of treatments) {
    if (!isTreatmentRunning(treatment, dateKey)) continue;
    for (const medication of treatment.medications) {
      if (medication.frequency !== 'as_needed' || (medication.ends_on && dateKey > medication.ends_on)) continue;
      const taken = logs.filter((l) => l.medication_id === medication.id && l.status === 'taken');
      const intakes = taken.filter((l) => l.scheduled_for === dateKey).sort((a, b) => a.slot.localeCompare(b.slot));
      const takenAmount = intakes.reduce((sum, l) => sum + (l.amount ?? medication.amount), 0);
      const max = medication.max_daily_amount ?? medication.amount;
      const remaining = Math.max(0, max - takenAmount);
      let reason: string | null = null;
      if (takenAmount + medication.amount > max) reason = `Daily maximum of ${formatAmount(max, medication.unit)} reached. Do not take more.`;
      else if (medication.min_interval_hours) {
        const gapMinutes = medication.min_interval_hours * 60;
        const last = taken.map((l) => minutesOf(l.scheduled_for, l.slot)).filter((m) => m <= minutesOf(dateKey, nowSlot)).sort((a, b) => b - a)[0];
        if (last !== undefined && minutesOf(dateKey, nowSlot) - last < gapMinutes) {
          const wait = gapMinutes - (minutesOf(dateKey, nowSlot) - last);
          reason = `Wait ${Math.floor(wait / 60) ? `${Math.floor(wait / 60)} h ` : ''}${wait % 60} min before the next dose.`;
        }
      }
      result.push({ medication, treatment, takenAmount, remaining, intakes, canTake: !reason, reason });
    }
  }
  return result;
}
