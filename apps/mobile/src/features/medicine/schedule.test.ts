import { describe, expect, it } from 'vitest';

import { dosesForDay, progressOf, toLocalDateKey, weeklyAdherence, type DoseLog, type Treatment } from './schedule';

const treatment: Treatment = {
  id: 't1', name: 'Diabetes', notes: null, status: 'active', starts_on: '2026-10-01', ends_on: null, prescribed: false,
  medications: [{ id: 'm1', name: 'Metformin', strength: '500 mg', form: 'Tablet', dose: '1 tablet', times: ['08:00', '20:00'], instructions: null }],
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
});
