import { describe, expect, it } from 'vitest';

import { validateMeasurementInput, type MeasurementInput } from './metric-input';

const baseInput: MeasurementInput = {
  metricId: 'glucose',
  value: '110',
  unit: 'mg/dL',
  date: '2026-09-25',
};

describe('validateMeasurementInput', () => {
  it('accepts a positive glucose result and preserves the numeric value', () => {
    expect(validateMeasurementInput(baseInput, '2026-09-26')).toEqual({ valid: true, numericValue: 110 });
  });

  it('accepts a decimal comma and a supported glucose unit', () => {
    expect(validateMeasurementInput({ ...baseInput, value: '5,6', unit: 'mmol/L' }, '2026-09-26')).toEqual({
      valid: true,
      numericValue: 5.6,
    });
  });

  it('rejects empty, malformed, and non-positive values', () => {
    for (const value of ['', 'abc', '1,2.3', '0', '-4']) {
      expect(validateMeasurementInput({ ...baseInput, value }, '2026-09-26').valid).toBe(false);
    }
  });

  it('rejects a unit not defined for the selected metric', () => {
    expect(validateMeasurementInput({ ...baseInput, unit: 'INR' }, '2026-09-26')).toMatchObject({
      valid: false,
      error: 'Choose a supported unit.',
    });
  });

  it('accepts INR with its metric unit', () => {
    expect(
      validateMeasurementInput({ ...baseInput, metricId: 'inr', value: '2.4', unit: 'INR' }, '2026-09-26'),
    ).toEqual({ valid: true, numericValue: 2.4 });
  });

  it('rejects impossible and future calendar dates', () => {
    expect(validateMeasurementInput({ ...baseInput, date: '2026-02-29' }, '2026-09-26').valid).toBe(false);
    expect(validateMeasurementInput({ ...baseInput, date: '2026-09-27' }, '2026-09-26')).toMatchObject({
      valid: false,
      error: 'The test date cannot be in the future.',
    });
  });
});