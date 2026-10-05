import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { planReminders } from './reminders';
import { adherencePercent, adherenceReport, overallAdherence, stockState, type Treatment, type TreatmentMedication } from './schedule';

const med: TreatmentMedication = {
  id: 'm', name: 'Metformin', strength: null, form: null, amount: 1, unit: 'tablet', frequency: 'daily', interval_days: null, weekdays: null, times: ['08:00', '20:00'],
  duration_value: null, duration_unit: null, ends_on: null, max_daily_amount: null, min_interval_hours: null, instructions: 'with food',
};
const t: Treatment = { id: 't', name: 'T', notes: null, status: 'active', starts_on: '2026-10-01', ends_on: null, prescribed: false, medications: [med] };

describe('reminders', () => {
  it('plans future doses only, soonest first, capped at 60', () => {
    const now = new Date(2026, 9, 5, 12, 0);
    const plan = planReminders([t], now, 7);
    expect(plan[0].at).toEqual(new Date(2026, 9, 5, 20, 0));
    expect(plan[0].body).toBe('1 tablet · with food');
    expect(plan).toHaveLength(13);
    expect(planReminders([t], now, 60)).toHaveLength(60);
  });
  it('skips paused treatments and as-needed medicines', () => {
    const now = new Date(2026, 9, 5, 12, 0);
    expect(planReminders([{ ...t, status: 'paused' }], now)).toEqual([]);
    expect(planReminders([{ ...t, medications: [{ ...med, frequency: 'as_needed', times: [] }] }], now)).toEqual([]);
  });
});

describe('stock and adherence', () => {
  it('estimates days left and warns when low', () => {
    expect(stockState({ ...med, stock_remaining: null })).toBeNull();
    expect(stockState({ ...med, stock_remaining: 40 })).toMatchObject({ daysLeft: 20, level: 'ok' });
    expect(stockState({ ...med, stock_remaining: 10 })).toMatchObject({ daysLeft: 5, level: 'low' });
    expect(stockState({ ...med, stock_remaining: 0 })?.level).toBe('out');
  });
  it('summarises adherence and builds a report', () => {
    const rows = [
      { medication_id: 'a', name: 'A', treatment: 'T', frequency: 'daily' as const, unit: 'tablet', expected: 10, taken: 8, skipped: 1, taken_amount: 8 },
      { medication_id: 'b', name: 'B', treatment: 'T', frequency: 'as_needed' as const, unit: 'mg', expected: null, taken: 3, skipped: 0, taken_amount: 1200 },
    ];
    expect(adherencePercent(rows[0])).toBe(80);
    expect(adherencePercent(rows[1])).toBeNull();
    expect(overallAdherence(rows)).toEqual({ expected: 10, taken: 8, percent: 80 });
    const report = adherenceReport(rows, 30, 'Pat');
    expect(report).toContain('8 of 10 scheduled doses taken (80%)');
    expect(report).toContain('B (as needed): 1200 mg');
  });
});
