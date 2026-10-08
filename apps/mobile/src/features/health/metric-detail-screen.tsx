import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { ArrowLeft, CircleHelp, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import MetricTrendChart, { type ChartPeriod } from '@/features/health/metric-trend-chart';
import { interpretPublishedRange } from '@/features/health/metric-interpretation';
import { getPatientMetric, type SavedMeasurement } from '@/features/health/measurement-repository';
import { useLocale } from '@/platform/locale/locale-provider';
import { Page, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme, glassSurface } from '@/ui/palette';
import { Loading } from '@/ui/loading';

type DetailData = Awaited<ReturnType<typeof getPatientMetric>>;

export default function MetricDetailScreen() {
  useScheme();
  const { metricId = '' } = useLocalSearchParams<{ metricId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { locale } = useLocale();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [period, setPeriod] = useState<ChartPeriod>('3M');

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!session) {
      setData(null);
      setLoading(false);
      setError('');
      return () => { active = false; };
    }

    setLoading(true);
    setError('');
    void getPatientMetric(metricId, locale).then((result) => {
      if (active) setData(result);
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load this metric.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [locale, metricId, retryKey, session]));

  const title = data?.definition.display_names[data.locale] ?? data?.definition.display_names.en ?? (metricId === 'glucose' ? 'Blood glucose' : 'INR');
  const measurements = data?.measurements ?? [];
  const latest = measurements[0];
  const content = data?.content?.content;
  const latestValue = latest?.component_values
    ? `${latest.component_values.systolic ?? '—'} / ${latest.component_values.diastolic ?? '—'}`
    : latest?.numeric_value ?? 'No result';
  const latestInterpretation = data?.content
    ? interpretPublishedRange(data.definition.metric_key, latest, data.content.reference_ranges, data.contentLocale)
    : null;

  return (
    <Page>
      <Stack.Screen options={{ title }} />
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft color={palette.ink} size={19} /><Text style={styles.backLabel}>Health metrics</Text>
      </Pressable>
      <PreviewNotice />

      <View style={styles.headingRow}>
        <View style={styles.headingCopy}><Text style={styles.eyebrow}>Health measurement</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>Your reported values over time</Text></View>
        <Pressable accessibilityLabel="Add a measurement" accessibilityRole="button" onPress={() => router.push({ pathname: '/measurement/[metricId]', params: { metricId } })} style={styles.addButton}>
          <Plus color={palette.white} size={20} /><Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>

      {!session ? <View style={styles.messageCard}><Text style={styles.sectionTitle}>Sign in to view your history</Text><Text style={styles.body}>Your measurements and clinician-approved explanations are available in your private account.</Text><Pressable onPress={() => router.push('/auth')} style={styles.secondaryButton}><Text style={styles.secondaryLabel}>Sign in</Text></Pressable></View> : null}
      {loading ? <Loading label="Loading your measurements" /> : null}
      {error ? (
        <View accessibilityRole="alert" style={styles.errorState}>
          <Text style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => setRetryKey((key) => key + 1)} style={styles.retryButton}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {session && !loading && data ? <>
        <View style={[uiStyles.card, styles.chartCard]}>
          <View style={styles.latestRow}>
            <View><Text style={styles.metricCaption}>Latest result</Text><Text style={[styles.latestValue, latest?.component_values ? styles.compositeValue : null]}>{latestValue}{latest?.unit || latest?.component_values ? <Text style={styles.latestUnit}> {latest?.unit ?? 'mm Hg'}</Text> : null}</Text></View>
            {latest ? <Text style={styles.latestDate}>{new Date(latest.measured_at).toLocaleDateString()}</Text> : null}
          </View>
          {latestInterpretation ? <View style={styles.interpretation}><Text style={styles.interpretationLabel}>Reference context</Text><Text style={styles.interpretationText}>{latestInterpretation}</Text></View> : null}
          {measurements.length ? <><View style={styles.periods}>{(['1W', '1M', '3M', '1Y', 'ALL'] as ChartPeriod[]).map((option) => <Pressable accessibilityRole="button" accessibilityState={{ selected: period === option }} key={option} onPress={() => setPeriod(option)} style={[styles.period, period === option && styles.periodSelected]}><Text style={[styles.periodText, period === option && styles.periodTextSelected]}>{option === 'ALL' ? 'All' : option}</Text></Pressable>)}</View><MetricTrendChart large measurements={measurements} period={period} unit={latest?.unit} metricKey={data.definition.metric_key} referenceRanges={data.content?.reference_ranges} /></> : <View style={styles.emptyChart}><Text style={styles.body}>Your trend chart will appear after your first entry.</Text></View>}
          <Text style={styles.chartCaption}>{measurements.length > 1 ? `${measurements.length} recent results` : measurements.length === 1 ? '1 result recorded' : 'No results recorded'}</Text>
        </View>

        <SectionHeading title="Understanding this result" detail={data.content ? `Reviewed content · ${data.content.locale.toUpperCase()}` : 'Awaiting clinical review'} />
        {content ? <View style={[uiStyles.card, styles.explanationCard]}>
          {content.short_explanation ? <Text style={styles.lead}>{content.short_explanation}</Text> : null}
          {content.detailed_explanation ? <Text style={styles.body}>{content.detailed_explanation}</Text> : null}
          {content.how_to_read ? <><Text style={styles.sectionTitle}>How to read it</Text><Text style={styles.body}>{content.how_to_read}</Text></> : null}
          {content.entry_guidance ? <><Text style={styles.sectionTitle}>Recording a result</Text><Text style={styles.body}>{content.entry_guidance}</Text></> : null}
          {content.safety_note ? <View style={styles.safetyBox}><CircleHelp color={palette.coral} size={18} /><Text style={styles.safetyText}>{content.safety_note}</Text></View> : null}
        </View> : <View style={styles.reviewPending}><CircleHelp color={palette.forest} size={19} /><Text style={styles.body}>An explanation is being prepared and will appear after review by a verified clinician. This screen does not classify results or provide a treatment target.</Text></View>}

        <SectionHeading title="Measurement history" detail="Most recent first" />
        {measurements.length ? <View style={styles.historyList}>{measurements.map((measurement: SavedMeasurement) => {
          const value = measurement.component_values
            ? `${measurement.component_values.systolic ?? '—'} / ${measurement.component_values.diastolic ?? '—'}`
            : measurement.numeric_value ?? '—';
          const glucoseContext = measurement.context?.timing && measurement.context.timing !== 'unspecified'
            ? ` · ${measurement.context.timing.replaceAll('_', ' ')}`
            : '';
          return <View key={measurement.id} style={[uiStyles.card, styles.historyRow]}><View><Text style={styles.historyDate}>{new Date(measurement.measured_at).toLocaleDateString()}</Text><Text style={styles.historySource}>{measurement.source_label ?? (measurement.source_kind === 'patient_entry' ? 'Entered by you' : 'Imported result')}{glucoseContext}</Text></View><Text style={[styles.historyValue, measurement.component_values ? styles.compositeValue : null]}>{value}<Text style={styles.historyUnit}>{measurement.unit ? ` ${measurement.unit}` : measurement.component_values ? ' mm Hg' : ''}</Text></Text></View>;
        })}</View> : <View style={styles.emptyHistory}><Text style={styles.body}>No measurements recorded yet.</Text></View>}

        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/measurement/[metricId]', params: { metricId } })} style={styles.bottomAdd}><Plus color={palette.white} size={18} /><Text style={styles.addLabel}>Add a measurement</Text></Pressable>
        <View style={styles.relatedReading}><Text style={styles.relatedTitle}>Related articles</Text><Text style={styles.body}>Clinician-reviewed articles will appear here when they are linked to this metric.</Text></View>
      </> : null}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 17, minHeight: 36 },
  backLabel: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginBottom: 21 },
  headingCopy: { flex: 1 },
  eyebrow: { color: palette.muted, fontSize: 11, fontWeight: '500', marginBottom: 6 },
  title: { ...display, color: palette.ink, fontSize: 30, lineHeight: 37 },
  subtitle: { color: palette.muted, fontSize: 13, marginTop: 4 },
  addButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 7, flexDirection: 'row', gap: 5, minHeight: 42, paddingHorizontal: 12 },
  addLabel: { color: palette.white, fontSize: 12, fontWeight: '700' },
  chartCard: { padding: 16 },
  latestRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
  metricCaption: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  latestValue: { color: palette.ink, fontSize: 28, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 3 },
  compositeValue: { fontSize: 22 },
  latestUnit: { color: palette.forest, fontFamily: 'System', fontSize: 13 },
  latestDate: { color: palette.muted, fontSize: 11 },
  interpretation: { backgroundColor: palette.successBg, borderLeftColor: palette.forest, borderLeftWidth: 3, borderRadius: 4, marginBottom: 13, padding: 11 },
  interpretationLabel: { color: palette.forest, fontSize: 12, fontWeight: '600' },
  interpretationText: { color: palette.ink, fontSize: 11, lineHeight: 17, marginTop: 4 },
  periods: { backgroundColor: palette.sky, borderCurve: 'continuous', borderRadius: 10, flexDirection: 'row', marginBottom: 14, padding: 2 },
  period: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 36 },
  periodSelected: { backgroundColor: palette.white },
  periodText: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  periodTextSelected: { color: palette.ink },
  emptyChart: { alignItems: 'center', justifyContent: 'center', minHeight: 100 },
  chartCaption: { color: palette.muted, fontSize: 10, marginTop: 6 },
  explanationCard: { gap: 12, padding: 16 },
  lead: { color: palette.ink, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  body: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: palette.ink, fontSize: 13, fontWeight: '700', marginTop: 3 },
  safetyBox: { alignItems: 'flex-start', backgroundColor: palette.dangerBg, borderRadius: 6, flexDirection: 'row', gap: 9, padding: 12 },
  safetyText: { color: palette.dangerText, flex: 1, fontSize: 11, lineHeight: 17 },
  reviewPending: { alignItems: 'flex-start', backgroundColor: palette.leaf, borderRadius: 7, flexDirection: 'row', gap: 10, padding: 14 },
  historyList: { gap: 8 },
  historyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 13 },
  historyDate: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  historySource: { color: palette.muted, fontSize: 10, marginTop: 4 },
  historyValue: { color: palette.ink, fontSize: 20, fontWeight: '500', fontVariant: ['tabular-nums'] },
  historyUnit: { color: palette.forest, fontFamily: 'System', fontSize: 11 },
  emptyHistory: { ...glassSurface(), borderRadius: 7, padding: 14 },
  bottomAdd: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: palette.forest, borderRadius: 7, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 8, minHeight: 47 },
  relatedReading: { borderTopColor: palette.line, borderTopWidth: 1, gap: 5, marginTop: 15, paddingTop: 15 },
  relatedTitle: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  messageCard: { ...glassSurface(), borderRadius: 7, gap: 9, padding: 16 },
  secondaryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: palette.leaf, borderRadius: 6, marginTop: 4, minHeight: 40, justifyContent: 'center', paddingHorizontal: 14 },
  secondaryLabel: { color: palette.forest, fontSize: 12, fontWeight: '700' },
  loading: { alignItems: 'center', gap: 9, marginTop: 35 },
  errorState: { backgroundColor: palette.dangerBg, borderCurve: 'continuous', borderRadius: 12, gap: 4, marginTop: 12, padding: 13 },
  error: { color: palette.dangerText, fontSize: 13, lineHeight: 19 },
  retryButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  retryLabel: { color: palette.forest, fontSize: 14, fontWeight: '700' },
}));