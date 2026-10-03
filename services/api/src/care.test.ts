import { describe, expect, it, vi } from 'vitest';

import { createApi } from './app.js';
import { createCareService } from './care-service.js';
import type { DataAccess } from './data-access.js';
import { createHirassaClient, matchGuardShifts, parseHirassaGuards } from './guard.js';
import { createGooglePlacesClient, type CarePlace, type PlacesClient } from './places.js';

const pharmacy = (placeId: string, name: string, latitude: number, longitude: number, city = 'Casablanca'): CarePlace =>
  ({ placeId, kind: 'pharmacy', name, address: '', city, phone: null, latitude, longitude });

describe('Google Places client', () => {
  it('sends a restricted field mask without opening hours and normalises places', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      places: [
        { id: 'p1', displayName: { text: 'Pharmacie Atlas' }, formattedAddress: 'Rue 1', location: { latitude: 33.5, longitude: -7.6 }, types: ['pharmacy'], addressComponents: [{ longText: 'Casablanca', types: ['locality'] }] },
        { id: 'bad', displayName: { text: 'No location' } },
      ],
    })));
    const client = createGooglePlacesClient('key', fetchImpl as unknown as typeof fetch);
    const places = await client.searchNearby({ latitude: 33.5, longitude: -7.6, radiusMeters: 3000, kind: 'pharmacy', language: 'fr' });

    expect(places).toEqual([expect.objectContaining({ placeId: 'p1', kind: 'pharmacy', city: 'Casablanca' })]);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Goog-FieldMask']).not.toContain('opening');
    expect(headers['X-Goog-Api-Key']).toBe('key');
    expect(JSON.parse(init.body as string).includedTypes).toEqual(['pharmacy']);
  });

  it('keeps only health places in text search', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      places: [
        { id: 'a', displayName: { text: 'Clinique X' }, location: { latitude: 1, longitude: 1 }, types: ['hospital'] },
        { id: 'b', displayName: { text: 'Cafe' }, location: { latitude: 1, longitude: 1 }, types: ['cafe'] },
      ],
    })));
    const client = createGooglePlacesClient('key', fetchImpl as unknown as typeof fetch);
    const places = await client.searchText({ query: 'clinique', language: 'fr' });
    expect(places.map((place) => place.placeId)).toEqual(['a']);
  });

  it('throws when Google rejects the request', async () => {
    const client = createGooglePlacesClient('key', (async () => new Response('no', { status: 403 })) as unknown as typeof fetch);
    await expect(client.searchText({ query: 'x', language: 'fr' })).rejects.toThrow();
  });
});

describe('guard data', () => {
  it('parses guard types and ignores entries it cannot interpret', () => {
    const shifts = parseHirassaGuards({ data: [
      { name: 'Pharmacie A', type: 'Garde de nuit', lat: '33.5', lng: -7.6 },
      { name: 'Pharmacie B', type: 'garde de jour' },
      { name: 'Pharmacie C', type: '24h/24' },
      { name: 'Pharmacie D', type: 'unknown' },
      'junk',
    ] }, 'Rabat');
    expect(shifts.map((shift) => shift.guardType)).toEqual(['night', 'day', '24h']);
    expect(shifts[0]).toMatchObject({ latitude: 33.5, longitude: -7.6 });
    expect(shifts[1]).toMatchObject({ city: 'Rabat', latitude: null });
  });

  it('matches by coordinates within 150 metres and picks the nearest', () => {
    const places = [pharmacy('near', 'Pharmacie X', 33.5001, -7.6001), pharmacy('far', 'Pharmacie X', 33.52, -7.6)];
    const matches = matchGuardShifts(places, [{ name: 'Pharmacie X', city: 'Casablanca', guardType: 'night', latitude: 33.5, longitude: -7.6 }]);
    expect(matches.get('near')).toBe('night');
    expect(matches.has('far')).toBe(false);
  });

  it('matches by exact normalised name and refuses ambiguous names', () => {
    const unique = matchGuardShifts([pharmacy('a', 'Pharmacie Al Amal', 1, 1)], [{ name: 'AL AMAL', city: 'casablanca', guardType: 'day', latitude: null, longitude: null }]);
    expect(unique.get('a')).toBe('day');

    const ambiguous = matchGuardShifts(
      [pharmacy('a', 'Pharmacie Al Amal', 1, 1), pharmacy('b', 'Pharmacie Al Amal', 2, 2)],
      [{ name: 'Al Amal', city: 'Casablanca', guardType: 'day', latitude: null, longitude: null }],
    );
    expect(ambiguous.size).toBe(0);
  });

  it('requires an https guard endpoint', () => {
    expect(() => createHirassaClient({ guardsUrl: 'http://example.com/{city}', apiKey: 'k' })).toThrow();
  });
});

