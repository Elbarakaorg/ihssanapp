export type LocationKind = 'pharmacy' | 'clinic' | 'hospital' | 'laboratory' | 'doctor';
export type Duty = 'none' | 'day' | 'night' | '24h';
export type LatLng = { latitude: number; longitude: number };

export type MapLocation = LatLng & {
  id: string;
  source: 'provider' | 'doctor';
  kind: LocationKind;
  name: string;
  subtitle: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  hours: string | null;
  website: string | null;
  duty: Duty;
  isEmergency: boolean;
  clinicianId: string | null;
};

export type MapFilters = { kind: LocationKind | 'all'; onDuty: boolean; emergency: boolean };
export const noFilters: MapFilters = { kind: 'all', onDuty: false, emergency: false };

export const kindLabels: Record<LocationKind, string> = {
  pharmacy: 'Pharmacy', clinic: 'Clinic', hospital: 'Hospital', laboratory: 'Laboratory', doctor: 'Doctor',
};
export const kindPlurals: Record<LocationKind, string> = {
  pharmacy: 'Pharmacies', clinic: 'Clinics', hospital: 'Hospitals', laboratory: 'Labs', doctor: 'Doctors',
};
export const kindOrder: LocationKind[] = ['pharmacy', 'clinic', 'hospital', 'laboratory', 'doctor'];

export const DEFAULT_CENTER: LatLng = { latitude: 33.5731, longitude: -7.5898 };
export const MAX_FETCH_KM = 100;
export const MIN_FETCH_KM = 10;

export function haversineKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Circle = LatLng & { radiusKm: number };

/** Radius to request for a viewport: a margin around what is visible, never tiny, never the whole country. */
export function fetchRadiusKm(viewportRadiusKm: number) {
  const wanted = Number.isFinite(viewportRadiusKm) ? viewportRadiusKm * 1.5 : MIN_FETCH_KM;
  return Math.round(Math.min(MAX_FETCH_KM, Math.max(MIN_FETCH_KM, wanted)) * 10) / 10;
}

/** True when `inner` lies completely inside `outer`, i.e. a new fetch would add nothing. */
export function circleCovers(outer: Circle | null, inner: Circle) {
  if (!outer) return false;
  return haversineKm(outer, inner) + inner.radiusKm <= outer.radiusKm;
}

export function mergeLocations(previous: MapLocation[], incoming: MapLocation[], center: LatLng, keepKm = MAX_FETCH_KM * 2) {
  const byId = new Map<string, MapLocation>();
  for (const item of previous) if (haversineKm(center, item) <= keepKm) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}

export function filterLocations(items: MapLocation[], filters: MapFilters) {
  return items.filter((item) => {
    if (filters.kind !== 'all' && item.kind !== filters.kind) return false;
    if (filters.onDuty && item.duty === 'none') return false;
    if (filters.emergency && !item.isEmergency) return false;
    return true;
  });
}

export function countByKind(items: MapLocation[]) {
  const counts: Record<LocationKind | 'all', number> = { all: items.length, pharmacy: 0, clinic: 0, hospital: 0, laboratory: 0, doctor: 0 };
  for (const item of items) counts[item.kind] += 1;
  return counts;
}

export function hasActiveFilters(filters: MapFilters) {
  return filters.kind !== 'all' || filters.onDuty || filters.emergency;
}

export const dutyLabels: Record<Duty, string> = { none: '', day: 'On duty today', night: 'On duty tonight', '24h': 'Open 24/7' };

export function formatDistance(km: number | null | undefined) {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Only https links and phone numbers may leave the app from a map message. */
export function safeExternalUrl(url: string) {
  return /^(https:\/\/|tel:\+?[0-9]{4,20}$)/i.test(url) ? url : null;
}

export function telUrl(phone: string | null) {
  const digits = (phone ?? '').replace(/[^+\d]/g, '');
  return digits.length >= 4 ? `tel:${digits}` : null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function directionsUrl(place: LatLng, origin?: LatLng | null) {
  const params = new URLSearchParams({ api: '1', destination: `${place.latitude},${place.longitude}` });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Shape sent to the map runtime: plain data only, never markup. */
export function toRuntimePin(item: MapLocation, origin: LatLng | null) {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    subtitle: item.subtitle,
    address: [item.address, item.city].filter(Boolean).join(', '),
    hours: item.hours ?? '',
    lat: item.latitude,
    lng: item.longitude,
    duty: item.duty === 'none' ? '' : dutyLabels[item.duty],
    emergency: item.isEmergency,
    distance: origin ? formatDistance(haversineKm(origin, item)) : '',
    canCall: telUrl(item.phone) !== null,
    canOpenProfile: item.clinicianId !== null,
  };
}

export type RuntimePin = ReturnType<typeof toRuntimePin>;

export type RawLocation = {
  id: string; source: string; kind: string; name: string; subtitle: string | null; address: string | null; city: string | null;
  phone: string | null; hours: string | null; website: string | null; duty: string; is_emergency: boolean;
  clinician_id: string | null; latitude: number; longitude: number;
};

export function fromRaw(row: RawLocation): MapLocation | null {
  if (!kindOrder.includes(row.kind as LocationKind)) return null;
  if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return null;
  return {
    id: row.id,
    source: row.source === 'doctor' ? 'doctor' : 'provider',
    kind: row.kind as LocationKind,
    name: row.name,
    subtitle: row.subtitle ?? '',
    address: row.address,
    city: row.city,
    phone: row.phone,
    hours: row.hours,
    website: row.website,
    duty: (['day', 'night', '24h'] as const).find((value) => value === row.duty) ?? 'none',
    isEmergency: row.is_emergency,
    clinicianId: row.clinician_id,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}
