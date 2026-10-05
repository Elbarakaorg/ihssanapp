import { describe, expect, it } from 'vitest';

import { asNeededForDay, describeSchedule, dosesForDay, formatAmount, isMedicationDue, progressOf, toLocalDateKey, weeklyAdherence, type DoseLog, type Treatment } from './schedule';

const treatment: Treatment = {
  id: 't1', name: 'Diabetes', notes: null, status: 'active', starts_on: '2026-10-01', ends_on: null, prescribed: false,
  medications: [{ id: 'm1', name: 'Metformin', strength: '500 mg', form: 'Tablet', amount: 1, unit: 'tablet', frequency: 'daily', interval_days: null, weekdays: null, times: ['08:00', '20:00'], duration_value: null, duration_unit: null, ends_on: null, max_daily_amount: null, min_interval_hours: null, instructions: null }],
};
const noon = new Date(2026, 9, 5, 12, 0);

describe('dose schedule', () => {
  it('lists doses and classifies unlogged ones as missed or due', () => {
    const doses = dosesForDay([treatment], [], '2026-10-05', noon);
    expect(doses.map((d) => [d.slot, d.status])).toEqual([['08:00', 'missed'], ['20:00', 'due']]);
  });

  it('uses logged status and computes progress', () => {
    const logs: DoseLog[] = [{ medication_id: 'm1', scheduled_for: '2026-10-05', slot: '08:00', status: 'taken' }];
    const doses = dosesForDay([treatment], logs, '2026-10-05', noon);
    expect(progressOf(doses)).toEqual({ taken: 1, total: 2, percent: 50 });
  });

  it('ignores paused, finished and not-yet-started treatments', () => {
    expect(dosesForDay([{ ...treatment, status: 'paused' }], [], '2026-10-05', noon)).toEqual([]);
    expect(dosesForDay([{ ...treatment, ends_on: '2026-10-04' }], [], '2026-10-05', noon)).toEqual([]);
    expect(dosesForDay([treatment], [], '2026-09-30', noon)).toEqual([]);
  });

  it('builds seven days of adherence', () => {
    const week = weeklyAdherence([treatment], [], noon);
    expect(week).toHaveLength(7);
    expect(week[6].dateKey).toBe(toLocalDateKey(noon));
    expect(week[0].total).toBe(0); // Sep 29: before the treatment starts
  });

  it('schedules every-N-days and weekly medicines from the start date', () => {
    const base = treatment.medications[0];
    const vitD = { ...base, id: 'v', frequency: 'interval' as const, interval_days: 15, times: ['09:00'], amount: 1, unit: 'capsule', ends_on: '2027-01-04' };
    const t = { ...treatment, medications: [vitD] };
    expect(['2026-10-01', '2026-10-16', '2026-10-31'].every((d) => isMedicationDue(t, vitD, d))).toBe(true);
    expect(['2026-10-02', '2026-10-15', '2027-01-05'].some((d) => isMedicationDue(t, vitD, d))).toBe(false);
    const weekly = { ...base, frequency: 'weekly' as const, weekdays: [1, 4] };
    expect(isMedicationDue(t, weekly, '2026-10-05')).toBe(true); // Monday
    expect(isMedicationDue(t, weekly, '2026-10-06')).toBe(false);
    expect(dosesForDay([t], [], '2026-10-02', noon)).toEqual([]);
  });

  it('describes the three-part schedule', () => {
    const base = treatment.medications[0];
    expect(describeSchedule({ ...base, amount: 1, unit: 'capsule', frequency: 'interval', interval_days: 15, times: ['09:00'], duration_value: 3, duration_unit: 'months' })).toBe('1 capsule · every 15 days at 09:00 · for 3 months');
    expect(describeSchedule({ ...base, amount: 15, unit: 'drop' })).toBe('15 drops · 2 times a day at 08:00, 20:00 · ongoing');
    expect(formatAmount(5, 'ml')).toBe('5 ml');
  });

  it('enforces the as-needed maximum and minimum gap', () => {
    const base = treatment.medications[0];
    const prn = { ...base, id: 'p', name: 'Ibuprofen', frequency: 'as_needed' as const, times: [], amount: 400, unit: 'mg', max_daily_amount: 800, min_interval_hours: 6 };
    const t = { ...treatment, medications: [prn] };
    const log = (slot: string): DoseLog => ({ medication_id: 'p', scheduled_for: '2026-10-05', slot, status: 'taken', amount: 400 });
    expect(asNeededForDay([t], [], '2026-10-05', noon)[0].canTake).toBe(true);
    const gap = asNeededForDay([t], [log('09:00')], '2026-10-05', noon)[0];
    expect(gap.canTake).toBe(false);
    expect(gap.reason).toContain('Wait 3 h');
    const full = asNeededForDay([t], [log('01:00'), log('07:00')], '2026-10-05', noon)[0];
    expect(full.canTake).toBe(false);
    expect(full.reason).toContain('maximum');
    expect(asNeededForDay([t], [log('05:00')], '2026-10-05', noon)[0].canTake).toBe(true);
    expect(dosesForDay([t], [], '2026-10-05', noon)).toEqual([]);
  });
});
