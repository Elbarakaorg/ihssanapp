import { describe, expect, it } from 'vitest';

import { interpretPublishedRange } from './metric-interpretation';

const glucoseRanges = [
  { context: 'fasting', category: 'normal', maximum_mg_dl_exclusive: 100 },
  { context: 'fasting', category: 'common prediabetes screening range', minimum_mg_dl: 100, maximum_mg_dl_inclusive: 125 },
];

describe('interpretPublishedRange', () => {
  it('does not interpret glucose without fasting or post-meal context', () => {
    expect(interpretPublishedRange('blood_glucose', { numeric_value: 110, unit: 'mg/dL', component_values: null, context: {} }, glucoseRanges, 'en')).toBeNull();
  });

  it('uses the selected glucose timing context', () => {
    const interpretation = interpretPublishedRange('blood_glucose', { numeric_value: 110, unit: 'mg/dL', component_values: null, context: { timing: 'fasting' } }, glucoseRanges, 'en');
    expect(interpretation).toContain('prediabetes screening range');
    expect(interpretation).toContain('not a diagnosis');
  });

  it('converts mmol/L glucose values for mg/dL-authored ranges', () => {
    const interpretation = interpretPublishedRange('blood_glucose', { numeric_value: 5.0, unit: 'mmol/L', component_values: null, context: { timing: 'fasting' } }, glucoseRanges, 'en');
    expect(interpretation).toContain('commonly cited reference category');
  });

  it('never classifies INR against a generic therapeutic target', () => {
    const interpretation = interpretPublishedRange('inr', { numeric_value: 3.8, unit: 'INR', component_values: null, context: {} }, [{ category: 'common therapeutic range', minimum: 2, maximum: 3 }], 'en');
    expect(interpretation).toContain('depend on your condition');
  });

  it('interprets blood pressure from a published two-number category', () => {
    const interpretation = interpretPublishedRange('blood_pressure', {
      numeric_value: null,
      unit: null,
      component_values: { systolic: 132, diastolic: 84 },
      context: {},
    }, [{ category: 'stage 1 hypertension screening', systolic_min: 130, systolic_max: 139, diastolic_min: 80, diastolic_max: 89 }], 'en');
    expect(interpretation).toContain('stage 1 screening category');
    expect(interpretation).toContain('not a diagnosis');
  });

  it('does not interpret data without published ranges', () => {
    expect(interpretPublishedRange('spo2', { numeric_value: 97, unit: '%', component_values: null, context: {} }, null, 'en')).toBeNull();
  });
});