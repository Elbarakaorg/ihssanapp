import { supabaseClient } from '@/platform/supabase/client';

export type AuthorizedPatient = {
  grant_id: string;
  patient_id: string;
  patient_name: string;
  granted_at: string;
  revoked_at: string | null;
  access_scope: Record<string, boolean>;
  last_accessed_at: string | null;
};

export type SharedPatientProfile = {
  patient_id: string;
  patient_name: string;
  granted_at: string;
  access_scope: Record<string, boolean>;
  date_of_birth: string | null;
  blood_type: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  allergies: string[] | null;
  conditions: string[] | null;
  medications: string[] | null;
  surgeries: string[] | null;
};

export type SharedMeasurement = {
  id: string;
  numeric_value: number | null;
  component_values: Record<string, number> | null;
  unit: string | null;
  measured_at: string;
  source_kind: string;
  source_label: string | null;
  metric_definition: { metric_key: string; display_names: Record<string, string> } | null;
};

export async function listMyPatientProfiles(): Promise<AuthorizedPatient[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('list_my_patient_profiles');
  if (error) throw error;
  return (data ?? []) as AuthorizedPatient[];
}

export async function getMySharedPatientProfile(grantId: string): Promise<SharedPatientProfile> {
  const client = requireClient();
  const { data, error } = await client.rpc('get_my_shared_patient_profile', { p_grant_id: grantId });
  if (error) throw error;
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile) throw new Error('Patient access is revoked or unavailable.');
  return profile as SharedPatientProfile;
}

export async function listSharedPatientMeasurements(patientId: string): Promise<SharedMeasurement[]> {
  const client = requireClient();
  const { data, error } = await client.from('health_measurements')
    .select('id,numeric_value,component_values,unit,measured_at,source_kind,source_label,metric_definition:metric_definitions(metric_key,display_names)')
    .eq('patient_id', patientId)
    .order('measured_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as SharedMeasurement[];
}

function requireClient() {
  if (!supabaseClient) throw new Error('Authentication is not configured.');
  return supabaseClient;
}
