import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box, LocateFixed, List, Map as MapIcon, Square, X } from 'lucide-react-native';

import { display, palette, themedStyles, useScheme, wobble } from '@/ui/palette';
import { listMapLocations } from './care-api';
import {
  circleCovers, countByKind, DEFAULT_CENTER, directionsUrl, dutyLabels, fetchRadiusKm, filterLocations, formatDistance, hasActiveFilters,
  haversineKm, isUuid, kindLabels, kindOrder, kindPlurals, mergeLocations, noFilters, safeExternalUrl, telUrl, toRuntimePin,
  type Circle, type LatLng, type MapFilters, type MapLocation,
} from './map-logic';
import { kindColors, type MapEvent, type MapTheme } from './map-runtime';
import MapboxView from './mapbox-view';

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const styleUrl = process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/mapbox/standard';
const MIN_FETCH_ZOOM = 9;
const LIST_LIMIT = 100;

function useMapTheme(): MapTheme {
  const scheme = useScheme();
  return useMemo(() => ({
    paper: palette.paper, white: palette.white, ink: palette.ink, muted: palette.muted, line: palette.line,
    forest: palette.forest, coral: palette.coral, gold: palette.gold, kinds: kindColors,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scheme]);
}

export default function DiscoveryScreen() {
  useScheme();
  const theme = useMapTheme();
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [filters, setFilters] = useState<MapFilters>(noFilters);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [showList, setShowList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [user, setUser] = useState<LatLng | null>(null);
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom: number; key: number } | null>(null);
  const [view, setView] = useState<{ center: LatLng; zoom: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [mapError, setMapError] = useState('');
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const covered = useRef<Circle | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (center: LatLng, radiusKm: number) => {
    const wanted = { ...center, radiusKm };
    if (circleCovers(covered.current, wanted)) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const rows = await listMapLocations({ ...center, radiusKm });
      if (id !== requestId.current) return;
      covered.current = wanted;
      setLocations((previous) => mergeLocations(previous, rows, center));
      setFetchedOnce(true);
      setNotice('');
    } catch (error) {
      if (id === requestId.current) setNotice(error instanceof Error ? error.message : 'Could not load places right now.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const locateMe = useCallback(async (initial = false) => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('denied');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUser(here);
      setNotice('');
      setFly({ lat: here.latitude, lng: here.longitude, zoom: 14, key: Date.now() });
      void load(here, 15);
    } catch {
      setNotice('We could not find where you are, so the map is showing Casablanca. Allow location access to see care near you.');
      if (initial) {
        setFly({ lat: DEFAULT_CENTER.latitude, lng: DEFAULT_CENTER.longitude, zoom: 12, key: Date.now() });
        void load(DEFAULT_CENTER, 15);
      }
    }
  }, [load]);

  useEffect(() => { void locateMe(true); }, [locateMe]);

  const origin = user ?? view?.center ?? DEFAULT_CENTER;
  const visible = useMemo(() => filterLocations(locations, filters), [locations, filters]);
  const counts = useMemo(() => countByKind(locations), [locations]);
  const pins = useMemo(() => visible.map((item) => toRuntimePin(item, user)), [visible, user]);
  const sorted = useMemo(() => [...visible].sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b)).slice(0, LIST_LIMIT), [visible, origin]);
  const byId = useMemo(() => new Map(locations.map((item) => [item.id, item])), [locations]);

  const onEvent = useCallback((event: MapEvent) => {
    if (event.type === 'select') { setSelectedId(event.id); return; }
    if (event.type === 'error') { setMapError(event.message); return; }
    if (event.type === 'moved') {
      const center = { latitude: event.lat, longitude: event.lng };
      setView({ center, zoom: event.zoom });
      if (event.zoom >= MIN_FETCH_ZOOM) void load(center, fetchRadiusKm(event.radiusKm));
      return;
    }
    if (event.type === 'ready') { setMapError(''); return; }
    const place = byId.get(event.id);
    if (!place) return;
    if (event.type === 'directions') { const url = safeExternalUrl(directionsUrl(place, user)); if (url) void Linking.openURL(url); }
    else if (event.type === 'call') { const url = telUrl(place.phone); if (url && safeExternalUrl(url)) void Linking.openURL(url); }
    else if (place.clinicianId && isUuid(place.clinicianId)) router.push(`/doctors/${place.clinicianId}` as Href);
  }, [byId, load, user]);

  const setKind = (kind: MapFilters['kind']) => setFilters((value) => ({ ...value, kind }));
  const zoomedOut = (view?.zoom ?? 0) < MIN_FETCH_ZOOM;
  const empty = fetchedOnce && !loading && !zoomedOut && visible.length === 0;

  if (!token) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.setup}>The map needs a Mapbox token. Set EXPO_PUBLIC_MAPBOX_TOKEN and restart the app.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <MapboxView fly={fly} mode={mode} onEvent={onEvent} pins={pins} selectedId={selectedId} styleUrl={styleUrl} theme={theme} token={token} user={user ? { lat: user.latitude, lng: user.longitude } : null} />

      <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none" style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
          {(['all', ...kindOrder] as const).map((kind) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: filters.kind === kind }} key={kind} onPress={() => setKind(kind)} style={[styles.chip, filters.kind === kind && styles.chipActive]}>
              <Text style={[styles.chipText, filters.kind === kind && styles.chipTextActive]}>
                {kind === 'all' ? 'All' : kindPlurals[kind]}{counts[kind] ? ` · ${counts[kind]}` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.chipRow}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: filters.onDuty }} onPress={() => setFilters((value) => ({ ...value, onDuty: !value.onDuty }))} style={[styles.chip, filters.onDuty && styles.chipGold]}>
            <Text style={styles.chipText}>On duty now</Text>
          </Pressable>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: filters.emergency }} onPress={() => setFilters((value) => ({ ...value, emergency: !value.emergency }))} style={[styles.chip, filters.emergency && styles.chipGold]}>
            <Text style={styles.chipText}>Emergency</Text>
          </Pressable>
          {hasActiveFilters(filters) ? (
            <Pressable accessibilityLabel="Clear filters" accessibilityRole="button" onPress={() => setFilters(noFilters)} style={[styles.chip, styles.clear]}>
              <X color={palette.coral} size={13} /><Text style={[styles.chipText, { color: palette.coral }]}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
        {notice || mapError ? <Text accessibilityRole="alert" style={styles.notice}>{mapError || notice}</Text> : null}
        {zoomedOut && !showList ? <Text style={styles.hint}>Zoom in to see places near you.</Text> : null}
        {empty ? <Text style={styles.hint}>{hasActiveFilters(filters) ? 'Nothing matches these filters here.' : 'No places are listed in this area yet.'}</Text> : null}
        {loading ? <Text style={styles.hint}>Looking nearby…</Text> : null}
      </SafeAreaView>

      <View style={styles.controls}>
        <Pressable accessibilityLabel={mode === '2d' ? 'Switch to 3D view' : 'Switch to 2D view'} accessibilityRole="button" onPress={() => setMode((value) => (value === '2d' ? '3d' : '2d'))} style={styles.control}>
          {mode === '2d' ? <Box color={palette.ink} size={19} strokeWidth={1.8} /> : <Square color={palette.ink} size={19} strokeWidth={1.8} />}
          <Text style={styles.controlText}>{mode === '2d' ? '3D' : '2D'}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Use my location" accessibilityRole="button" onPress={() => void locateMe()} style={styles.control}>
          <LocateFixed color={user ? palette.forest : palette.ink} size={20} strokeWidth={1.8} />
        </Pressable>
      </View>

      {showList ? (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.listPanel}>
          <ScrollView contentContainerStyle={styles.listContent}>
            <Text style={styles.listTitle}>{visible.length} {visible.length === 1 ? 'place' : 'places'}{visible.length > LIST_LIMIT ? `, nearest ${LIST_LIMIT} shown` : ''}</Text>
            {sorted.map((item) => (
              <Pressable accessibilityRole="button" key={item.id} onPress={() => { setSelectedId(item.id); setShowList(false); }} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: kindColors[item.kind] }]} />
                <View style={styles.rowCopy}>
                  <Text numberOfLines={2} style={styles.rowTitle}>{item.name}</Text>
                  <Text numberOfLines={1} style={styles.rowMeta}>{[kindLabels[item.kind], item.duty !== 'none' ? dutyLabels[item.duty] : '', item.city].filter(Boolean).join(' · ')}</Text>
                </View>
                <Text style={styles.rowDistance}>{formatDistance(haversineKm(origin, item))}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => setShowList((value) => !value)} style={styles.toggle}>
        {showList ? <MapIcon color={palette.white} size={16} /> : <List color={palette.white} size={16} />}
        <Text style={styles.toggleText}>{showList ? 'Map' : 'List'}</Text>
      </Pressable>
    </View>
  );
}

