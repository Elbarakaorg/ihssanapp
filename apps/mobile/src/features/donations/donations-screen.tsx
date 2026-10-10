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

import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
const PAGE = 12;
const SORTS: [CaseSort, 'give.newest' | 'give.urgentSort' | 'give.nearlyFunded' | 'give.needsHelp' | 'give.mostRaised'][] = [['newest', 'give.newest'], ['urgent', 'give.urgentSort'], ['nearly_funded', 'give.nearlyFunded'], ['least_funded', 'give.needsHelp'], ['most_funded', 'give.mostRaised']];
const STATUS_KEYS = { active: 'give.open', funded: 'give.funded', all: 'give.allCases' } as const;
const STEP_KEYS = ['give.step1', 'give.step2', 'give.step3', 'give.step4'] as const;
export default function DonationsScreen() {
  useScheme();
  const router = useRouter();
  const { locale } = useLocale();
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
    <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Pressable accessibilityLabel={donationCopy(locale, 'give.history')} accessibilityRole="button" hitSlop={8} onPress={() => router.push('/my-donations' as Href)} style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}>
        <History color={palette.forest} size={20} />
        {hasOrders ? <View style={styles.historyDot} /> : null}
      </Pressable>
      <PageHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} eyebrow={donationCopy(locale, 'give.eyebrow')} title={donationCopy(locale, 'give.title')}>
        {donationCopy(locale, 'give.intro')}
      </PageHeading>

      {collects > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/collect' as Href)} style={({ pressed }) => [uiStyles.card, styles.collect, pressed && styles.pressed]}>
          <ShieldCheck color={palette.forest} size={20} />
          <View style={styles.flex}><Text style={styles.collectTitle}>{donationCopy(locale, 'give.collector')}</Text><Text style={styles.muted}>{donationCopy(locale, 'give.collectorNote')}</Text></View>
        </Pressable>
      ) : null}

      <SearchBar value={filters.search} onChange={(search) => set({ search })} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.categoryRow}>
        <Chip label={donationCopy(locale, 'give.all')} selected={filters.category === ''} onPress={() => set({ category: '' })} />
        {categories.map((category) => <Chip key={category.slug} label={category[`label_${locale}`]} selected={filters.category === category.slug} onPress={() => set({ category: filters.category === category.slug ? '' : category.slug })} />)}
      </ScrollView>

      <View style={styles.filterRow}>
        <Dropdown
          label={donationCopy(locale, 'give.city')}
          display={filters.city || donationCopy(locale, 'give.city')}
          active={filters.city !== ''}
          groups={[{ options: [{ value: '', label: donationCopy(locale, 'give.everywhere') }, ...cities.map((city) => ({ value: city.city, label: `${city.city} (${city.total})` }))], value: filters.city, onSelect: (city) => set({ city }) }]}
        />
        <Dropdown
          label={donationCopy(locale, 'give.showSort')}
          display={filters.status === 'active' && filters.sort === 'newest' ? donationCopy(locale, 'give.show') : donationCopy(locale, STATUS_KEYS[filters.status])}
          active={filters.status !== 'active' || filters.sort !== 'newest'}
          groups={[
            { title: donationCopy(locale, 'give.show'), options: Object.entries(STATUS_KEYS).map(([value, key]) => ({ value, label: donationCopy(locale, key) })), value: filters.status, onSelect: (status) => set({ status: status as CaseFilters['status'] }) },
            { title: donationCopy(locale, 'give.sortBy'), options: SORTS.map(([value, key]) => ({ value, label: donationCopy(locale, key) })), value: filters.sort, onSelect: (sort) => set({ sort: sort as CaseSort }) },
          ]}
        />
        <ToggleChip label={donationCopy(locale, 'give.urgent')} selected={filters.urgent} onPress={() => set({ urgent: !filters.urgent })} />
      </View>
      {filtered ? <Pressable accessibilityRole="button" onPress={() => { setCases(null); setFilters(defaultFilters); }}><Text style={styles.reset}>{donationCopy(locale, 'give.clearFilters')}</Text></Pressable> : null}

      {error ? <Message kind="error">{error}</Message> : null}
      {cases === null ? <Loading inline label={donationCopy(locale, 'give.finding')} state="searching" /> : null}
      {cases?.length === 0 && !error ? (
        <View style={styles.empty}>
          <HandHeart color={palette.forest} size={28} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>{donationCopy(locale, filtered ? 'give.noMatch' : 'give.noCases')}</Text>
          <Text style={styles.muted}>{donationCopy(locale, filtered ? 'give.tryFilter' : 'give.noCasesNote')}</Text>
        </View>
      ) : null}
      {cases?.map((item) => <CaseCard categories={categories} key={item.id} item={item} onPress={() => router.push(`/cases/${item.id}` as Href)} />)}
      {more ? (
        <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void loadMore()} style={styles.moreButton}>
          <Text style={styles.moreLabel}>{donationCopy(locale, loadingMore ? 'give.loadingMore' : 'give.loadMore')}</Text>
        </Pressable>
      ) : null}

      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'give.how')} />
      <View style={[uiStyles.card, styles.how]}>
        {STEP_KEYS.map((key, index) => (
          <View key={key} style={styles.step}><Text style={styles.stepNo}>{index + 1}</Text><Text style={[styles.muted, styles.flex]}>{donationCopy(locale, key)}</Text></View>
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
