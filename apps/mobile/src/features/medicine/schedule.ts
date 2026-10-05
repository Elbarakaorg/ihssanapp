export type TreatmentMedication = { id: string; name: string; strength: string | null; form: string | null; dose: string | null; times: string[]; instructions: string | null };
export type Treatment = {
  id: string; name: string; notes: string | null; status: 'active' | 'paused' | 'completed' | 'stopped';
  starts_on: string; ends_on: string | null; prescribed: boolean; prescriber_name?: string | null; medications: TreatmentMedication[];
};
export type DoseLog = { medication_id: string; scheduled_for: string; slot: string; status: 'taken' | 'skipped' };
export type Dose = { key: string; medicationId: string; treatmentId: string; treatmentName: string; name: string; label: string; slot: string; instructions: string | null; status: 'taken' | 'skipped' | 'due' | 'missed' };

export const toLocalDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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
      for (const slot of medication.times) {
        const [h, m] = slot.split(':').map(Number);
        const state = logged.get(`${medication.id}|${slot}`);
        const overdue = dateKey < toLocalDateKey(now) || (today && h * 60 + m + 60 < nowMinutes);
        doses.push({
          key: `${medication.id}|${slot}`, medicationId: medication.id, treatmentId: treatment.id, treatmentName: treatment.name,
          name: medication.name, label: [medication.strength, medication.dose].filter(Boolean).join(' · '), slot,
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
