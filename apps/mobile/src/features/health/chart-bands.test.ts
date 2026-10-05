import { describe, expect, it } from 'vitest';

import { bandFor, buildBands, niceTicks, toneFor } from './chart-bands';
import type { SavedMeasurement } from './measurement-repository';

const m = (over: Partial<SavedMeasurement>) => ({ unit: 'mg/dL', context: {}, ...over }) as SavedMeasurement;

describe('chart bands', () => {
  it('builds ordered glucose bands for one timing and skips individualised goals', () => {
    const ranges = [
      { context: 'fasting', category: 'normal', maximum_mg_dl_exclusive: 100 },
      { context: 'fasting', category: 'prediabetes screening range', minimum_mg_dl: 100, maximum_mg_dl_inclusive: 125 },
      { context: 'fasting', category: 'individualized diabetes care-plan range', minimum_mg_dl: 80, maximum_mg_dl: 130 },
    ];
    const bands = buildBands('blood_glucose', ranges, [m({ context: { timing: 'fasting' } })]);
    expect(bands.map((b) => [b.from, b.to, b.tone])).toEqual([[null, 100, 'good'], [100, 125, 'watch']]);
    expect(bandFor(110, bands)?.tone).toBe('watch');
  });

  it('returns nothing when glucose timings are mixed or INR', () => {
    const ranges = [{ context: 'fasting', category: 'normal', maximum_mg_dl_exclusive: 100 }];
    expect(buildBands('blood_glucose', ranges, [m({ context: { timing: 'fasting' } }), m({ context: { timing: 'random' } })])).toEqual([]);
    expect(buildBands('inr', [{ category: 'x', minimum: 2 }], [])).toEqual([]);
  });

  it('converts mg/dL bands for mmol/L readings', () => {
    const bands = buildBands('blood_glucose', [{ context: 'fasting', category: 'normal', maximum_mg_dl_exclusive: 100 }], [m({ unit: 'mmol/L', context: { timing: 'fasting' } })]);
    expect(bands[0].to).toBeCloseTo(5.55, 1);
  });

  it('uses systolic bounds for blood pressure', () => {
    const bands = buildBands('blood_pressure', [
      { category: 'normal', systolic_max_exclusive: 120, diastolic_max_exclusive: 80 },
      { category: 'stage 2 hypertension screening', systolic_min: 140 },
    ], []);
    expect(bands.map((b) => [b.from, b.to, b.tone])).toEqual([[null, 120, 'good'], [140, null, 'high']]);
  });

  it('classifies tones and makes tidy ticks', () => {
    expect(toneFor('often described as insufficient')).toBe('watch');
    expect(toneFor('commonly considered sufficient in some guidance')).toBe('good');
    expect(niceTicks(62, 138)).toEqual([80, 100, 120]);
  });
});
