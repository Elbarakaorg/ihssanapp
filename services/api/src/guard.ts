import type { CarePlace } from './places.js';

export type GuardType = 'day' | 'night' | '24h';

export type GuardShift = {
  name: string;
  city: string;
  guardType: GuardType;
  latitude: number | null;
  longitude: number | null;
};

export type GuardClient = {
  getOnDuty(city: string): Promise<GuardShift[]>;
};

export type HirassaConfig = {
  // Full endpoint URL. "{city}" is replaced with the URL-encoded city name.
  guardsUrl: string;
  apiKey: string;
  authHeader?: string;
};

export function createHirassaClient(config: HirassaConfig, fetchImpl: typeof fetch = fetch): GuardClient {
  const url = new URL(config.guardsUrl.replace('{city}', 'CITY_PLACEHOLDER'));
  if (url.protocol !== 'https:') throw new Error('HIRASSA_GUARDS_URL must use HTTPS.');
  const authHeader = config.authHeader ?? 'Authorization';

  return {
    async getOnDuty(city) {
      const response = await fetchImpl(config.guardsUrl.replace('{city}', encodeURIComponent(city)), {
        headers: { [authHeader]: authHeader.toLowerCase() === 'authorization' ? `Bearer ${config.apiKey}` : config.apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Hirassa request failed with status ${response.status}.`);
      return parseHirassaGuards(await response.json(), city);
    },
  };
}

// ASSUMPTION: Hirassa's real response format is not documented to us yet. This accepts a plain array or
// { data: [...] } with common field names, and ignores anything it cannot interpret. Adjust here once the
// real documentation is available; nothing else depends on the raw format.
export function parseHirassaGuards(payload: unknown, fallbackCity: string): GuardShift[] {
  const list = Array.isArray(payload) ? payload : Array.isArray((payload as { data?: unknown })?.data) ? (payload as { data: unknown[] }).data : [];
  return list.flatMap((entry): GuardShift[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const name = firstString(record, ['name', 'pharmacy_name', 'pharmacie', 'nom']);
    const guardType = parseGuardType(firstString(record, ['type', 'guard_type', 'garde']));
    if (!name || !guardType) return [];
    return [{
      name,
      city: firstString(record, ['city', 'ville']) ?? fallbackCity,
      guardType,
      latitude: firstNumber(record, ['latitude', 'lat']),
      longitude: firstNumber(record, ['longitude', 'lng', 'lon']),
    }];
  });
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(record[key]);
    if (record[key] !== null && record[key] !== '' && Number.isFinite(value)) return value;
  }
  return null;
}

function parseGuardType(value: string | undefined): GuardType | null {
  const text = value?.toLowerCase() ?? '';
  if (/24/.test(text)) return '24h';
  if (/nuit|night/.test(text)) return 'night';
  if (/jour|day/.test(text)) return 'day';
  return null;
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bpharmacie\b|\bpharmacy\b|\bde\b|\bdu\b|\bla\b|\ble\b|\bdes\b/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const matchRadiusMeters = 150;

// Returns the guard type per Google placeId. A shift matches by coordinates when Hirassa supplies them,
// otherwise by exact normalised name within the same city, which avoids false "on duty" badges.
export function matchGuardShifts(places: CarePlace[], shifts: GuardShift[]): Map<string, GuardType> {
  const result = new Map<string, GuardType>();
  for (const shift of shifts) {
    let match: CarePlace | undefined;
    if (shift.latitude !== null && shift.longitude !== null) {
      const point = { latitude: shift.latitude, longitude: shift.longitude };
      const candidates = places
        .filter((place) => place.kind === 'pharmacy')
        .map((place) => ({ place, distance: distanceMeters(point, place) }))
        .filter((candidate) => candidate.distance <= matchRadiusMeters)
        .sort((a, b) => a.distance - b.distance);
      match = candidates[0]?.place;
    } else {
      const wanted = normalizeName(shift.name);
      const sameName = places.filter((place) =>
        place.kind === 'pharmacy' &&
        normalizeName(place.name) === wanted &&
        (!place.city || !shift.city || normalizeName(place.city) === normalizeName(shift.city)));
      if (sameName.length === 1) match = sameName[0];
    }
    if (match) result.set(match.placeId, shift.guardType);
  }
  return result;
}
