import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { Activity, CircleHelp, Droplets, FlaskConical, Plus, TrendingUp, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import MetricTrendChart, { type ChartPeriod } from '@/features/health/metric-trend-chart';
import { getPatientMetric, listActiveMetricDefinitions, listMeasurementsForCurrentUser, type PublishedMetricContent, type SavedMeasurement } from '@/features/health/measurement-repository';
import { summarizeMeasurements } from '@/features/health/measurement-summary';
import { useLocale } from '@/platform/locale/locale-provider';
import { Page, PageHeading, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import { Loading } from '@/ui/loading';

type MetricCard = { id: string; databaseKey: string; category: string; name: string; detail: string; measurements: SavedMeasurement[]; content: PublishedMetricContent | null };
const fallbackMetrics: MetricCard[] = [
  { id: 'glucose', databaseKey: 'blood_glucose', category: 'metabolic', name: 'Blood glucose', detail: 'Glucose test results', measurements: [], content: null },
  { id: 'inr', databaseKey: 'inr', category: 'cardiovascular', name: 'INR', detail: 'Blood clotting test results', measurements: [], content: null },
  { id: 'blood_pressure', databaseKey: 'blood_pressure', category: 'cardiovascular', name: 'Blood pressure', detail: 'Systolic and diastolic', measurements: [], content: null },
  { id: 'resting_heart_rate', databaseKey: 'resting_heart_rate', category: 'cardiovascular', name: 'Resting heart rate', detail: 'Pulse while resting', measurements: [], content: null },
  { id: 'hba1c', databaseKey: 'hba1c', category: 'metabolic', name: 'HbA1c', detail: 'Longer-term glucose', measurements: [], content: null },
  { id: 'spo2', databaseKey: 'spo2', category: 'respiratory', name: 'Oxygen saturation', detail: 'Pulse oximeter result', measurements: [], content: null },
  { id: 'vitamin_d', databaseKey: 'vitamin_d', category: 'general', name: 'Vitamin D (25-OH)', detail: 'Laboratory result', measurements: [], content: null },
];

export default function HealthScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const { locale } = useLocale();
  const [measurementSummary, setMeasurementSummary] = useState({ count: 0, latestMeasurementDate: null as string | null });
  const [metricCards, setMetricCards] = useState<MetricCard[]>(fallbackMetrics);
  const [explanationMetric, setExplanationMetric] = useState<MetricCard | null>(null);
  const [selectedMetricId, setSelectedMetricId] = useState('glucose');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('1M');
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!session) {
      setMeasurementSummary({ count: 0, latestMeasurementDate: null });
      setMetricCards(fallbackMetrics);
      setLoading(false);
      setHasLoaded(true);
      setLoadError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setLoadError('');

    void Promise.all([listMeasurementsForCurrentUser(), listActiveMetricDefinitions()]).then(async ([measurements, definitions]) => {
      if (!active) return;
      setMeasurementSummary(summarizeMeasurements(measurements));
      const metrics = await Promise.all(definitions.map(async (definition) => {
        const detail = await getPatientMetric(definition.metric_key, locale);
        const id = definition.metric_key === 'blood_glucose' ? 'glucose' : definition.metric_key;
        return {
          id,
          databaseKey: definition.metric_key,
          category: definition.category,
          name: definition.display_names[detail.locale] ?? definition.display_names.en ?? definition.metric_key,
          detail: definition.supported_units.join(' · '),
          measurements: detail.measurements,
          content: detail.content,
        };
      }));
      if (active) {
        setMetricCards(metrics);
        setHasLoaded(true);
      }
    }).catch(() => {
      if (active) setLoadError('Could not refresh your health record. Check your connection and try again.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [session, locale, retryKey]));

  const selectedMetric = metricCards.find((metric) => metric.id === selectedMetricId) ?? metricCards[0];
  const selectedValues = selectedMetric?.measurements.filter((measurement) => chartPeriod === 'ALL' || new Date(measurement.measured_at).getTime() >= Date.now() - periodMilliseconds[chartPeriod]) ?? [];
  const numericValues = selectedValues.filter((measurement) => measurement.numeric_value !== null);
  const firstValue = numericValues[numericValues.length - 1]?.numeric_value;
  const lastValue = numericValues[0]?.numeric_value;
  const change = firstValue !== null && firstValue !== undefined && lastValue !== null && lastValue !== undefined ? lastValue - firstValue : null;
  const rangeLabels = selectedMetric?.content?.reference_ranges?.flatMap((range) => {
    if (range === null || typeof range !== 'object' || Array.isArray(range)) return [];
    const row = range as Record<string, unknown>;
    if (typeof row.category !== 'string') return [];
    const bounds = selectedMetric?.databaseKey === 'blood_pressure'
      ? ['systolic', 'diastolic'].flatMap((axis) => {
        const minimum = row[`${axis}_min`];
        const maximum = row[`${axis}_max`];
        if (typeof minimum !== 'number' && typeof maximum !== 'number') return [];
        return [`${axis === 'systolic' ? 'SYS' : 'DIA'} ${typeof minimum === 'number' ? minimum : '—'}–${typeof maximum === 'number' ? maximum : '—'}`];
      })
      : Object.entries(row).filter(([key, value]) => /^(minimum|maximum)/.test(key) && typeof value === 'number').map(([key, value]) => `${key.startsWith('minimum') ? 'Min' : 'Max'} ${value}`);
    return bounds.length ? [{ category: row.category, bounds: bounds.join(' · ') }] : [];
  }) ?? [];

  return (
    <Page>
      <PreviewNotice />
      <PageHeading eyebrow="Your record" title="Health tracking">
        {session
          ? 'Your measurements are saved to your account. Share access with a clinician only when you choose.'
          : 'Record test results in your health timeline. Sign in or create an account to save them securely.'}
      </PageHeading>

      {loadError ? (
        <View accessibilityRole="alert" style={styles.errorNotice}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable accessibilityRole="button" onPress={() => setRetryKey((key) => key + 1)} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {session && loading ? (
        <Loading label="Loading your saved measurements" inline />
      ) : null}

      {!session || hasLoaded ? <>
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryNumber}>{measurementSummary.count}</Text>
          <Text style={styles.summaryLabel}>{measurementSummary.count === 1 ? 'result recorded' : 'results recorded'}</Text>
        </View>
        <View style={styles.summaryRule} />
        <Text style={styles.summaryCopy}>
          {measurementSummary.latestMeasurementDate
            ? `Latest result: ${new Date(measurementSummary.latestMeasurementDate).toLocaleDateString()}`
            : 'Your timeline will grow as you add test results.'}
        </Text>
      </View>

      <View style={styles.overviewChart}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}><View style={styles.chartIcon}><TrendingUp color={palette.forest} size={17} /></View><Text style={styles.overviewChartTitle}>Trend overview</Text></View>
          {selectedMetric?.measurements.length ? <Text style={styles.chartCount}>{selectedMetric.measurements.length} readings</Text> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricChips}>
          {metricCards.map((metric) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedMetric?.id === metric.id }} key={metric.id} onPress={() => setSelectedMetricId(metric.id)} style={[styles.metricChip, selectedMetric?.id === metric.id && styles.metricChipActive]}>
              <Text style={[styles.metricChipText, selectedMetric?.id === metric.id && styles.metricChipTextActive]}>{metric.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.periodRow}>
          {chartPeriods.map((period) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: chartPeriod === period }} key={period} onPress={() => setChartPeriod(period)} style={[styles.periodChip, chartPeriod === period && styles.periodChipActive]}>
              <Text style={[styles.periodText, chartPeriod === period && styles.periodTextActive]}>{period}</Text>
            </Pressable>
          ))}
        </View>
        {selectedMetric?.measurements.length && selectedValues.length ? (
          <>
            <View style={styles.chartStats}>
              <View><Text style={styles.statLabel}>Latest in range</Text><Text style={styles.statValue}>{formatMeasurement(selectedValues[0])}</Text></View>
              <View style={styles.statDivider} />
              <View><Text style={styles.statLabel}>Change</Text><Text style={styles.statValue}>{change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}`}</Text></View>
              <View style={styles.statDivider} />
              <View><Text style={styles.statLabel}>Period</Text><Text style={styles.statValue}>{chartPeriod}</Text></View>
            </View>
            <MetricTrendChart large measurements={selectedMetric.measurements} metricKey={selectedMetric.databaseKey} period={chartPeriod} referenceRanges={selectedMetric.content?.reference_ranges} />
            {rangeLabels.length ? <View style={styles.rangeGuide}>
              <Text style={styles.rangeTitle}>Published reference ranges</Text>
              <View style={styles.rangeRows}>{rangeLabels.slice(0, 3).map((range) => <View key={range.category} style={styles.rangeRow}><View style={styles.rangeDot} /><Text numberOfLines={1} style={styles.rangeCategory}>{range.category}</Text><Text style={styles.rangeBounds}>{range.bounds}</Text></View>)}</View>
              <Text style={styles.rangeFootnote}>Ranges are contextual references, not personal targets or a diagnosis.</Text>
            </View> : null}
          </>
        ) : <View style={styles.chartEmptyState}><TrendingUp color={palette.muted} size={22} /><Text style={styles.chartEmptyTitle}>{selectedMetric?.measurements.length ? `No readings in the ${chartPeriod} window` : 'Your chart is ready for your first result'}</Text><Text style={styles.chartEmptyBody}>{selectedMetric?.measurements.length ? 'Choose a wider time window to see earlier measurements.' : 'Choose a metric above, then add a measurement to see its trend over time.'}</Text></View>}
      </View>

      <SectionHeading title="Your measurements" detail={measurementSummary.count ? 'Latest readings and trends' : 'Start a private timeline'} />
      <View style={styles.metricList}>
        {metricCards.map((metric) => {
          const Icon = metric.category === 'metabolic' ? Droplets : metric.category === 'cardiovascular' ? Activity : FlaskConical;
          const latest = metric.measurements[0];
          const latestValue = latest?.component_values
            ? `${latest.component_values.systolic ?? '—'} / ${latest.component_values.diastolic ?? '—'}`
            : latest?.numeric_value ?? '—';
          const categoryLabel = metric.category.replaceAll('_', ' ');
          return <View key={metric.id} style={[uiStyles.card, styles.metricCard]}>
            <Pressable accessibilityLabel={`View ${metric.name} details`} accessibilityRole="button" onPress={() => router.push(`/metrics/${metric.id}` as Href)} style={styles.metricMain}>
              <View style={uiStyles.iconTile}><Icon color={palette.forest} size={19} strokeWidth={1.8} /></View>
              <View style={styles.metricCopy}><Text style={styles.categoryLabel}>{categoryLabel}</Text><Text style={styles.metricName}>{metric.name}</Text><Text style={styles.metricDetail}>{latest ? `Latest · ${new Date(latest.measured_at).toLocaleDateString()}` : metric.detail}</Text></View>
              <View style={styles.latestReading}><Text style={[styles.latestValue, latest?.component_values ? styles.compositeValue : null]}>{latestValue}</Text>{latest?.unit || latest?.component_values ? <Text style={styles.latestUnit}>{latest?.unit ?? 'mm Hg'}</Text> : null}</View>
            </Pressable>
            <Pressable accessibilityLabel={`Read about ${metric.name}`} accessibilityRole="button" onPress={() => setExplanationMetric(metric)} style={[styles.iconAction, styles.helpAction]}><CircleHelp color={palette.forest} size={18} /></Pressable>
            <Pressable accessibilityLabel={`Add ${metric.name} measurement`} accessibilityRole="button" onPress={() => router.push({ pathname: '/measurement/[metricId]', params: { metricId: metric.id } })} style={[styles.iconAction, styles.addAction]}><Plus color={palette.forest} size={19} /></Pressable>
            <Pressable accessibilityLabel={`Open ${metric.name} history and chart`} accessibilityRole="button" onPress={() => router.push(`/metrics/${metric.id}` as Href)} style={styles.chartPressable}>
              {metric.measurements.length ? <MetricTrendChart measurements={metric.measurements} /> : <Text style={styles.chartEmpty}>Your chart will appear after your first result.</Text>}
            </Pressable>
          </View>;
        })}
      </View>

      <View style={styles.infoBlock}>
        <View style={styles.infoIcon}><Activity color={palette.white} size={18} strokeWidth={2} /></View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>Your result is not a diagnosis</Text>
          <Text style={styles.infoDescription}>Personal targets and result interpretation appear only after verified-clinician review. Contact your care team for medical decisions.</Text>
        </View>
      </View>

      <Modal animationType="fade" onRequestClose={() => setExplanationMetric(null)} transparent visible={explanationMetric !== null}>
        <View style={styles.modalBackdrop}><View style={styles.explanationModal}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{explanationMetric?.content?.content.title ?? explanationMetric?.name}</Text><Pressable accessibilityLabel="Close explanation" onPress={() => setExplanationMetric(null)} style={styles.closeButton}><X color={palette.ink} size={19} /></Pressable></View>
          <Text style={styles.modalBody}>{explanationMetric?.content?.content.short_explanation ?? 'A clinician-reviewed explanation is not available yet. Your result history will appear on the metric detail page.'}</Text>
          {explanationMetric?.content?.content.safety_note ? <Text style={styles.modalSafety}>{explanationMetric.content.content.safety_note}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => { const metric = explanationMetric; setExplanationMetric(null); if (metric) router.push(`/metrics/${metric.id}` as Href); }} style={styles.modalLink}><Text style={styles.modalLinkText}>View metric details</Text></Pressable>
        </View></View>
      </Modal>
      </> : null}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  overviewChart: { backgroundColor: palette.white, borderColor: palette.line, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, marginBottom: 8, padding: 16 },
  chartHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  chartTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  chartIcon: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },
  overviewChartTitle: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  chartCount: { color: palette.muted, fontSize: 11 },
  metricChips: { gap: 7, paddingVertical: 14 },
  metricChip: { backgroundColor: palette.paper, borderRadius: 9, justifyContent: 'center', minHeight: 34, paddingHorizontal: 12 },
  metricChipActive: { backgroundColor: palette.forest },
  metricChipText: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  metricChipTextActive: { color: palette.white },
  periodRow: { alignSelf: 'stretch', backgroundColor: palette.paper, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, padding: 3 },
  periodChip: { alignItems: 'center', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 34 },
  periodChipActive: { backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1 },
  periodText: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  periodTextActive: { color: palette.forest },
  chartStats: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  statLabel: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  statValue: { color: palette.ink, fontSize: 14, fontWeight: '700', marginTop: 4 },
  statDivider: { backgroundColor: palette.line, height: 28, width: 1 },
  rangeGuide: { backgroundColor: palette.paper, borderRadius: 11, marginTop: 12, padding: 12 },
  rangeTitle: { color: palette.ink, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  rangeRows: { gap: 7 },
  rangeRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  rangeDot: { backgroundColor: palette.leafDeep, borderRadius: 4, height: 8, width: 8 },
  rangeCategory: { color: palette.muted, flex: 1, fontSize: 10, textTransform: 'capitalize' },
  rangeBounds: { color: palette.ink, fontSize: 10, fontWeight: '600' },
  rangeFootnote: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: 8 },
  chartEmptyState: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 27 },
  chartEmptyTitle: { color: palette.ink, fontSize: 13, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  chartEmptyBody: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 5, textAlign: 'center' },
  summary: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderCurve: 'continuous',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 17,
    marginBottom: 28,
    padding: 20,
  },
  summaryNumber: {
    color: palette.ink,
    fontSize: 34,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  summaryRule: {
    backgroundColor: palette.line,
    height: 42,
    width: 1,
  },
  summaryCopy: {
    color: palette.muted,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  metricList: { gap: 0 },
  metricCard: {
    backgroundColor: 'transparent',
    borderBottomColor: palette.line,
    borderColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 0,
    paddingVertical: 14,
  },
  metricMain: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48 },
  metricCopy: {
    flex: 1,
  },
  metricName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  categoryLabel: { color: palette.muted, fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
  metricDetail: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 4,
  },
  latestReading: { alignItems: 'flex-end', marginRight: 3 },
  latestValue: { color: palette.ink, fontSize: 21, fontWeight: '700' },
  compositeValue: { fontSize: 16 },
  latestUnit: { color: palette.muted, fontSize: 9 },
  iconAction: { alignItems: 'center', backgroundColor: palette.paper, borderRadius: 16, height: 34, justifyContent: 'center', position: 'absolute', top: 18, width: 34, zIndex: 1 },
  helpAction: { right: 42 },
  addAction: { right: 2 },
  chartPressable: { marginLeft: 56, marginTop: 10, minHeight: 32 },
  chartEmpty: { color: palette.muted, fontSize: 11, paddingVertical: 8 },
  infoBlock: {
    alignItems: 'center',
    backgroundColor: '#E7EEE6',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    padding: 15,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: palette.forest,
    borderRadius: 6,
    height: 33,
    justifyContent: 'center',
    width: 33,
  },
  infoCopy: {
    flex: 1,
  },
  infoTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  infoDescription: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(12, 32, 23, .46)', flex: 1, justifyContent: 'center', padding: 20 },
  explanationModal: { backgroundColor: palette.white, borderRadius: 20, maxWidth: 460, padding: 20, width: '100%' },
  modalHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  modalTitle: { color: palette.ink, flex: 1, fontSize: 22, fontWeight: '700', lineHeight: 28 },
  closeButton: { alignItems: 'center', backgroundColor: palette.paper, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  modalBody: { color: palette.ink, fontSize: 13, lineHeight: 20, marginTop: 12 },
  modalSafety: { backgroundColor: palette.dangerBg, borderRadius: 6, color: palette.dangerText, fontSize: 11, lineHeight: 17, marginTop: 13, padding: 11 },
  modalLink: { alignSelf: 'flex-start', backgroundColor: palette.forest, borderRadius: 10, marginTop: 16, minHeight: 42, justifyContent: 'center', paddingHorizontal: 15 },
  modalLinkText: { color: palette.white, fontSize: 12, fontWeight: '700' },
  errorNotice: { backgroundColor: palette.dangerBg, borderCurve: 'continuous', borderRadius: 12, gap: 6, marginBottom: 12, padding: 14 },
  errorText: { color: palette.dangerText, fontSize: 13, lineHeight: 19 },
  retryButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  retryText: { color: palette.forest, fontSize: 14, fontWeight: '700' },
  loadingNotice: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 64, paddingHorizontal: 16 },
  loadingText: { color: palette.muted, fontSize: 14 },
}));

const chartPeriods: ChartPeriod[] = ['1W', '1M', '3M', '1Y', 'ALL'];
const periodMilliseconds: Record<Exclude<ChartPeriod, 'ALL'>, number> = { '1W': 7 * 86400000, '1M': 30 * 86400000, '3M': 90 * 86400000, '1Y': 365 * 86400000 };

function formatMeasurement(measurement: SavedMeasurement) {
  const value = measurement.component_values
    ? `${measurement.component_values.systolic ?? '—'} / ${measurement.component_values.diastolic ?? '—'}`
    : measurement.numeric_value ?? '—';
  return `${value}${measurement.unit ? ` ${measurement.unit}` : measurement.component_values ? ' mm Hg' : ''}`;
}