const shadow = Platform.OS === 'web' ? { boxShadow: '0 2px 10px rgba(40,30,15,0.2)' } : { elevation: 3 };

const styles = themedStyles(() => StyleSheet.create({
  screen: { backgroundColor: palette.paper, flex: 1 },
  setup: { color: palette.muted, fontSize: 14, lineHeight: 21, padding: 24 },
  overlay: { left: 0, paddingHorizontal: 14, paddingTop: 8, position: 'absolute', right: 0, top: 0 },
  chipRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 3 },
  chip: { ...wobble, ...shadow, alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 34, paddingHorizontal: 13 },
  chipActive: { backgroundColor: palette.forest, borderColor: palette.forest },
  chipGold: { backgroundColor: palette.leaf, borderColor: palette.gold },
  clear: { borderColor: palette.coral },
  chipText: { color: palette.ink, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: palette.white },
  notice: { ...wobble, alignSelf: 'flex-start', backgroundColor: palette.dangerBg, color: palette.dangerText, fontSize: 12, lineHeight: 17, marginTop: 8, overflow: 'hidden', padding: 10 },
  hint: { ...wobble, alignSelf: 'flex-start', backgroundColor: palette.white, color: palette.muted, fontSize: 12, marginTop: 8, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 7 },
  controls: { bottom: 84, gap: 10, position: 'absolute', right: 14 },
  control: { ...wobble, ...shadow, alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: 48, paddingHorizontal: 4 },
  controlText: { color: palette.ink, fontSize: 10, fontWeight: '700' },
  listPanel: { backgroundColor: palette.paper, bottom: 0, left: 0, paddingTop: 100, position: 'absolute', right: 0, top: 0 },
  listContent: { gap: 8, padding: 14, paddingBottom: 100 },
  listTitle: { ...display, color: palette.ink, fontSize: 20 },
  row: { ...wobble, alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 56, padding: 12 },
  dot: { borderRadius: 6, flexShrink: 0, height: 12, width: 12 },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: palette.muted, fontSize: 12 },
  rowDistance: { color: palette.muted, flexShrink: 0, fontSize: 12, fontVariant: ['tabular-nums'] },
  toggle: { ...wobble, ...shadow, alignItems: 'center', alignSelf: 'center', backgroundColor: palette.forest, bottom: 20, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 22, position: 'absolute' },
  toggleText: { color: palette.white, fontSize: 14, fontWeight: '700' },
}));
