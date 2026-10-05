import type { SavedMeasurement } from '@/features/health/measurement-repository';

export type BandTone = 'good' | 'watch' | 'high' | 'info';
export type Band = { from: number | null; to: number | null; label: string; tone: BandTone };

const MGDL_PER_MMOL = 18.0182;

export function toneFor(category: string): BandTone {
  const text = category.toLowerCase();
  if (/stage 2|urgent|diagnostic|excess|deficien/.test(text)) return 'high';
  if (/stage 1|elevated|prediabetes|insufficient|interpret|athletes|screening/.test(text)) return 'watch';
  if (/normal|typical|sufficient|expected|resting range|therapeutic/.test(text)) return 'good';
  return 'info';
}

const numeric = (row: Record<string, unknown>, pattern: RegExp) => {
  const key = Object.keys(row).find((k) => pattern.test(k) && typeof row[k] === 'number');
  return key ? { value: row[key] as number, key } : null;
};

/**
 * Turns the published reference rows into shaded bands for the chart axis. Individualised goals are skipped
 * (they overlap and are not reference categories), and so are glucose rows when the visible readings mix timings.
 */
export function buildBands(metricKey: string | undefined, ranges: unknown[] | null | undefined, measurements: SavedMeasurement[]): Band[] {
  if (!metricKey || !ranges?.length || metricKey === 'inr') return [];
  const isPressure = metricKey === 'blood_pressure';
  const timings = new Set(measurements.map((m) => m.context?.timing).filter(Boolean));
  if (metricKey === 'blood_glucose' && timings.size !== 1) return [];
  const timing = metricKey === 'blood_glucose' ? [...timings][0] : undefined;
  const toMgdl = metricKey === 'blood_glucose' && measurements[0]?.unit === 'mmol/L';

  const bands: Band[] = [];
  for (const item of ranges) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const category = String(row.category ?? '');
    if (/individuali[sz]ed|care-plan|treatment goal/i.test(category)) continue;
    if (metricKey === 'blood_glucose' && row.context !== (timing === 'postprandial_1_2h' ? '1-2 hours after meal' : timing)) continue;
    const min = numeric(row, isPressure ? /^systolic_min/ : /^minimum/);
    const max = numeric(row, isPressure ? /^systolic_max/ : /^maximum/);
    if (!min && !max) continue;
    const convert = (v: { value: number; key: string } | null) => (v ? (toMgdl && v.key.includes('_mg_dl') ? v.value / MGDL_PER_MMOL : v.value) : null);
    bands.push({ from: convert(min), to: convert(max), label: category, tone: toneFor(category) });
  }
  return bands.sort((a, b) => (a.from ?? -Infinity) - (b.from ?? -Infinity));
}

export function bandFor(value: number, bands: Band[]): Band | undefined {
  return bands.find((b) => (b.from == null || value >= b.from) && (b.to == null || value <= b.to));
}

/** Rounded tick values that fit the domain, so the y axis reads like a printed chart. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  const span = hi - lo || 1;
  const rough = span / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
