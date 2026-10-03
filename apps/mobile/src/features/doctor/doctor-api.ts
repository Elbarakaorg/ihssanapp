import { supabaseClient } from '@/platform/supabase/client';

function client() {
  if (!supabaseClient) throw new Error('Authentication is not configured.');
  return supabaseClient;
}

function fail(error: { message: string } | null, fallback: string): never {
  // Database exceptions carry user-safe messages we wrote; anything else gets the fallback.
  throw new Error(error?.message && error.message.length < 140 ? error.message : fallback);
}

async function rpc<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

export type Credentials = { license_number: string; issuing_body: string; specialty: string; city: string; submitted_at: string };
export type PublicProfile = { headline: string; bio: string; specialties: string[]; languages: string[]; years_experience: number | null; is_public: boolean };
export type DoctorSummary = { clinician_id: string; name: string; headline: string | null; specialties: string[]; languages: string[]; cities: string[] };
export type DoctorLocationInfo = {
  id: string; venue_name: string; venue_kind: string; address: string | null; city: string;
  latitude: number | null; longitude: number | null; google_place_id: string | null; specialty: string | null;
  consultation_modes: ('in_person' | 'video')[]; phone: string | null; schedule: string | null; bookable: boolean;
};
export type DoctorProfile = {
  clinician_id: string; name: string; headline: string | null; bio: string | null; specialties: string[];
  languages: string[]; years_experience: number | null; locations: DoctorLocationInfo[];
};
export type Slot = { starts_at: string; ends_at: string };
export type AppointmentStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed' | 'no_show' | 'expired';
export type Appointment = {
  id: string; viewer_role: 'patient' | 'clinician'; counterpart_name: string; clinician_id: string; location_id: string;
  venue_name: string; venue_address: string | null; starts_at: string; ends_at: string; mode: 'in_person' | 'video';
  reason: string | null; status: AppointmentStatus; decision_note: string | null; created_at: string;
};
export type ScheduleRule = { id: string; location_id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number };
export type PatientNote = { id: string; body: string; created_at: string; updated_at: string };

export async function getMyCredentials(): Promise<Credentials | null> {
  const rows = await rpc<Credentials[] | null>('get_my_credentials', undefined, 'Could not load your credentials.');
  return rows?.[0] ?? null;
}

export async function submitMyCredentials(input: { licenseNumber: string; issuingBody: string; specialty: string; city: string }) {
  await rpc('submit_my_credentials', {
    p_license_number: input.licenseNumber.trim(), p_issuing_body: input.issuingBody.trim(),
    p_specialty: input.specialty.trim(), p_city: input.city.trim(),
  }, 'Could not submit your credentials.');
}

export async function getMyPublicProfile(): Promise<PublicProfile | null> {
  const rows = await rpc<PublicProfile[] | null>('get_my_public_profile', undefined, 'Could not load your profile.');
  return rows?.[0] ?? null;
}

export async function saveMyPublicProfile(input: PublicProfile) {
  await rpc('upsert_my_public_profile', {
    p_headline: input.headline.trim(), p_bio: input.bio.trim(), p_specialties: input.specialties,
    p_languages: input.languages, p_years: input.years_experience, p_is_public: input.is_public,
  }, 'Could not save your profile.');
}

export const searchDoctors = (query: string) =>
  rpc<DoctorSummary[]>('search_doctors', { p_query: query.trim() || null, p_limit: 30 }, 'Could not search doctors.').then((rows) => rows ?? []);

export const getDoctorProfile = (id: string) =>
  rpc<DoctorProfile | null>('get_doctor_profile', { p_clinician_id: id }, 'Could not load this doctor.');

export const listAvailableSlots = (clinicianId: string, locationId: string, from: string, to: string) =>
  rpc<Slot[]>('list_available_slots', { p_clinician_id: clinicianId, p_location_id: locationId, p_from: from, p_to: to }, 'Could not load times.').then((rows) => rows ?? []);

export const bookAppointment = (input: { clinicianId: string; locationId: string; startsAt: string; mode: string; reason: string }) =>
  rpc<string>('book_appointment', {
    p_clinician_id: input.clinicianId, p_location_id: input.locationId, p_starts_at: input.startsAt,
    p_mode: input.mode, p_reason: input.reason.trim() || null,
  }, 'Could not book this time.');

export const listMyAppointments = (scope: 'upcoming' | 'past') =>
  rpc<Appointment[]>('list_my_appointments', { p_scope: scope }, 'Could not load appointments.').then((rows) => rows ?? []);

export const updateAppointmentStatus = (id: string, status: string, note?: string) =>
  rpc('update_appointment_status', { p_id: id, p_status: status, p_note: note?.trim() || null }, 'Could not update this appointment.');

export async function listMyScheduleRules(): Promise<ScheduleRule[]> {
  const { data, error } = await client().from('clinician_schedule_rules')
    .select('id,location_id,weekday,start_time,end_time,slot_minutes').order('weekday').order('start_time');
  if (error) fail(error, 'Could not load your schedule.');
  return (data ?? []) as ScheduleRule[];
}

export const addScheduleRule = (input: { locationId: string; weekday: number; start: string; end: string; slotMinutes: number }) =>
  rpc('add_schedule_rule', {
    p_location_id: input.locationId, p_weekday: input.weekday, p_start: input.start, p_end: input.end, p_slot_minutes: input.slotMinutes,
  }, 'Could not add this block.');

export const deleteScheduleRule = (id: string) => rpc('delete_schedule_rule', { p_rule_id: id }, 'Could not remove this block.');

export const listPatientNotes = (grantId: string) =>
  rpc<PatientNote[]>('list_patient_notes', { p_grant_id: grantId }, 'Could not load notes.').then((rows) => rows ?? []);
export const addPatientNote = (grantId: string, body: string) => rpc('add_patient_note', { p_grant_id: grantId, p_body: body.trim() }, 'Could not save the note.');
export const updatePatientNote = (id: string, body: string) => rpc('update_patient_note', { p_note_id: id, p_body: body.trim() }, 'Could not update the note.');
export const deletePatientNote = (id: string) => rpc('delete_patient_note', { p_note_id: id }, 'Could not delete the note.');