describe('care service', () => {
  const places: PlacesClient = {
    searchNearby: vi.fn(async () => [pharmacy('p1', 'Pharmacie Atlas', 33.5, -7.6)]),
    searchText: vi.fn(async () => []),
  };

  it('marks guard pharmacies when Hirassa responds and caches Google calls', async () => {
    const guard = { getOnDuty: vi.fn(async () => [{ name: 'Atlas', city: 'Casablanca', guardType: 'night' as const, latitude: null, longitude: null }]) };
    const service = createCareService({ places, guard });
    const input = { latitude: 33.5, longitude: -7.6, radiusMeters: 3000, kind: 'pharmacy' as const, language: 'fr' };
    const first = await service.nearby('u1', input);
    await service.nearby('u1', input);

    expect(first.guardStatus).toBe('live');
    expect(first.places[0].guard).toBe('night');
    expect(places.searchNearby).toHaveBeenCalledTimes(1);
    expect(guard.getOnDuty).toHaveBeenCalledTimes(1);
  });

  it('reports guard data as unavailable instead of guessing when Hirassa fails or is not configured', async () => {
    const failing = createCareService({ places, guard: { getOnDuty: async () => { throw new Error('down'); } } });
    const input = { latitude: 34, longitude: -6.8, radiusMeters: 3000, kind: 'pharmacy' as const, language: 'fr' };
    expect((await failing.nearby('u1', input)).guardStatus).toBe('unavailable');
    expect((await createCareService({ places, guard: null }).nearby('u1', { ...input, latitude: 35 })).guardStatus).toBe('unavailable');
  });

  it('rate limits per user', async () => {
    const service = createCareService({ places, guard: null }, { requestsPerMinute: 2 });
    const input = { latitude: 1, longitude: 1, radiusMeters: 3000, kind: 'all' as const, language: 'fr' };
    await service.nearby('u1', input);
    await service.nearby('u1', input);
    await expect(service.nearby('u1', input)).rejects.toThrow('Too many requests');
    await expect(service.nearby('u2', input)).resolves.toBeDefined();
  });
});

describe('care routes', () => {
  const dataAccess = { verifyAccessToken: vi.fn(async (token: string) => token === 'valid' ? { id: 'u1', email: null } : null) } as unknown as DataAccess;
  const service = createCareService({ places: { searchNearby: async () => [], searchText: async () => [] }, guard: null });

  it('requires authentication', async () => {
    const response = await createApi(dataAccess, [], null, service).request('/v1/care/nearby?lat=33&lng=-7');
    expect(response.status).toBe(401);
  });

  it('validates coordinates and radius', async () => {
    const app = createApi(dataAccess, [], null, service);
    const headers = { Authorization: 'Bearer valid' };
    expect((await app.request('/v1/care/nearby?lat=999&lng=-7', { headers })).status).toBe(400);
    expect((await app.request('/v1/care/nearby?lat=33&lng=-7&radius=999999', { headers })).status).toBe(400);
    expect((await app.request('/v1/care/search?q=a', { headers })).status).toBe(400);
    expect((await app.request('/v1/care/nearby?lat=33&lng=-7', { headers })).status).toBe(200);
  });

  it('returns 503 when the directory is not configured', async () => {
    const response = await createApi(dataAccess).request('/v1/care/nearby?lat=33&lng=-7', { headers: { Authorization: 'Bearer valid' } });
    expect(response.status).toBe(503);
  });
});
