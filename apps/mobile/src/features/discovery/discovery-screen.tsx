import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2, Clock, Hospital, List, Map as MapIcon, MapPin, LocateFixed, Navigation, Phone, Pill, RefreshCw, Stethoscope, X } from 'lucide-react-native';

import { supabaseClient } from '@/platform/supabase/client';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import {
  directionsUrl,
  fetchNearbyCare,
  listVerifiedDoctorLocations,
  type DoctorLocation,
  type GuardStatus,
  type GuardType,
  type NearbyPlace,
} from './care-api';
import ProviderMap from './provider-map';
import { DEFAULT_CENTER, pinColors, type MapPin as Pin } from './provider-types';

type Filter = 'all' | 'duty' | 'pharmacy' | 'hospital' | 'clinic' | 'doctor';

type Item = {
  id: string;
  kind: Pin['kind'];
  title: string;
  subtitle: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  placeId?: string;
  guard: GuardType | null;
  detail?: string;
};

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'duty', label: 'On duty' },
  { id: 'pharmacy', label: 'Pharmacies' },
  { id: 'hospital', label: 'Hospitals' },
  { id: 'clinic', label: 'Clinics' },
  { id: 'doctor', label: 'Doctors' },
];

const guardLabels: Record<GuardType, string> = { day: 'On duty today (day)', night: 'On duty tonight', '24h': 'Open 24/7' };
const kindLabels: Record<Pin['kind'], string> = { pharmacy: 'Pharmacy', hospital: 'Hospital', clinic: 'Clinic', doctor: 'Doctor' };

function fromPlace(place: NearbyPlace): Item {
  return {
    id: `g:${place.placeId}`,
    kind: place.kind,
    title: place.name,
    subtitle: kindLabels[place.kind],
    address: [place.address].filter(Boolean).join(', '),
    phone: place.phone,
    latitude: place.latitude,
    longitude: place.longitude,
    placeId: place.placeId,
    guard: place.guard,
  };
}

function fromDoctor(location: DoctorLocation): Item {
  return {
    id: `d:${location.id}`,
    kind: 'doctor',
    title: location.doctor_name ?? 'Doctor',
    subtitle: [location.specialty, location.venue_name].filter(Boolean).join(' · '),
    address: [location.address, location.city].filter(Boolean).join(', '),
    phone: location.phone,
    latitude: location.latitude,
    longitude: location.longitude,
    placeId: location.google_place_id,
    guard: null,
    detail: [location.schedule, location.consultation_modes.includes('video') ? 'Video consultations available' : null].filter(Boolean).join(' · '),
  };
}

function KindIcon({ kind, color }: { kind: Pin['kind']; color: string }) {
  const Icon = kind === 'pharmacy' ? Pill : kind === 'hospital' ? Hospital : kind === 'clinic' ? Building2 : Stethoscope;
  return <Icon color={color} size={18} strokeWidth={1.8} />;
}

