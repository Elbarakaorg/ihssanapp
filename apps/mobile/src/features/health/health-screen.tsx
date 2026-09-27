import { useRouter } from 'expo-router';
import { Activity, Droplets, FlaskConical } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { listMeasurementsForCurrentUser } from '@/features/health/measurement-repository';
import { summarizeMeasurements } from '@/features/health/measurement-summary';
import { Page, PageHeading, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette } from '@/ui/palette';

const metrics = [
  { id: 'glucose', name: 'Blood sugar', detail: 'Glucose test results', icon: Droplets, available: true },
  { id: 'inr', name: 'INR', detail: 'Blood clotting test results', icon: Activity, available: true },
  { id: 'blood-pressure', name: 'Blood pressure', detail: 'Systolic and diastolic readings', icon: Activity, available: false },
  { id: 'other', name: 'Other tests', detail: 'Vitamins and additional results', icon: FlaskConical, available: false },
];

export default function HealthScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [measurementSummary, setMeasurementSummary] = useState({ count: 0, latestMeasurementDate: null as string | null });

  useEffect(() => {
    if (!session) {
      setMeasurementSummary({ count: 0, latestMeasurementDate: null });
      return;
    }

    let active = true;

    void listMeasurementsForCurrentUser().then((measurements) => {
      if (!active) return;
      setMeasurementSummary(summarizeMeasurements(measurements));
    }).catch(() => {
      if (active) setMeasurementSummary({ count: 0, latestMeasurementDate: null });
    });

    return () => {
      active = false;
    };
  }, [session]);

  return (
    <Page>
      <PreviewNotice />
      <PageHeading eyebrow="YOUR RECORD" title="Health tracking">
        A place for the results you choose to record. Nothing in this preview is saved or sent anywhere.
      </PageHeading>

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

      <SectionHeading title="Test categories" detail={measurementSummary.count ? 'Saved results' : 'No results yet'} />
      <View style={styles.metricList}>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const contents = (
            <>
              <View style={uiStyles.iconTile}>
                <Icon color={palette.forest} size={19} strokeWidth={1.8} />
              </View>
              <View style={styles.metricCopy}>
                <Text style={styles.metricName}>{metric.name}</Text>
                <Text style={styles.metricDetail}>{metric.detail}</Text>
              </View>
              {metric.available ? (
                <Text style={styles.addLabel}>Add</Text>
              ) : (
                <Text style={styles.laterLabel}>Later</Text>
              )}
            </>
          );

          if (!metric.available) {
            return <View key={metric.id} style={[uiStyles.card, styles.metricRow]}>{contents}</View>;
          }

          return (
            <Pressable
              accessibilityLabel={`Add ${metric.name} result`}
              accessibilityRole="button"
              key={metric.id}
              onPress={() => router.push({ pathname: '/measurement/[metricId]', params: { metricId: metric.id } })}
              style={[uiStyles.card, styles.metricRow]}>
              {contents}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.infoBlock}>
        <View style={styles.infoIcon}><Activity color={palette.white} size={18} strokeWidth={2} /></View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>Metric information is being prepared</Text>
          <Text style={styles.infoDescription}>Test explanations and ranges will be reviewed by Ihssan clinicians before they appear here.</Text>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  summary: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 17,
    marginBottom: 28,
    padding: 19,
  },
  summaryNumber: {
    color: palette.white,
    fontFamily: 'Georgia',
    fontSize: 33,
  },
  summaryLabel: {
    color: '#C4D5CA',
    fontSize: 11,
    marginTop: 2,
  },
  summaryRule: {
    backgroundColor: '#4A6557',
    height: 42,
    width: 1,
  },
  summaryCopy: {
    color: '#E1E9E2',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  metricList: {
    gap: 9,
  },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    padding: 13,
  },
  metricCopy: {
    flex: 1,
  },
  metricName: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  metricDetail: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  addLabel: {
    color: palette.forest,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  laterLabel: {
    color: palette.muted,
    fontSize: 11,
    paddingHorizontal: 6,
  },
  infoBlock: {
    alignItems: 'center',
    backgroundColor: '#E7EEE6',
    borderRadius: 8,
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
});