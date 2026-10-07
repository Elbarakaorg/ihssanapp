import { describe, expect, it } from 'vitest';
import {
  circleCovers, countByKind, directionsUrl, fetchRadiusKm, filterLocations, formatDistance, fromRaw, haversineKm, mergeLocations,
  noFilters, safeExternalUrl, telUrl, toRuntimePin, type MapLocation,
} from './map-logic';

const base: MapLocation = {
  id: 'p:1', source: 'provider', kind: 'pharmacy', name: 'Pharmacie Atlas', subtitle: 'Pharmacy', address: 'Rue 1', city: 'Casablanca',
  phone: '+212 522 00 00 00', hours: null, website: null, duty: 'none', isEmergency: false, clinicianId: null, latitude: 33.57, longitude: -7.59,
};
const make = (patch: Partial<MapLocation>): MapLocation => ({ ...base, ...patch });

describe('map logic', () => {
  it('measures distance', () => {
    expect(haversineKm({ latitude: 33.5731, longitude: -7.5898 }, { latitude: 34.0209, longitude: -6.8416 })).toBeGreaterThan(85);
    expect(haversineKm(base, base)).toBe(0);
  });
  it('clamps the fetch radius', () => {
    expect(fetchRadiusKm(1)).toBe(10);
    expect(fetchRadiusKm(40)).toBe(60);
    expect(fetchRadiusKm(5000)).toBe(100);
    expect(fetchRadiusKm(NaN)).toBe(10);
  });
  it('knows when a fetch is already covered', () => {
    const outer = { latitude: 33.57, longitude: -7.59, radiusKm: 20 };
    expect(circleCovers(null, outer)).toBe(false);
    expect(circleCovers(outer, { latitude: 33.58, longitude: -7.59, radiusKm: 5 })).toBe(true);
    expect(circleCovers(outer, { latitude: 33.57, longitude: -7.2, radiusKm: 5 })).toBe(false);
  });
  it('merges by id and drops far stale items', () => {
    const far = make({ id: 'p:far', latitude: 20, longitude: 0 });
    const merged = mergeLocations([base, far], [make({ id: 'p:1', name: 'Renamed' })], base);
    expect(merged.map((item) => item.name)).toEqual(['Renamed']);
  });
  it('filters by kind, duty and emergency, and counts kinds', () => {
    const items = [base, make({ id: 'p:2', kind: 'clinic', duty: '24h', isEmergency: true }), make({ id: 'p:3', kind: 'clinic' })];
    expect(filterLocations(items, noFilters)).toHaveLength(3);
    expect(filterLocations(items, { ...noFilters, kind: 'clinic' })).toHaveLength(2);
    expect(filterLocations(items, { ...noFilters, onDuty: true }).map((item) => item.id)).toEqual(['p:2']);
    expect(filterLocations(items, { kind: 'pharmacy', onDuty: true, emergency: false })).toHaveLength(0);
    expect(countByKind(items)).toMatchObject({ all: 3, pharmacy: 1, clinic: 2, doctor: 0 });
  });
  it('formats distances', () => {
    expect(formatDistance(0.04)).toBe('40 m');
    expect(formatDistance(0.0001)).toBe('10 m');
    expect(formatDistance(2.34)).toBe('2.3 km');
    expect(formatDistance(42.6)).toBe('43 km');
    expect(formatDistance(null)).toBe('');
  });
  it('only lets safe links out', () => {
    expect(safeExternalUrl('https://www.google.com/maps')).not.toBeNull();
    expect(safeExternalUrl('tel:+212522000000')).not.toBeNull();
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('http://example.com')).toBeNull();
    expect(safeExternalUrl('tel:+212;rm')).toBeNull();
  });
  it('builds tel and directions links', () => {
    expect(telUrl('+212 522-00 (00)')).toBe('tel:+212522-00(00)'.replace(/[-()]/g, ''));
    expect(telUrl('12')).toBeNull();
    expect(directionsUrl(base, { latitude: 1, longitude: 2 })).toContain('origin=1%2C2');
    expect(directionsUrl(base)).not.toContain('origin');
  });
  it('builds runtime pins without links', () => {
    const pin = toRuntimePin(make({ duty: 'night', clinicianId: 'x' }), { latitude: 33.57, longitude: -7.59 });
    expect(pin).toMatchObject({ duty: 'On duty tonight', canCall: true, canOpenProfile: true, address: 'Rue 1, Casablanca', distance: '10 m' });
    expect(toRuntimePin(make({ phone: null, address: null, city: null }), null)).toMatchObject({ canCall: false, address: '', distance: '' });
  });
  it('rejects unusable rows', () => {
    const raw = { id: 'p:9', source: 'provider', kind: 'zoo', name: 'x', subtitle: null, address: null, city: null, phone: null, hours: null, website: null, duty: 'none', is_emergency: false, clinician_id: null, latitude: 1, longitude: 1 };
    expect(fromRaw(raw)).toBeNull();
    expect(fromRaw({ ...raw, kind: 'clinic', latitude: Number.NaN })).toBeNull();
    expect(fromRaw({ ...raw, kind: 'clinic', duty: 'weird' })?.duty).toBe('none');
  });
});
