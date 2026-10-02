import { supabaseClient } from '@/platform/supabase/client';

export type MedicalProfile = {
  date_of_birth: string;
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_phone: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  surgeries: string[];
};

export type DoctorShare = {
  id: string;
  clinician_id: string;
  scope: Record<string, boolean>;
  granted_at: string;
  revoked_at: string | null;
  clinician: { public_name: string; verification_status: string } | null;
};

export type FavoriteDoctor = {
  clinician_id: string;
  created_at: string;
  clinician: { public_name: string; verification_status: string } | null;
};

export type ShareRequest = {
  id: string;
  clinician_id: string;
  clinician_name: string;
  created_at: string;
};

export const emptyMedicalProfile: MedicalProfile = {
  date_of_birth: '',
  blood_type: '',
  emergency_contact_name: '',
  emergency_contact_relation: '',
  emergency_contact_phone: '',
  allergies: [],
  conditions: [],
  medications: [],
  surgeries: [],
};

export async function getMedicalProfile(): Promise<MedicalProfile> {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Sign in to view your medical profile.');

  const { data, error } = await client.from('patient_medical_profiles')
    .select('date_of_birth,blood_type,emergency_contact_name,emergency_contact_relation,emergency_contact_phone,allergies,conditions,medications,surgeries')
    .eq('patient_id', userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...emptyMedicalProfile, ...data } as MedicalProfile : emptyMedicalProfile;
}

export async function saveMedicalProfile(profile: MedicalProfile): Promise<void> {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Sign in to update your medical profile.');

  const dateOfBirth = profile.date_of_birth.trim() || null;
  if (dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || new Date(`${dateOfBirth}T00:00:00`).getTime() > Date.now())) {
    throw new Error('Enter a valid date of birth in YYYY-MM-DD format.');
  }
  for (const [label, values] of Object.entries({ allergies: profile.allergies, conditions: profile.conditions, medications: profile.medications, surgeries: profile.surgeries })) {
    if (values.length > 30 || values.some((value) => value.length > 120)) throw new Error(`${label} can contain up to 30 entries of 120 characters each.`);
  }

  const { error } = await client.from('patient_medical_profiles').upsert({
    ...profile,
    date_of_birth: dateOfBirth,
    blood_type: profile.blood_type || null,
    patient_id: userData.user.id,
  });
  if (error) throw error;
}

export async function listDoctorShares(): Promise<DoctorShare[]> {
  const client = requireClient();
  const { data, error } = await client.from('patient_access_grants')
    .select('id,clinician_id,scope,granted_at,revoked_at,clinician:clinician_verifications(public_name,verification_status)')
    .order('granted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DoctorShare[];
}

export async function revokeDoctorShare(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('patient_access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function listFavoriteDoctors(): Promise<FavoriteDoctor[]> {
  const client = requireClient();
  const { data, error } = await client.from('patient_favorite_clinicians')
    .select('clinician_id,created_at,clinician:clinician_verifications(public_name,verification_status)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FavoriteDoctor[];
}

export async function setDoctorFavorite(clinicianId: string, favorite: boolean): Promise<void> {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Sign in to save a doctor.');

  const request = favorite
    ? client.from('patient_favorite_clinicians').insert({ patient_id: userData.user.id, clinician_id: clinicianId })
    : client.from('patient_favorite_clinicians').delete().eq('patient_id', userData.user.id).eq('clinician_id', clinicianId);
  const { error } = await request;
  if (error) throw error;
}

export async function listPendingShareRequests(): Promise<ShareRequest[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('list_pending_patient_profile_share_requests');
  if (error) throw error;
  return (data ?? []) as ShareRequest[];
}

export async function respondToShareRequest(requestId: string, approve: boolean, shareMeasurements = false): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('respond_to_patient_profile_share_request', {
    p_request_id: requestId,
    p_approve: approve,
    p_share_medical_profile: approve,
    p_share_measurements: approve && shareMeasurements,
  });
  if (error) throw error;
}

function requireClient() {
  if (!supabaseClient) throw new Error('Authentication is not configured.');
  return supabaseClient;
}
