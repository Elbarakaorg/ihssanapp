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
} as const;

export type MetricId = keyof typeof metricDefinitions;

export type MeasurementInput = {
  metricId: MetricId;
  value: string;
  unit: string;
  date: string;
};

export type MeasurementValidation =
  | { valid: true; numericValue: number }
  | { valid: false; error: string };

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

  if (!(definition.units as readonly string[]).includes(input.unit)) {
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