import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { HandHeart, History, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip, Message } from '@/features/doctor/ui';
import { useAuth } from '@/features/auth/auth-provider';
import { Loading } from '@/ui/loading';
import { Page, PageHeading, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import {
  type CaseFilters, type CaseSort, type CaseSummary, type Category, defaultFilters, listCases, listCategories, listCities, listCollectorCases, listStoredPledges,
} from './donations-api';
import { formatMad } from './donations-logic';
import { CaseCard } from './donations-ui';
import { Dropdown, SearchBar, ToggleChip } from './filter-ui';

const PAGE = 12;
const SORTS: [CaseSort, string][] = [['newest', 'Newest'], ['urgent', 'Most urgent'], ['nearly_funded', 'Nearly funded'], ['least_funded', 'Needs most help'], ['most_funded', 'Most raised']];
const STATUS_LABEL: Record<string, string> = { active: 'Open for donations', funded: 'Fully funded', all: 'All cases' };
const STEPS = ['Choose a verified case and start a donation order.', 'Send your transfer to the family’s bank account within 48 hours.', 'Come back and upload your receipt.', 'A fund collector confirms it, and the progress bar moves.'];

export default function DonationsScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const [filters, setFilters] = useState<CaseFilters>(defaultFilters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<{ city: string; total: number }[]>([]);
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasOrders, setHasOrders] = useState(false);
  const [collects, setCollects] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    void listCategories().then(setCategories).catch(() => undefined);
    void listCities().then(setCities).catch(() => undefined);
  }, []);

  useFocusEffect(useCallback(() => {
    void listStoredPledges().then((items) => setHasOrders(items.length > 0));
    if (session) void listCollectorCases().then((rows) => setCollects(rows.length)).catch(() => setCollects(0));
    else setCollects(0);
  }, [session]));

  useEffect(() => {
    const id = ++request.current;
    setError('');
    const timer = setTimeout(() => {
      listCases(filters, 0, PAGE + 1)
        .then((rows) => { if (id === request.current) { setCases(rows.slice(0, PAGE)); setMore(rows.length > PAGE); } })
        .catch((e) => { if (id === request.current) { setError(e instanceof Error ? e.message : 'Could not load cases.'); setCases([]); } });
    }, filters.search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [filters]);

  const loadMore = async () => {
    if (!cases) return;
    setLoadingMore(true);
    try {
      const rows = await listCases(filters, cases.length, PAGE + 1);
      setCases([...cases, ...rows.slice(0, PAGE)]);
      setMore(rows.length > PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more cases.');
    } finally {
      setLoadingMore(false);
    }
  };

  const set = (patch: Partial<CaseFilters>) => { setCases(null); setFilters((current) => ({ ...current, ...patch })); };
  const filtered = filters.category !== '' || filters.city !== '' || filters.urgent || filters.search !== '' || filters.status !== 'active';

  return (
    <Page>
      <Pressable accessibilityLabel="My donation history" accessibilityRole="button" hitSlop={8} onPress={() => router.push('/my-donations' as Href)} style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}>
        <History color={palette.forest} size={20} />
        {hasOrders ? <View style={styles.historyDot} /> : null}
      </Pressable>
      <PageHeading eyebrow="Ihssan Giving" title="Give with purpose">
        Every case is reviewed. Gifts go straight to the family&apos;s own bank account.
      </PageHeading>

      {collects > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/collect' as Href)} style={({ pressed }) => [uiStyles.card, styles.collect, pressed && styles.pressed]}>
          <ShieldCheck color={palette.forest} size={20} />
          <View style={styles.flex}><Text style={styles.collectTitle}>Fund collector dashboard</Text><Text style={styles.muted}>Review receipts and confirm donations.</Text></View>
        </Pressable>
      ) : null}

      <SearchBar value={filters.search} onChange={(search) => set({ search })} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.categoryRow}>
        <Chip label="All" selected={filters.category === ''} onPress={() => set({ category: '' })} />
        {categories.map((c) => <Chip key={c.slug} label={c.label_en} selected={filters.category === c.slug} onPress={() => set({ category: filters.category === c.slug ? '' : c.slug })} />)}
      </ScrollView>

      <View style={styles.filterRow}>
        <Dropdown
          label="City"
          display={filters.city || 'City'}
          active={filters.city !== ''}
          groups={[{ options: [{ value: '', label: 'Everywhere' }, ...cities.map((c) => ({ value: c.city, label: `${c.city} (${c.total})` }))], value: filters.city, onSelect: (city) => set({ city }) }]}
        />
        <Dropdown
          label="Show & sort"
          display={filters.status === 'active' && filters.sort === 'newest' ? 'Show' : STATUS_LABEL[filters.status]}
          active={filters.status !== 'active' || filters.sort !== 'newest'}
          groups={[
            { title: 'Show', options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })), value: filters.status, onSelect: (status) => set({ status: status as CaseFilters['status'] }) },
            { title: 'Sort by', options: SORTS.map(([value, label]) => ({ value, label })), value: filters.sort, onSelect: (sort) => set({ sort: sort as CaseSort }) },
          ]}
        />
        <ToggleChip label="Urgent" selected={filters.urgent} onPress={() => set({ urgent: !filters.urgent })} />
      </View>
      {filtered ? <Pressable accessibilityRole="button" onPress={() => { setCases(null); setFilters(defaultFilters); }}><Text style={styles.reset}>Clear filters</Text></Pressable> : null}

      {error ? <Message kind="error">{error}</Message> : null}
      {cases === null ? <Loading inline label="Finding cases" state="searching" /> : null}
      {cases?.length === 0 && !error ? (
        <View style={styles.empty}>
          <HandHeart color={palette.forest} size={28} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>{filtered ? 'No cases match these filters' : 'Verified cases will appear here'}</Text>
          <Text style={styles.muted}>{filtered ? 'Try another category or city.' : 'There are no published cases yet. Please check back soon.'}</Text>
        </View>
      ) : null}
      {cases?.map((item) => <CaseCard key={item.id} item={item} onPress={() => router.push(`/cases/${item.id}` as Href)} />)}
      {more ? (
        <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void loadMore()} style={styles.moreButton}>
          <Text style={styles.moreLabel}>{loadingMore ? 'Loading…' : 'Show more cases'}</Text>
        </Pressable>
      ) : null}

      <SectionHeading title="How giving works" />
      <View style={[uiStyles.card, styles.how]}>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.step}><Text style={styles.stepNo}>{index + 1}</Text><Text style={[styles.muted, styles.flex]}>{step}</Text></View>
        ))}
      </View>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.88 },
  collect: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 14, padding: 14 },
  collectTitle: { ...display, color: palette.ink, fontSize: 16 },
  historyButton: { alignItems: 'center', alignSelf: 'flex-end', backgroundColor: palette.glass, borderColor: palette.line, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  historyDot: { backgroundColor: palette.forest, borderRadius: 4, height: 8, position: 'absolute', right: 10, top: 10, width: 8 },
  filterLabel: { color: palette.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, marginBottom: 6, marginTop: 14 },
  categoryRow: { marginTop: 12 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chips: { gap: 8, paddingRight: 16 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  urgentRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  urgentLabel: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  reset: { color: palette.forest, fontSize: 13, fontWeight: '700', marginTop: 12, minHeight: 32 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyTitle: { ...display, color: palette.ink, fontSize: 18, textAlign: 'center' },
  moreButton: { alignItems: 'center', borderColor: palette.line, borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: 16, minHeight: 46 },
  moreLabel: { color: palette.forest, fontSize: 14, fontWeight: '700' },
  how: { gap: 12, padding: 16 },
  step: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  stepNo: { ...display, backgroundColor: palette.leaf, borderRadius: 12, color: palette.forest, fontSize: 14, height: 24, lineHeight: 24, overflow: 'hidden', textAlign: 'center', width: 24 },
}));
