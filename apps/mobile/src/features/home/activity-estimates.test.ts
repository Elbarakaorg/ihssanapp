import { describe, expect, it } from 'vitest';

import { estimateActivity } from './activity-estimates';

describe('estimateActivity', () => {
  it('estimates distance and active calories from steps', () => {
    expect(estimateActivity(10000)).toEqual({ distanceKm: 7, activeCalories: 400 });
  });

  it('treats invalid and negative input as zero', () => {
    expect(estimateActivity(-10)).toEqual({ distanceKm: 0, activeCalories: 0 });
    expect(estimateActivity(Number.NaN)).toEqual({ distanceKm: 0, activeCalories: 0 });
  });
});