import { useState } from 'react';
import { Compass, List, Map, MapPin, Search } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Page, PageHeading, PreviewNotice } from '@/ui/patient-ui';
import { palette } from '@/ui/palette';

type ProviderFilter = 'All' | 'Doctors' | 'Pharmacies';

export default function DiscoveryScreen() {
  const [filter, setFilter] = useState<ProviderFilter>('All');
  const [view, setView] = useState<'Map' | 'List'>('Map');
  const [query, setQuery] = useState('');

  return (
    <Page>
      <PreviewNotice />
      <PageHeading eyebrow="CARE NEAR YOU" title="Find your way to care">
        Search across Morocco by city, or use nearby search when you choose to share your location.
      </PageHeading>

      <View style={styles.searchBox}>
        <Search color={palette.muted} size={18} />
        <TextInput
          accessibilityLabel="Search by city or area"
          onChangeText={setQuery}
          placeholder="City, neighborhood, or pharmacy"
          placeholderTextColor="#8A958E"
          style={styles.searchInput}
          value={query}
        />
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filters}>
          {(['All', 'Doctors', 'Pharmacies'] as const).map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item }}
              key={item}
              onPress={() => setFilter(item)}
              style={[styles.filter, filter === item && styles.filterActive]}>
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.mapFrame}>
        <View style={styles.mapTexture} />
        <View style={styles.mapLabel}>
          <MapPin color={palette.forest} size={15} />
          <Text style={styles.mapLabelText}>{query.trim() || 'Morocco'}</Text>
        </View>
        <View style={styles.mapMessage}>
          {view === 'Map' ? <Map color={palette.forest} size={24} strokeWidth={1.7} /> : <List color={palette.forest} size={24} strokeWidth={1.7} />}
          <Text style={styles.mapMessageTitle}>{view === 'Map' ? 'Directory preview' : 'Provider list'}</Text>
          <Text style={styles.mapMessageBody}>Provider listings will appear when map and availability services are connected.</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.sourceNote}>
          <Compass color={palette.forest} size={17} />
          <Text style={styles.sourceText}>Opening hours will show their source and last-updated time.</Text>
        </View>
        <Pressable
          accessibilityLabel={view === 'Map' ? 'Switch to list view' : 'Switch to map view'}
          accessibilityRole="button"
          onPress={() => setView(view === 'Map' ? 'List' : 'Map')}
          style={styles.viewToggle}>
          {view === 'Map' ? <List color={palette.forest} size={18} /> : <Map color={palette.forest} size={18} />}
        </Pressable>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    minHeight: 46,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  filters: {
    backgroundColor: '#E8ECE7',
    borderRadius: 7,
    flexDirection: 'row',
    gap: 3,
    padding: 4,
  },
  filter: {
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterActive: {
    backgroundColor: palette.white,
  },
  filterText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: palette.ink,
  },
  mapFrame: {
    backgroundColor: '#E5ECE5',
    borderColor: '#D4DED4',
    borderRadius: 8,
    borderWidth: 1,
    height: 310,
    marginTop: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  mapTexture: {
    ...StyleSheet.absoluteFill,
    borderColor: '#CED9CF',
    borderRightWidth: 1,
    borderTopWidth: 1,
    opacity: 0.58,
  },
  mapLabel: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 7,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    top: 14,
  },
  mapLabelText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  mapMessage: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    maxWidth: 290,
    padding: 20,
    position: 'absolute',
    top: 95,
  },
  mapMessageTitle: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 20,
    marginTop: 10,
  },
  mapMessageBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  sourceNote: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  sourceText: {
    color: palette.muted,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  viewToggle: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 7,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});