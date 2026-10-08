import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Share } from 'react-native';

import { supabaseClient } from '@/platform/supabase/client';

function client() {
  if (!supabaseClient) throw new Error('Authentication is not configured.');
  return supabaseClient;
}

function fail(error: { message: string } | null, fallback: string): never {
  // Database exceptions carry user-safe messages we wrote; anything else gets the fallback.
  const message = error?.message ?? '';
  throw new Error(message && message.length < 140 && !/violates|constraint|function public/i.test(message) ? message : fallback);
}

async function rpc<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

export type Credentials = { license_number: string; issuing_body: string; specialty: string; city: string; submitted_at: string };
export type PublicProfile = { headline: string; bio: string; specialties: string[]; languages: string[]; years_experience: number | null; is_public: boolean };
export type DoctorSummary = { clinician_id: string; name: string; headline: string | null; specialties: string[]; languages: string[]; cities: string[]; image_bucket: string | null; image_path: string | null; love_count: number };
export type DoctorLocationInfo = {
  id: string; venue_name: string; venue_kind: string; address: string | null; city: string;
  latitude: number | null; longitude: number | null; google_place_id: string | null; specialty: string | null;
  consultation_modes: ('in_person' | 'video')[]; phone: string | null; schedule: string | null; bookable: boolean;
};
export type DoctorProfile = {
  clinician_id: string; name: string; headline: string | null; bio: string | null; specialties: string[];
  languages: string[]; years_experience: number | null; locations: DoctorLocationInfo[];
  is_preview: boolean; featured_source: FeaturedSource; featured_image_path: string | null; avatar_path: string | null;
  gallery: GalleryImage[]; experience: ExperienceEntry[];
  social_links: SocialLink[]; love_count: number; loved_by_me: boolean; comments_enabled: boolean; comment_count: number;
};
export type SocialKind = 'website' | 'instagram' | 'facebook' | 'linkedin' | 'x' | 'youtube' | 'tiktok';
export type SocialLink = { kind: SocialKind; url: string };
export type MyEngagement = { social_links: SocialLink[]; comments_enabled: boolean; love_count: number };
export type DoctorComment = { id: string; author_name: string; body: string; created_at: string; had_visit: boolean; is_mine: boolean; is_hidden: boolean };
export const socialKinds: { kind: SocialKind; label: string; placeholder: string }[] = [
  { kind: 'website', label: 'Website', placeholder: 'https://your-clinic.ma' },
  { kind: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourname' },
  { kind: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
  { kind: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourname' },
  { kind: 'x', label: 'X', placeholder: 'https://x.com/yourname' },
  { kind: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { kind: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourname' },
];
export type FeaturedSource = 'account' | 'upload' | 'none';
export type GalleryImage = { id: string; path: string; caption: string | null };
export type ExperienceEntry = { kind: 'work' | 'education'; title: string; organization: string; location: string | null; start_year: number; end_year: number | null; description: string | null };
export type MyMedia = { featured_source: FeaturedSource; featured_image_path: string | null; avatar_path: string | null; gallery: GalleryImage[] };
export type CvExtraction = { headline: string | null; bio: string | null; specialties: string[]; languages: string[]; years_experience: number | null; experience: ExperienceEntry[] };
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

export const languageOptions = [['fr', 'Français'], ['ar', 'العربية'], ['en', 'English'], ['es', 'Español'], ['zgh', 'Tamazight']] as const;

export async function getMyExperience(): Promise<ExperienceEntry[]> {
  const rows = await rpc<ExperienceEntry[] | null>('get_my_experience', undefined, 'Could not load your experience.');
  return rows ?? [];
}
export const saveMyExperience = (items: ExperienceEntry[]) => rpc('save_my_experience', { p_items: items }, 'Could not save your experience.');
export const getMyMedia = () => rpc<MyMedia>('get_my_media', undefined, 'Could not load your photos.');
export const setFeaturedImage = (source: FeaturedSource, path?: string) => rpc('set_my_featured_image', { p_source: source, p_path: path ?? null }, 'Could not change your featured photo.');
export const addGalleryImage = (path: string) => rpc<string>('add_gallery_image', { p_path: path }, 'Could not add this photo.');

export async function deleteGalleryImage(id: string) {
  const path = await rpc<string>('delete_gallery_image', { p_id: id }, 'Could not remove this photo.');
  await client().storage.from('doctor-media').remove([path]);
}

export async function imageUrl(bucket: string | null, path: string | null): Promise<string | null> {
  if (!bucket || !path || !supabaseClient) return null;
  if (['doctor-media', 'case-media', 'case-videos', 'case-audio'].includes(bucket)) return supabaseClient.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const { data } = await supabaseClient.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

const randomId = () => globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });

/** Lets the doctor pick an image and uploads it to their own folder. Returns the storage path, or null if cancelled. */
export async function pickAndUploadImage(aspect: [number, number]): Promise<string | null> {
  const { data: userData } = await client().auth.getUser();
  if (!userData.user) throw new Error('Sign in first.');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission is needed to choose a photo.');
  const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect, base64: true, mediaTypes: ['images'], quality: 0.7 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.base64) return null;
  if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (asset.base64.length * 0.75 > 3 * 1024 * 1024) throw new Error('This photo is too large. Choose one under 3 MB.');
  const extension = asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userData.user.id}/${randomId()}.${extension}`;
  const bytes = Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0));
  const { error } = await client().storage.from('doctor-media').upload(path, bytes, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });
  if (error) throw new Error('Could not upload this photo. Only verified doctors can add photos.');
  return path;
}

export const GALLERY_LIMIT = 12;

/** Lets the doctor pick several photos at once, uploads them and adds them to the gallery. */
export async function pickAndAddGalleryImages(remaining: number): Promise<{ added: number; skipped: number }> {
  if (remaining <= 0) throw new Error(`You can add up to ${GALLERY_LIMIT} photos.`);
  const { data: userData } = await client().auth.getUser();
  if (!userData.user) throw new Error('Sign in first.');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission is needed to choose photos.');
  const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, base64: true, mediaTypes: ['images'], orderedSelection: true, quality: 0.7, selectionLimit: remaining });
  if (result.canceled) return { added: 0, skipped: 0 };
  let added = 0;
  let skipped = 0;
  for (const asset of result.assets.slice(0, remaining)) {
    const mime = asset.mimeType ?? 'image/jpeg';
    if (!asset.base64 || !['image/jpeg', 'image/png', 'image/webp'].includes(mime) || asset.base64.length * 0.75 > 3 * 1024 * 1024) { skipped += 1; continue; }
    const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userData.user.id}/${randomId()}.${extension}`;
    const bytes = Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0));
    const { error: uploadError } = await client().storage.from('doctor-media').upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadError) { skipped += 1; continue; }
    try { await addGalleryImage(path); added += 1; } catch { skipped += 1; await client().storage.from('doctor-media').remove([path]); }
  }
  if (result.assets.length > remaining) skipped += result.assets.length - remaining;
  return { added, skipped };
}

