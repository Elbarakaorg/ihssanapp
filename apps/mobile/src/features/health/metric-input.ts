export const metricDefinitions = {
  glucose: {
    id: 'glucose',
    name: 'Blood sugar',
    fieldLabel: 'Glucose result',
    units: ['mg/dL', 'mmol/L'],
    explanation: 'Enter the value and unit exactly as shown on your test result.',
  },
  inr: {
    id: 'inr',
    name: 'INR',
    fieldLabel: 'INR result',
    units: ['INR'],
    explanation: 'Enter the result exactly as shown on your test report.',
  },
  blood_pressure: {
    id: 'blood_pressure',
    name: 'Blood pressure',
    fieldLabel: 'Blood pressure reading',
    units: ['mm Hg'],
    explanation: 'Record both numbers from your monitor after following the measurement instructions.',
  },
  resting_heart_rate: {
    id: 'resting_heart_rate',
    name: 'Resting heart rate',
    fieldLabel: 'Heart rate',
    units: ['bpm'],
    explanation: 'Measure while calm and resting, and record the value shown by your device.',
  },
  hba1c: {
    id: 'hba1c',
    name: 'HbA1c',
    fieldLabel: 'HbA1c result',
    units: ['%'],
    explanation: 'Enter the percentage exactly as shown on your laboratory report.',
  },
  spo2: {
    id: 'spo2',
    name: 'Oxygen saturation',
    fieldLabel: 'Oxygen saturation',
    units: ['%'],
    explanation: 'Record a stable pulse-oximeter reading and follow the device instructions.',
  },
  vitamin_d: {
    id: 'vitamin_d',
    name: 'Vitamin D (25-OH)',
    fieldLabel: '25-hydroxy vitamin D result',
    units: ['ng/mL'],
    explanation: 'Enter a 25-hydroxy vitamin D result exactly as reported.',
  },
} as const;

export type MetricId = keyof typeof metricDefinitions;

export type MeasurementInput = {
  metricId: MetricId;
  value: string;
  unit: string;
  date: string;
};

export type BloodPressureInput = { systolic: string; diastolic: string; date: string };

export type MeasurementValidation =
  | { valid: true; numericValue: number }
  | { valid: false; error: string };

export function validateBloodPressureInput(input: BloodPressureInput, today = localDateString()) {
  const systolic = Number(input.systolic.trim());
  const diastolic = Number(input.diastolic.trim());
  if (!Number.isInteger(systolic) || systolic < 40 || systolic > 300) return { valid: false as const, error: 'Enter a systolic value between 40 and 300 mm Hg.' };
  if (!Number.isInteger(diastolic) || diastolic < 20 || diastolic > 200) return { valid: false as const, error: 'Enter a diastolic value between 20 and 200 mm Hg.' };
  if (!isCalendarDate(input.date)) return { valid: false as const, error: 'Enter a valid date in YYYY-MM-DD format.' };
  if (input.date > today) return { valid: false as const, error: 'The measurement date cannot be in the future.' };
  return { valid: true as const, componentValues: { systolic, diastolic } };
}

export function isMetricId(value: string): value is MetricId {
  return Object.hasOwn(metricDefinitions, value);
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateMeasurementInput(
  input: MeasurementInput,
  today = localDateString(),
  supportedUnits: readonly string[] = metricDefinitions[input.metricId].units,
): MeasurementValidation {
  const definition = metricDefinitions[input.metricId];
  const trimmedValue = input.value.trim();
  const normalizedValue = trimmedValue.replace(',', '.');

  if (!trimmedValue || !/^\d+(\.\d+)?$/.test(normalizedValue)) {
    return { valid: false, error: 'Enter a number using digits and an optional decimal separator.' };
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { valid: false, error: 'Enter a value greater than zero.' };
  }

  if (!supportedUnits.includes(input.unit)) {
    return { valid: false, error: 'Choose a supported unit.' };
  }

  if (!isCalendarDate(input.date)) {
    return { valid: false, error: 'Enter a valid date in YYYY-MM-DD format.' };
  }

  if (input.date > today) {
    return { valid: false, error: 'The test date cannot be in the future.' };
  }

  return { valid: true, numericValue };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}