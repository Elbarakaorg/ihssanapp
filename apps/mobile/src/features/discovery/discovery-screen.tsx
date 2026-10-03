import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, List, MapPin, Phone, Pill, Map as MapIcon, Stethoscope, X } from 'lucide-react-native';

import { supabaseClient } from '@/platform/supabase/client';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import ProviderMap from './provider-map';
import type { Provider } from './provider-types';

type Filter = 'all' | 'doctor' | 'pharmacy';

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'doctor', label: 'Doctors' },
  { id: 'pharmacy', label: 'Pharmacies' },
];

function ProviderCard({ provider, onClose }: { provider: Provider; onClose?: () => void }) {
  const Icon = provider.kind === 'doctor' ? Stethoscope : Pill;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.icon}><Icon color={palette.forest} size={18} strokeWidth={1.8} /></View>
        <View style={styles.cardCopy}>
          <Text style={styles.name}>{provider.name}</Text>
          <Text style={styles.body}>{provider.specialty ?? (provider.kind === 'doctor' ? 'Doctor' : 'Pharmacy')}</Text>
        </View>
        {onClose ? <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}><X color={palette.ink} size={18} /></Pressable> : null}
      </View>
      <View style={styles.row}><MapPin color={palette.muted} size={14} /><Text style={styles.body}>{[provider.address, provider.city].filter(Boolean).join(', ')}</Text></View>
      {provider.opening_hours ? <View style={styles.row}><Clock color={palette.muted} size={14} /><Text style={styles.body}>{provider.opening_hours}</Text></View> : null}
      {provider.phone ? (
        <Pressable
          accessibilityLabel={`Call ${provider.name}`}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`tel:${provider.phone!.replace(/[^+\d]/g, '')}`)}
          style={styles.row}>
          <Phone color={palette.forest} size={14} /><Text style={styles.link}>{provider.phone}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function DiscoveryScreen() {
  useScheme();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabaseClient) {
      setError('The directory is not configured yet.');
      setLoading(false);
      return;
    }
    void supabaseClient
      .from('care_providers')
      .select('id,kind,name,specialty,city,address,phone,opening_hours,latitude,longitude')
      .eq('status', 'verified')
      .order('city')
      .order('name')
      .limit(500)
      .then(({ data, error: queryError }) => {
        if (queryError) setError('Could not load the directory. Please try again.');
        else setProviders((data ?? []) as Provider[]);
        setLoading(false);
      });
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return providers.filter((item) =>
      (filter === 'all' || item.kind === filter) &&
      (!term || item.city.toLowerCase().includes(term) || item.name.toLowerCase().includes(term)));
  }, [providers, filter, search]);

  const selected = visible.find((item) => item.id === selectedId) ?? null;

  return (
    <View style={styles.screen}>
      <ProviderMap onSelect={setSelectedId} providers={visible} selectedId={selected?.id ?? null} />

      <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.searchBar}>
          <TextInput
            accessibilityLabel="Search by city or name"
            autoCapitalize="words"
            onChangeText={setSearch}
            placeholder="Search city or name"
            placeholderTextColor={palette.muted}
            style={styles.search}
            value={search}
          />
        </View>
        <View style={styles.filterRow}>
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
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!loading && !error && !visible.length ? <Text style={styles.toast}>No verified listings match.</Text> : null}
      </SafeAreaView>

      {selected && !showList ? (
        <View pointerEvents="box-none" style={styles.bottomCard}>
          <ProviderCard onClose={() => setSelectedId(null)} provider={selected} />
        </View>
      ) : null}

      {showList ? (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.listPanel}>
          <ScrollView contentContainerStyle={styles.listContent}>
            <Text style={styles.listTitle}>{visible.length} listed</Text>
            {visible.map((item) => (
              <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setShowList(false); }}>
                <ProviderCard provider={item} />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowList((value) => !value)}
        style={styles.toggle}>
        {showList ? <MapIcon color={palette.white} size={16} /> : <List color={palette.white} size={16} />}
        <Text style={styles.toggleText}>{showList ? 'Map' : 'List'}</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { backgroundColor: palette.paper, flex: 1 },
  overlay: { left: 0, paddingHorizontal: 14, paddingTop: 8, position: 'absolute', right: 0, top: 0 },
  searchBar: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 12, borderWidth: 1, boxShadow: '0 2px 10px rgba(0,0,0,0.12)' },
  search: { color: palette.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 14 },
  filterRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  chip: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 16, borderWidth: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: 13 },
  chipActive: { backgroundColor: palette.forest, borderColor: palette.forest },
  chipText: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: palette.white },
  error: { backgroundColor: '#FCE9E5', borderRadius: 8, color: '#9A3E2A', fontSize: 12, marginTop: 10, padding: 10 },
  toast: { alignSelf: 'flex-start', backgroundColor: palette.white, borderRadius: 8, color: palette.muted, fontSize: 12, marginTop: 10, overflow: 'hidden', padding: 10 },
  bottomCard: { bottom: 76, left: 14, position: 'absolute', right: 14 },
  listPanel: { backgroundColor: palette.paper, bottom: 0, left: 0, paddingTop: 110, position: 'absolute', right: 0, top: 0 },
  listContent: { gap: 9, padding: 14, paddingBottom: 100 },
  listTitle: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  toggle: { alignItems: 'center', alignSelf: 'center', backgroundColor: palette.forest, borderRadius: 22, bottom: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.25)', flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 20, position: 'absolute' },
  toggleText: { color: palette.white, fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  icon: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  cardCopy: { flex: 1, gap: 2 },
  close: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  name: { color: palette.ink, fontSize: 16, fontWeight: '600' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  body: { color: palette.muted, flexShrink: 1, fontSize: 12, lineHeight: 18 },
  link: { color: palette.forest, fontSize: 12, fontWeight: '700' },
}));
