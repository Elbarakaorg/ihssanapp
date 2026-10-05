import { useSyncExternalStore } from 'react';

import { toLocalDateKey, type Treatment, type TreatmentMedication } from './schedule';

/** Dev-only data switch for the treatments screen (Demo / Worst case / Empty / One / 150). Never active in production builds. */
export type DevDataMode = 'live' | 'worst' | 'empty' | 'one' | 'many';
export const devDataModes: Array<{ id: DevDataMode; label: string }> = [
  { id: 'live', label: 'Live' }, { id: 'worst', label: 'Worst case' }, { id: 'empty', label: 'Empty' }, { id: 'one', label: 'One' }, { id: 'many', label: '150' },
];

let mode: DevDataMode = 'live';
const listeners = new Set<() => void>();
export const setDevDataMode = (next: DevDataMode) => { if (__DEV__) { mode = next; listeners.forEach((l) => l()); } };
export const useDevDataMode = (): DevDataMode => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => (__DEV__ ? mode : 'live'), () => 'live');

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return toLocalDateKey(d); };

const med = (over: Partial<TreatmentMedication> & { id: string; name: string }): TreatmentMedication => ({
  strength: null, form: null, amount: 1, unit: 'tablet', frequency: 'daily', interval_days: null, weekdays: null, times: ['08:00'],
  duration_value: null, duration_unit: null, ends_on: null, max_daily_amount: null, min_interval_hours: null, instructions: null, ...over,
});

const worstTreatments = (): Treatment[] => [
  {
    id: 'w1', name: 'Traitement de la douleur post-opératoire après chirurgie du genou (Dr. El Idrissi-Benchekroun)', status: 'active', prescribed: true,
    prescriber_name: 'Dr. Mohammed Abdelhakim El Idrissi-Benchekroun', starts_on: day(-3), ends_on: day(11),
    notes: 'À prendre pendant les repas. Éviter l’alcool. Contacter le médecin en cas de vomissements, de vertiges ou de douleurs abdominales persistantes, même la nuit.',
    medications: [
      med({ id: 'w1a', name: 'Paracétamol + Codéine + Caféine comprimés pelliculés sécables', strength: '500 mg / 30 mg / 50 mg', form: 'comprimé pelliculé sécable', amount: 0.5, times: ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'], instructions: 'Avec un grand verre d’eau, au milieu du repas.', stock_amount: 0, stock_remaining: 0 }),
      med({ id: 'w1b', name: 'Ibuprofène', strength: '400 mg', amount: 1, frequency: 'as_needed', times: [], max_daily_amount: 3, min_interval_hours: 6, instructions: 'Seulement si la douleur dépasse 5/10.', stock_amount: 30, stock_remaining: 1.5 }),
    ],
  },
  {
    id: 'w2', name: 'فيتامين د٣', status: 'active', prescribed: false, starts_on: day(-40), ends_on: null, notes: null,
    medications: [med({ id: 'w2a', name: 'فيتامين د٣ ٥٠٠٠ وحدة دولية', strength: '5000 IU', amount: 1, unit: 'capsule', frequency: 'interval', interval_days: 15, duration_value: 3, duration_unit: 'months', ends_on: day(50), stock_amount: 6, stock_remaining: 4 })],
  },
  {
    id: 'w3', name: 'D', status: 'completed', prescribed: false, starts_on: day(-90), ends_on: day(-1), notes: null,
    medications: [med({ id: 'w3a', name: 'Z', amount: 15, unit: 'drop', times: ['08:00', '20:00'], duration_value: 90, duration_unit: 'days', ends_on: day(-1) })],
  },
  {
    id: 'w4', name: 'Antibiotique 1 jour', status: 'paused', prescribed: true, prescriber_name: 'Dr. Li', starts_on: day(0), ends_on: day(0), notes: null,
    medications: [med({ id: 'w4a', name: 'Amoxicilline + acide clavulanique 1 g/125 mg sachet', amount: 1, unit: 'sachet', frequency: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], times: ['09:00'] })],
  },
];

export function devTreatments(m: DevDataMode): Treatment[] | null {
  if (m === 'live') return null;
  if (m === 'empty') return [];
  const worst = worstTreatments();
  if (m === 'worst') return worst;
  if (m === 'one') return [{ ...worst[1], id: 'one', name: 'Vitamin D' }];
  return Array.from({ length: 150 }, (_, i) => ({ ...worst[i % worst.length], id: `m${i}`, name: `${worst[i % worst.length].name} #${i + 1}`, medications: worst[i % worst.length].medications.map((x) => ({ ...x, id: `${x.id}-${i}` })) }));
}
