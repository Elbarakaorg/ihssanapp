import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import {
  addPracticeLocation,
  listMyPracticeLocations,
  removePracticeLocation,
  searchCarePlaces,
  type CarePlace,
  type DoctorLocation,
} from '@/features/discovery/care-api';
import { Page, PageHeading, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';

const statusLabels: Record<DoctorLocation['status'], string> = {
  pending: 'Waiting for review',
  verified: 'Visible to patients',
  rejected: 'Rejected',
  retired: 'Not active',
};

export default function PracticeLocationsScreen() {
  useScheme();
  const router = useRouter();
  const [locations, setLocations] = useState<DoctorLocation[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CarePlace[]>([]);
  const [chosen, setChosen] = useState<CarePlace | null>(null);
  const [specialty, setSpecialty] = useState('');
  const [schedule, setSchedule] = useState('');
  const [video, setVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try { setLocations(await listMyPracticeLocations()); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const search = async () => {
    if (query.trim().length < 2) return;
    setBusy(true);
    setMessage('');
    try {
      setResults(await searchCarePlaces({ query: query.trim() }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!chosen) return;
    setBusy(true);
    setMessage('');
    try {
      await addPracticeLocation({ place: chosen, specialty, schedule, video });
      setChosen(null); setResults([]); setQuery(''); setSpecialty(''); setSchedule(''); setVideo(false);
      setMessage('Added. The Ihssan team will review it before patients can see it.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try { await removePracticeLocation(id); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not remove.'); }
  };

  return (
    <Page>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><ArrowLeft color={palette.ink} size={18} /><Text style={styles.backText}>Back</Text></Pressable>
      <PageHeading eyebrow="For clinicians" title="Where patients find you">
        Search for the clinic or hospital where you consult and add it to your profile. Locations are reviewed before patients see them.
      </PageHeading>

      <SectionHeading title="Find your clinic or hospital" />
      <View style={styles.searchRow}>
        <TextInput accessibilityLabel="Search for a clinic or hospital" onChangeText={setQuery} onSubmitEditing={() => void search()} placeholder="Clinic or hospital name, city" placeholderTextColor={palette.muted} returnKeyType="search" style={styles.input} value={query} />
        <Pressable accessibilityLabel="Search" accessibilityRole="button" disabled={busy} onPress={() => void search()} style={styles.searchButton}><Search color={palette.white} size={18} /></Pressable>
      </View>

      {results.map((place) => (
        <Pressable accessibilityRole="button" key={place.placeId} onPress={() => setChosen(place)} style={[uiStyles.card, styles.card, chosen?.placeId === place.placeId && styles.cardChosen]}>
          <Text style={styles.name}>{place.name}</Text>
          <Text style={styles.body}>{place.address}</Text>
        </Pressable>
      ))}

      {chosen ? (
        <View style={[uiStyles.card, styles.card]}>
          <Text style={styles.name}>Add {chosen.name}</Text>
          <TextInput onChangeText={setSpecialty} placeholder="Your specialty here (optional)" placeholderTextColor={palette.muted} style={styles.input} value={specialty} />
          <TextInput onChangeText={setSchedule} placeholder="Consultation days and hours (optional)" placeholderTextColor={palette.muted} style={styles.input} value={schedule} />
          <View style={styles.switchRow}><Text style={styles.body}>I also offer video consultations</Text><Switch onValueChange={setVideo} value={video} /></View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={styles.primary}><Plus color={palette.white} size={16} /><Text style={styles.primaryText}>Add to my profile</Text></Pressable>
        </View>
      ) : null}

      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}

      <SectionHeading title="My locations" detail={`${locations.length}`} />
      {locations.length === 0 ? <Text style={styles.body}>You have not added any location yet.</Text> : null}
      {locations.map((location) => (
        <View key={location.id} style={[uiStyles.card, styles.card]}>
          <View style={styles.switchRow}>
            <View style={styles.flex}><Text style={styles.name}>{location.venue_name}</Text><Text style={styles.body}>{[location.address, location.city].filter(Boolean).join(', ')}</Text></View>
            <Pressable accessibilityLabel={`Remove ${location.venue_name}`} accessibilityRole="button" onPress={() => void remove(location.id)}><Trash2 color={palette.muted} size={18} /></Pressable>
          </View>
          <Text style={styles.status}>{statusLabels[location.status]}</Text>
        </View>
      ))}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 16, minHeight: 35 },
  backText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 10, borderWidth: 1, color: palette.ink, flex: 1, fontSize: 14, minHeight: 44, paddingHorizontal: 12 },
  searchButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 10, height: 44, justifyContent: 'center', width: 44 },
  card: { gap: 8, marginBottom: 9, padding: 14 },
  cardChosen: { borderColor: palette.forest, borderWidth: 2 },
  name: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  body: { color: palette.muted, flexShrink: 1, fontSize: 12, lineHeight: 18 },
  flex: { flex: 1 },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  primary: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 20, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 42 },
  primaryText: { color: palette.white, fontSize: 13, fontWeight: '700' },
  message: { backgroundColor: palette.white, borderRadius: 8, color: palette.ink, fontSize: 12, marginBottom: 10, padding: 10 },
  status: { color: palette.forest, fontSize: 11, fontWeight: '700' },
}));