export const getMyEngagement = () => rpc<MyEngagement>('get_my_engagement', undefined, 'Could not load your links.');
export const setMyEngagement = (links: SocialLink[], commentsEnabled: boolean) =>
  rpc('set_my_engagement', { p_social_links: links, p_comments_enabled: commentsEnabled }, 'Could not save your links.');
export const toggleDoctorLove = (id: string) => rpc<{ loved: boolean; love_count: number }>('toggle_doctor_love', { p_clinician_id: id }, 'Could not update your love.');
export const listDoctorComments = (id: string) => rpc<DoctorComment[]>('list_doctor_comments', { p_clinician_id: id, p_limit: 30 }, 'Could not load comments.').then((rows) => rows ?? []);
export const saveDoctorComment = (id: string, body: string) => rpc('upsert_doctor_comment', { p_clinician_id: id, p_body: body.trim() }, 'Could not save your comment.');
export const deleteMyDoctorComment = (id: string) => rpc('delete_my_doctor_comment', { p_clinician_id: id }, 'Could not delete your comment.');
export const setCommentHidden = (commentId: string, hidden: boolean) => rpc('set_comment_hidden', { p_comment_id: commentId, p_hidden: hidden }, 'Could not update this comment.');
export const commentReportReasons = [
  { value: 'spam', label: 'Spam' }, { value: 'abusive', label: 'Abusive' }, { value: 'false', label: 'False' },
  { value: 'private_info', label: 'Private info' }, { value: 'other', label: 'Other' },
] as const;
export const reportDoctorComment = (commentId: string, reason: string) =>
  rpc('report_doctor_comment', { p_comment_id: commentId, p_reason: reason }, 'Could not send your report.');

/** Accepts "instagram.com/me" and turns it into a full https address; returns null when it cannot be a link. */
export function normalizeLink(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const url = /^https:\/\//i.test(value) ? value : `https://${value.replace(/^[a-z]+:\/\//i, '')}`;
  return /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/[^\s<>"']*)?$/.test(url) && url.length <= 200 ? url : null;
}

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '');

export async function extractCv(pdfBase64: string): Promise<CvExtraction> {
  if (!apiBaseUrl) throw new Error('CV reading is not available yet. Fill your profile in manually.');
  const { data } = await client().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const response = await fetch(`${apiBaseUrl}/v1/doctor/cv-extract`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64 }),
  });
  const body = (await response.json().catch(() => null)) as { extraction?: CvExtraction; error?: string } | null;
  if (!response.ok || !body?.extraction) throw new Error(body?.error ?? 'Could not read this CV.');
  return body.extraction;
}

export function doctorProfileLink(id: string) {
  const webBase = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_WEB_URL;
  return webBase ? `${webBase.replace(/\/$/, '')}/doctors/${id}` : ExpoLinking.createURL(`/doctors/${id}`);
}

export async function shareDoctorProfile(id: string, name: string): Promise<'shared' | 'copied'> {
  const url = doctorProfileLink(id);
  const message = `${name} on Ihssan`;
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title: message, url }); return 'shared'; } catch { /* fall through to copy */ }
    }
    await Clipboard.setStringAsync(url);
    return 'copied';
  }
  await Share.share({ message: `${message}\n${url}`, url });
  return 'shared';
}
