import { matchGuardShifts, type GuardClient, type GuardShift, type GuardType } from './guard.js';
import type { CarePlace, PlaceKind, PlacesClient } from './places.js';

export type CarePlaceWithGuard = CarePlace & { guard: GuardType | null };
export type GuardStatus = 'live' | 'unavailable' | 'not_applicable';

export type CareService = {
  nearby(userId: string, input: NearbyInput): Promise<{ places: CarePlaceWithGuard[]; guardStatus: GuardStatus }>;
  search(userId: string, input: { query: string; latitude?: number; longitude?: number; language: string }): Promise<CarePlace[]>;
};

export type NearbyInput = { latitude: number; longitude: number; radiusMeters: number; kind: PlaceKind | 'all'; language: string };

export class RateLimitError extends Error {}
export class NotConfiguredError extends Error {}

type Clock = () => number;

class TtlCache<T> {
  private readonly entries = new Map<string, { expires: number; value: T }>();
  constructor(private readonly ttlMs: number, private readonly maxEntries: number, private readonly now: Clock) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) { this.entries.delete(key); return undefined; }
    return entry.value;
  }
  set(key: string, value: T) {
    if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value as string);
    this.entries.set(key, { expires: this.now() + this.ttlMs, value });
  }
}

export function createCareService(
  deps: { places: PlacesClient | null; guard: GuardClient | null },
  options: { now?: Clock; requestsPerMinute?: number } = {},
): CareService {
  const now = options.now ?? Date.now;
  const limit = options.requestsPerMinute ?? 30;
  const nearbyCache = new TtlCache<CarePlace[]>(120_000, 500, now);
  const searchCache = new TtlCache<CarePlace[]>(300_000, 500, now);
  const guardCache = new TtlCache<GuardShift[]>(600_000, 100, now);
  const hits = new Map<string, number[]>();

  function checkRate(userId: string) {
    const cutoff = now() - 60_000;
    const recent = (hits.get(userId) ?? []).filter((time) => time > cutoff);
    if (recent.length >= limit) throw new RateLimitError('Too many requests.');
    recent.push(now());
    hits.set(userId, recent);
    if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  }

  async function loadGuardShifts(cities: string[]): Promise<GuardShift[] | null> {
    if (!deps.guard) return null;
    const guard = deps.guard;
    try {
      const lists = await Promise.all(cities.map(async (city) => {
        const cached = guardCache.get(city.toLowerCase());
        if (cached) return cached;
        const shifts = await guard.getOnDuty(city);
        guardCache.set(city.toLowerCase(), shifts);
        return shifts;
      }));
      return lists.flat();
    } catch {
      return null;
    }
  }

  return {
    async nearby(userId, input) {
      checkRate(userId);
      if (!deps.places) throw new NotConfiguredError('Places search is not configured.');
      const key = [input.kind, input.latitude.toFixed(3), input.longitude.toFixed(3), input.radiusMeters, input.language].join(':');
      let places = nearbyCache.get(key);
      if (!places) {
        places = await deps.places.searchNearby(input);
        nearbyCache.set(key, places);
      }

      const pharmacies = places.filter((place) => place.kind === 'pharmacy');
      if (!pharmacies.length) return { places: places.map((place) => ({ ...place, guard: null })), guardStatus: 'not_applicable' };

      const cities = [...new Set(pharmacies.map((place) => place.city).filter(Boolean))].slice(0, 3);
      const shifts = cities.length ? await loadGuardShifts(cities) : null;
      if (!shifts) return { places: places.map((place) => ({ ...place, guard: null })), guardStatus: 'unavailable' };
      const matches = matchGuardShifts(places, shifts);
      return { places: places.map((place) => ({ ...place, guard: matches.get(place.placeId) ?? null })), guardStatus: 'live' };
    },

    async search(userId, input) {
      checkRate(userId);
      if (!deps.places) throw new NotConfiguredError('Places search is not configured.');
      const key = [input.query.toLowerCase(), input.latitude?.toFixed(1), input.longitude?.toFixed(1), input.language].join(':');
      const cached = searchCache.get(key);
      if (cached) return cached;
      const places = await deps.places.searchText(input);
      searchCache.set(key, places);
      return places;
    },
  };
}