function PlaceCard({ item, onClose, origin }: { item: Item; onClose?: () => void; origin: { latitude: number; longitude: number } | null }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.icon, { backgroundColor: `${pinColors[item.kind]}22` }]}><KindIcon color={pinColors[item.kind]} kind={item.kind} /></View>
        <View style={styles.cardCopy}>
          <Text style={styles.name}>{item.title}</Text>
          <Text style={styles.body}>{item.subtitle}</Text>
        </View>
        {onClose ? <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}><X color={palette.ink} size={18} /></Pressable> : null}
      </View>
      {item.guard ? <View style={styles.guardBadge}><Clock color="#7A5200" size={13} /><Text style={styles.guardText}>{guardLabels[item.guard]}. Please call to confirm.</Text></View> : null}
      {item.address ? <View style={styles.row}><MapPin color={palette.muted} size={14} /><Text style={styles.body}>{item.address}</Text></View> : null}
      {item.detail ? <View style={styles.row}><Clock color={palette.muted} size={14} /><Text style={styles.body}>{item.detail}</Text></View> : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(directionsUrl(item, origin))} style={styles.action}>
          <Navigation color={palette.white} size={14} /><Text style={styles.actionText}>Directions</Text>
        </Pressable>
        {item.phone ? (
          <Pressable accessibilityLabel={`Call ${item.title}`} accessibilityRole="link" onPress={() => void Linking.openURL(`tel:${item.phone!.replace(/[^+\d]/g, '')}`)} style={[styles.action, styles.actionSecondary]}>
            <Phone color={palette.forest} size={14} /><Text style={styles.actionSecondaryText}>Call</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function DiscoveryScreen() {
  useScheme();
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [doctors, setDoctors] = useState<DoctorLocation[]>([]);
  const [guardStatus, setGuardStatus] = useState<GuardStatus>('not_applicable');
  const [filter, setFilter] = useState<Filter>('all');
  const [showList, setShowList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const center = useRef(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [focus, setFocus] = useState<{ latitude: number; longitude: number; key: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const locateMe = useCallback(async () => {
    setLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError('Location permission is off. Allow it in your browser or phone settings to find care near you.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(next);
      center.current = next;
      setFocus({ ...next, key: Date.now() });
      setLoading(true);
      setError('');
      const result = await fetchNearbyCare({ ...next, radius: 5000, kind: 'all' });
      setPlaces(result.places);
      setGuardStatus(result.guardStatus);
      setSearched(true);
    } catch {
      setLocationError('Could not detect your location. Check that location services are on and try again.');
    } finally {
      setLocating(false);
      setLoading(false);
    }
  }, []);

  const searchHere = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchNearbyCare({ ...center.current, radius: 5000, kind: 'all' });
      setPlaces(result.places);
      setGuardStatus(result.guardStatus);
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Could not load places right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void searchHere();
    if (supabaseClient) void listVerifiedDoctorLocations().then(setDoctors).catch(() => undefined);
  }, [searchHere]);

  const items = useMemo(() => {
    const all = [...places.map(fromPlace), ...doctors.map(fromDoctor)];
    return all.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'duty') return item.guard !== null;
      return item.kind === filter;
    }).sort((a, b) => Number(b.guard !== null) - Number(a.guard !== null));
  }, [places, doctors, filter]);

  const pins: Pin[] = useMemo(() => items.map((item) => ({
    id: item.id, kind: item.kind, latitude: item.latitude, longitude: item.longitude, title: item.title, onDuty: item.guard !== null,
  })), [items]);

  const onCenterChange = useCallback((next: { latitude: number; longitude: number }) => { center.current = next; }, []);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <View style={styles.screen}>
      <ProviderMap focus={focus} onCenterChange={onCenterChange} onSelect={setSelectedId} pins={pins} selectedId={selected?.id ?? null} userLocation={userLocation} />

      <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none" style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.filterRow} horizontal showsHorizontalScrollIndicator={false}>
          {filters.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.id }}
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.chip, filter === item.id && styles.chipActive]}>
              <Text style={[styles.chipText, filter === item.id && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {error || locationError ? <Text accessibilityRole="alert" style={styles.error}>{error || locationError}</Text> : null}
        {guardStatus === 'unavailable' ? <Text style={styles.notice}>On-duty pharmacy information is temporarily unavailable. Call a pharmacy to confirm it is open.</Text> : null}
        {searched && !loading && !error && !items.length ? <Text style={styles.notice}>Nothing found here. Move the map and search this area.</Text> : null}
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void searchHere()} style={styles.searchHere}>
          <RefreshCw color={palette.forest} size={14} /><Text style={styles.searchHereText}>{loading ? 'Searching…' : 'Search this area'}</Text>
        </Pressable>
      </SafeAreaView>

      <Pressable accessibilityLabel="Use my location" accessibilityRole="button" disabled={locating} onPress={() => void locateMe()} style={styles.locate}>
        <LocateFixed color={userLocation ? '#1A73E8' : palette.ink} size={20} />
      </Pressable>

      {selected && !showList ? (
        <View pointerEvents="box-none" style={styles.bottomCard}>
          <PlaceCard item={selected} onClose={() => setSelectedId(null)} origin={userLocation} />
        </View>
      ) : null}

      {showList ? (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.listPanel}>
          <ScrollView contentContainerStyle={styles.listContent}>
            <Text style={styles.listTitle}>{items.length} places</Text>
            {items.map((item) => (
              <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setShowList(false); }}>
                <PlaceCard item={item} origin={userLocation} />
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

const styles = themedStyles(() => StyleSheet.create({
  screen: { backgroundColor: palette.paper, flex: 1 },
  overlay: { left: 0, paddingHorizontal: 14, paddingTop: 8, position: 'absolute', right: 0, top: 0 },
  filterRow: { gap: 7, paddingVertical: 2 },
  chip: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 16, borderWidth: 1, boxShadow: '0 1px 6px rgba(0,0,0,0.12)', justifyContent: 'center', minHeight: 34, paddingHorizontal: 13 },
  chipActive: { backgroundColor: palette.forest, borderColor: palette.forest },
  chipText: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: palette.white },
  error: { backgroundColor: '#FCE9E5', borderRadius: 8, color: '#9A3E2A', fontSize: 12, marginTop: 10, padding: 10 },
  notice: { alignSelf: 'flex-start', backgroundColor: palette.white, borderRadius: 8, color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 10, overflow: 'hidden', padding: 10 },
  locate: { alignItems: 'center', backgroundColor: palette.white, borderRadius: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.25)', height: 48, justifyContent: 'center', position: 'absolute', right: 14, bottom: 84, width: 48 },
  searchHere: { alignItems: 'center', alignSelf: 'center', backgroundColor: palette.white, borderRadius: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', flexDirection: 'row', gap: 6, marginTop: 10, minHeight: 36, paddingHorizontal: 14 },
  searchHereText: { color: palette.forest, fontSize: 12, fontWeight: '700' },
  bottomCard: { bottom: 76, left: 14, position: 'absolute', right: 14 },
  listPanel: { backgroundColor: palette.paper, bottom: 0, left: 0, paddingTop: 70, position: 'absolute', right: 0, top: 0 },
  listContent: { gap: 9, padding: 14, paddingBottom: 100 },
  listTitle: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  toggle: { alignItems: 'center', alignSelf: 'center', backgroundColor: palette.forest, borderRadius: 22, bottom: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.25)', flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 20, position: 'absolute' },
  toggleText: { color: palette.white, fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  icon: { alignItems: 'center', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  cardCopy: { flex: 1, gap: 2 },
  close: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  name: { color: palette.ink, fontSize: 16, fontWeight: '600' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  body: { color: palette.muted, flexShrink: 1, fontSize: 12, lineHeight: 18 },
  guardBadge: { alignItems: 'center', backgroundColor: '#FFF3D1', borderRadius: 8, flexDirection: 'row', gap: 6, padding: 8 },
  guardText: { color: '#7A5200', flexShrink: 1, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  action: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 18, flexDirection: 'row', gap: 6, minHeight: 36, paddingHorizontal: 14 },
  actionText: { color: palette.white, fontSize: 12, fontWeight: '700' },
  actionSecondary: { backgroundColor: palette.white, borderColor: palette.forest, borderWidth: 1 },
  actionSecondaryText: { color: palette.forest, fontSize: 12, fontWeight: '700' },
}));
