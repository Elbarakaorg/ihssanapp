import { supabaseClient } from '@/platform/supabase/client';

export type PlaceKind = 'pharmacy' | 'hospital' | 'clinic';
export type GuardType = 'day' | 'night' | '24h';

export type CarePlace = {
  placeId: string;
  kind: PlaceKind;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  latitude: number;
  longitude: number;
};

export type NearbyPlace = CarePlace & { guard: GuardType | null };
export type GuardStatus = 'live' | 'unavailable' | 'not_applicable';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '');

async function apiGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  if (!apiBaseUrl) throw new Error('The care directory is not configured yet.');
  const { data } = (await supabaseClient?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to search for care.');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
  const response = await fetch(`${apiBaseUrl}${path}?${query}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 429) throw new Error('Too many searches. Please wait a moment.');
  if (!response.ok) throw new Error('Could not load places right now.');
  return (await response.json()) as T;
}

export function fetchNearbyCare(input: { latitude: number; longitude: number; radius?: number; kind?: PlaceKind | 'all' }) {
  return apiGet<{ places: NearbyPlace[]; guardStatus: GuardStatus }>('/v1/care/nearby', {
    lat: input.latitude,
    lng: input.longitude,
    radius: input.radius,
    kind: input.kind,
  });
}

export async function searchCarePlaces(input: { query: string; latitude?: number; longitude?: number }) {
  const result = await apiGet<{ places: CarePlace[] }>('/v1/care/search', { q: input.query, lat: input.latitude, lng: input.longitude });
  return result.places;
}

export function directionsUrl(place: { latitude: number; longitude: number; placeId?: string }, origin?: { latitude: number; longitude: number } | null) {
  const params = new URLSearchParams({ api: '1', destination: `${place.latitude},${place.longitude}` });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  if (place.placeId) params.set('destination_place_id', place.placeId);
  return `https://www.google.com/maps/dir/?${params}`;
}

export type DoctorLocation = {
  id: string;
  clinician_id: string;
  doctor_name: string | null;
  venue_kind: 'clinic' | 'hospital' | 'private_office';
  venue_name: string;
  google_place_id: string;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
  specialty: string | null;
  consultation_modes: string[];
  schedule: string | null;
  phone: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'retired';
};

const locationColumns = 'id,clinician_id,doctor_name,venue_kind,venue_name,google_place_id,city,address,latitude,longitude,specialty,consultation_modes,schedule,phone,status';

export async function listVerifiedDoctorLocations(): Promise<DoctorLocation[]> {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('clinician_practice_locations')
    .select(locationColumns)
    .eq('status', 'verified')
    .limit(500);
  if (error) throw new Error('Could not load doctors.');
  return (data ?? []) as DoctorLocation[];
}

export async function listMyPracticeLocations(): Promise<DoctorLocation[]> {
  if (!supabaseClient) return [];
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabaseClient
    .from('clinician_practice_locations')
    .select(locationColumns)
    .eq('clinician_id', userData.user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Could not load your locations.');
  return (data ?? []) as DoctorLocation[];
}

export type NewPracticeLocation = {
  place: CarePlace;
  specialty: string;
  schedule: string;
  video: boolean;
};

export async function addPracticeLocation(input: NewPracticeLocation): Promise<void> {
  if (!supabaseClient) throw new Error('Not configured.');
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData.user) throw new Error('Sign in first.');
  const { place } = input;
  const { error } = await supabaseClient.from('clinician_practice_locations').insert({
    clinician_id: userData.user.id,
    venue_kind: place.kind === 'hospital' ? 'hospital' : 'clinic',
    venue_name: place.name,
    google_place_id: place.placeId,
    city: place.city || 'Unknown',
    address: place.address || null,
    latitude: place.latitude,
    longitude: place.longitude,
    specialty: input.specialty.trim() || null,
    consultation_modes: input.video ? ['in_person', 'video'] : ['in_person'],
    schedule: input.schedule.trim() || null,
    phone: place.phone && /^\+?[0-9 ()-]{6,20}$/.test(place.phone) ? place.phone : null,
  });
  if (error) {
    if (error.code === '23505') throw new Error('You already added this place.');
    throw new Error('Could not save this location. Make sure your clinician account is set up.');
  }
}

export async function removePracticeLocation(id: string): Promise<void> {
  if (!supabaseClient) throw new Error('Not configured.');
  const { error } = await supabaseClient.from('clinician_practice_locations').delete().eq('id', id);
  if (error) throw new Error('Could not remove this location.');
}
