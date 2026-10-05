import { supabaseClient } from '@/platform/supabase/client';
import type { AdherenceRow, DoseLog, DurationUnit, Frequency, Treatment, TreatmentMedication } from '@/features/medicine/schedule';

export type MedicationInput = {
  id?: string; name: string; strength?: string; form?: string; amount: number; unit: string;
  frequency: Frequency; intervalDays?: number | null; weekdays?: number[]; times: string[];
  durationValue?: number | null; durationUnit?: DurationUnit | null; maxDailyAmount?: number | null; minIntervalHours?: number | null; instructions?: string;
};
export type TreatmentInput = { id?: string; name: string; notes?: string; startsOn?: string; medications: MedicationInput[] };
export type SharedTreatment = Omit<Treatment, 'medications'> & { prescribed_by_me: boolean | null; medications: (TreatmentMedication & { taken_7d: number })[] };

function client() {
  if (!supabaseClient) throw new Error('Authentication is not configured.');
  return supabaseClient;
}

async function rpc<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) {
    // Messages raised by our own functions are short and safe to show; anything else gets the fallback.
    const message = error.message ?? '';
    throw new Error(message && message.length < 140 && !/violates|constraint|function public|schema cache/i.test(message) ? message : fallback);
  }
  return data as T;
}

export const listMyTreatments = () => rpc<Treatment[]>('list_my_treatments', undefined, 'Could not load your treatments.');

export async function listDoseLogs(fromKey: string, toKey: string): Promise<DoseLog[]> {
  const { data, error } = await client().from('medication_dose_logs').select('medication_id,scheduled_for,slot,status,amount').gte('scheduled_for', fromKey).lte('scheduled_for', toKey);
  if (error) throw new Error('Could not load your dose history.');
  return (data ?? []) as DoseLog[];
}

const medsPayload = (medications: MedicationInput[]) => medications.map((m) => ({
  id: m.id ?? null, name: m.name, strength: m.strength ?? '', form: m.form ?? '', amount: m.amount, unit: m.unit, frequency: m.frequency,
  interval_days: m.frequency === 'interval' ? m.intervalDays ?? null : null, weekdays: m.frequency === 'weekly' ? m.weekdays ?? [] : null,
  times: m.frequency === 'as_needed' ? [] : m.times, duration_value: m.durationUnit ? m.durationValue ?? null : null, duration_unit: m.durationUnit ?? null,
  max_daily_amount: m.frequency === 'as_needed' ? m.maxDailyAmount ?? null : null, min_interval_hours: m.frequency === 'as_needed' ? m.minIntervalHours ?? null : null,
  instructions: m.instructions ?? '',
}));

export const saveMyTreatment = (input: TreatmentInput) => rpc<string>('save_my_treatment', {
  p_id: input.id ?? null, p_name: input.name, p_notes: input.notes ?? null, p_starts_on: input.startsOn ?? null, p_medications: medsPayload(input.medications),
}, 'Could not save this treatment.');

export const setTreatmentStatus = (id: string, status: Treatment['status']) => rpc<void>('set_my_treatment_status', { p_id: id, p_status: status }, 'Could not update this treatment.');
export const deleteMyTreatment = (id: string) => rpc<void>('delete_my_treatment', { p_id: id }, 'Could not delete this treatment.');
export const logDose = (medicationId: string, dateKey: string, slot: string, status: 'taken' | 'skipped' | null) =>
  rpc<void>('log_my_dose', { p_medication_id: medicationId, p_date: dateKey, p_slot: slot, p_status: status }, 'Could not save this dose.');

export const logAsNeededDose = (medicationId: string, dateKey: string, slot: string, status: 'taken' | null) =>
  rpc<void>('log_my_as_needed_dose', { p_medication_id: medicationId, p_date: dateKey, p_slot: slot, p_status: status }, 'Could not save this dose.');

export const prescribeTreatment = (grantId: string, input: Omit<TreatmentInput, 'id'>) => rpc<string>('prescribe_treatment', {
  p_grant_id: grantId, p_name: input.name, p_notes: input.notes ?? null, p_starts_on: input.startsOn ?? null, p_medications: medsPayload(input.medications),
}, 'Could not save this prescription.');
export const endPrescribedTreatment = (id: string) => rpc<void>('end_prescribed_treatment', { p_treatment_id: id }, 'Could not end this treatment.');
export const getSharedPatientTreatments = (grantId: string) => rpc<SharedTreatment[]>('get_shared_patient_treatments', { p_grant_id: grantId }, 'Could not load this patient’s treatments.');

export const setMedicationStock = (medicationId: string, amount: number | null) => rpc<void>('set_my_medication_stock', { p_medication_id: medicationId, p_amount: amount }, 'Could not save the stock.');
export const getMyAdherence = (days: number) => rpc<AdherenceRow[]>('get_my_adherence', { p_days: days }, 'Could not load your adherence.');
export const getSharedPatientAdherence = (grantId: string, days: number) => rpc<AdherenceRow[]>('get_shared_patient_adherence', { p_grant_id: grantId, p_days: days }, 'Could not load adherence.');
