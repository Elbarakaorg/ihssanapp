import { supabaseClient } from '@/platform/supabase/client';

export type SavedMeasurement = {
  id: string;
  metric_definition_id: string;
  numeric_value: number | null;
  unit: string | null;
  measured_at: string;
  source_kind: string;
  source_label: string | null;
  created_at: string;
};

export async function getCurrentProfile() {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You need to sign in to access your profile.');

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, display_name, preferred_locale')
    .eq('id', userData.user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function listMeasurementsForCurrentUser(): Promise<SavedMeasurement[]> {
  if (!supabaseClient) return [];

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) return [];

  const { data, error } = await supabaseClient
    .from('health_measurements')
    .select('id, metric_definition_id, numeric_value, unit, measured_at, source_kind, source_label, created_at')
    .eq('patient_id', userData.user.id)
    .order('measured_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as SavedMeasurement[];
}

export async function saveMeasurement(metricKey: string, numericValue: number, unit: string, measuredAt: string) {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You need to sign in before saving a result.');

  const { data: definition, error: definitionError } = await supabaseClient
    .from('metric_definitions')
    .select('id, supported_units')
    .eq('metric_key', metricKey)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (definitionError) throw definitionError;
  if (!definition) throw new Error('This metric is not available.');
  if (!(definition.supported_units as string[]).includes(unit)) {
    throw new Error('Choose a supported unit for this measurement.');
  }

  const { data, error } = await supabaseClient
    .from('health_measurements')
    .insert({
      patient_id: userData.user.id,
      metric_definition_id: definition.id,
      numeric_value: numericValue,
      unit,
      measured_at: measuredAt,
      source_kind: 'patient_entry',
      entered_by: userData.user.id,
    })
    .select('id, metric_definition_id, numeric_value, unit, measured_at, source_kind, source_label, created_at')
    .single();

  if (error) throw error;
  return data as SavedMeasurement;
}
