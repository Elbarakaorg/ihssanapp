import { describe, expect, it } from 'vitest';

import { summarizeMeasurements } from './measurement-summary';

describe('summarizeMeasurements', () => {
  it('counts saved measurements and keeps the most recent date', () => {
    const summary = summarizeMeasurements([
      { measured_at: '2026-09-01T00:00:00+00:00' },
      { measured_at: '2026-09-12T00:00:00+00:00' },
      { measured_at: '2026-09-05T00:00:00+00:00' },
    ] as Array<{ measured_at: string }>);

    expect(summary.count).toBe(3);
    expect(summary.latestMeasurementDate).toBe('2026-09-12T00:00:00+00:00');
  });

  it('returns a zero count when no measurements exist', () => {
    expect(summarizeMeasurements([])).toEqual({ count: 0, latestMeasurementDate: null });
  });
});
