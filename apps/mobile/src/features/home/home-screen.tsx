import { useRouter } from 'expo-router';
import { ArrowRight, Heart, MapPin, QrCode, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import ActivityTracker from '@/features/home/activity-tracker';
import { listMeasurementsForCurrentUser } from '@/features/health/measurement-repository';
import { summarizeMeasurements } from '@/features/health/measurement-summary';
import { getCurrentUserProfile } from '@/features/profile/profile-repository';
import { BrandMark, Page, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { PreferenceIcons } from '@/ui/preference-icons';
import { palette, themedStyles, useScheme } from '@/ui/palette';

export default function HomeScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [summary, setSummary] = useState({ count: 0, latestMeasurementDate: null as string | null });
  const [summaryReady, setSummaryReady] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryRetry, setSummaryRetry] = useState(0);

  useEffect(() => {
    if (!session) {
      setDisplayName('');
      setSummary({ count: 0, latestMeasurementDate: null });
      setSummaryReady(true);
      setSummaryError('');
      return;
    }

    let active = true;
    setSummaryReady(false);
    setSummaryError('');

    void Promise.all([getCurrentUserProfile(), listMeasurementsForCurrentUser()]).then(([profile, measurements]) => {
      if (!active) return;
      setDisplayName(profile.display_name);
      setSummary(summarizeMeasurements(measurements));
      setSummaryReady(true);
    }).catch(() => {
      if (!active) return;
      setSummaryError('Could not load your health record. Check your connection and try again.');
      setSummaryReady(true);
    });

    return () => {
      active = false;
    };
  }, [session, summaryRetry]);

  return (
    <Page>
      <View style={styles.topNav}>
        <BrandMark />
        <View style={styles.topActions}>
          <PreferenceIcons />
          <Pressable accessibilityLabel="Scan a QR code" accessibilityRole="button" onPress={() => router.push('/scan')} style={styles.scanButton}>
            <QrCode color={palette.forest} size={19} strokeWidth={1.9} />
          </Pressable>
        </View>
      </View>
      <PreviewNotice />

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>{session ? `Welcome back${displayName ? `, ${displayName}` : ''}` : 'Your health, your pace'}</Text>
        <Text style={styles.title}>{session ? 'Your health,\nyour pace.' : 'A clearer view\nof your health.'}</Text>
        <Text style={styles.description}>
          Keep your test results together, learn what each test measures, and choose when to share them with a doctor.
        </Text>
      </View>

      <View style={styles.recordCard}>
        <View style={styles.recordTop}>
          <View>
            <Text style={styles.cardEyebrow}>Your health record</Text>
            <Text style={styles.recordCount}>
              {!summaryReady ? 'Loading your record' : summary.count ? `${summary.count} ${summary.count === 1 ? 'result' : 'results'} recorded` : summaryError ? 'Record unavailable' : 'Ready when you are'}
            </Text>
          </View>
          <View style={styles.recordIcon}>
            <Heart color={palette.forest} size={21} strokeWidth={1.8} />
          </View>
        </View>
        <View style={styles.rule} />
        <Text accessibilityRole={summaryError ? 'alert' : undefined} style={styles.emptyText}>
          {summaryError
            ? summaryError
            : !session
            ? 'Sign in to see your saved measurements and keep your health history in one place.'
            : summary.count
              ? `Your latest result is dated ${new Date(summary.latestMeasurementDate ?? '').toLocaleDateString()}.`
              : 'No measurements saved yet. Add your first result to start your health timeline.'}
        </Text>
        {session && summaryError ? (
          <Pressable accessibilityRole="button" onPress={() => setSummaryRetry((retry) => retry + 1)} style={styles.retryButton}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        ) : null}
        {session ? (
          <View style={styles.accountActions}>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/health')} style={styles.primaryAccountButton}>
              <Text style={styles.primaryAccountText}>{summaryError ? 'Open health tracking' : summary.count ? 'View health record' : 'Add a result'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/profile')} style={styles.secondaryAccountButton}>
              <Text style={styles.secondaryAccountText}>Your account</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.accountActions}>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/auth')} style={styles.primaryAccountButton}>
              <Text style={styles.primaryAccountText}>Sign in</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/auth', params: { mode: 'sign-up' } })} style={styles.secondaryAccountButton}>
              <Text style={styles.secondaryAccountText}>Create account</Text>
            </Pressable>
          </View>
        )}
        {session ? null : (
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/health')} style={styles.textAction}>
            <Text style={styles.textActionLabel}>Explore health tracking</Text>
            <ArrowRight color={palette.forest} size={17} />
          </Pressable>
        )}
      </View>

      <ActivityTracker onOpen={() => router.push('/activity')} />

      <SectionHeading title="Start here" detail="Choose a next step" />
      <View style={styles.actionGrid}>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/health')} style={[uiStyles.card, styles.actionCard]}>
          <View style={uiStyles.iconTile}>
            <Heart color={palette.forest} size={19} strokeWidth={1.9} />
          </View>
          <Text style={styles.actionTitle}>Track a result</Text>
          <Text style={styles.actionBody}>Blood sugar, INR, and more</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/discover')} style={[uiStyles.card, styles.actionCard]}>
          <View style={[uiStyles.iconTile, { backgroundColor: palette.sky }]}>
            <MapPin color={palette.forest} size={19} strokeWidth={1.9} />
          </View>
          <Text style={styles.actionTitle}>Find care</Text>
          <Text style={styles.actionBody}>Doctors and pharmacies nearby</Text>
        </Pressable>
      </View>

      <View style={styles.privacyNote}>
        <ShieldCheck color={palette.forest} size={19} strokeWidth={1.8} />
        <View style={styles.privacyCopy}>
          <Text style={styles.privacyTitle}>Your record is yours to share</Text>
          <Text style={styles.privacyBody}>Doctor access starts with your approval. Your account shows its saved results here.</Text>
        </View>
      </View>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  topNav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  topActions: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  scanButton: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderCurve: 'continuous', borderRadius: 21, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  intro: {
    marginBottom: 28,
    paddingTop: 8,
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 11,
  },
  title: {
    color: palette.ink,
    fontSize: 39,
    fontWeight: '600',
    letterSpacing: -0.9,
    lineHeight: 44,
  },
  description: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 530,
  },
  recordCard: {
    backgroundColor: palette.ink,
    borderCurve: 'continuous',
    borderRadius: 18,
    padding: 22,
  },
  recordTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardEyebrow: {
    color: '#BCC8C1',
    fontSize: 11,
    fontWeight: '500',
  },
  recordCount: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginTop: 7,
  },
  recordIcon: {
    alignItems: 'center',
    backgroundColor: '#252B28',
    borderRadius: 24,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rule: {
    backgroundColor: '#39413D',
    height: 1,
    marginVertical: 16,
  },
  emptyText: {
    color: '#D5DDD8',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 490,
  },
  retryButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  retryLabel: {
    color: palette.forest,
    fontSize: 14,
    fontWeight: '700',
  },
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  primaryAccountButton: {
    alignItems: 'center',
    backgroundColor: palette.forest,
    borderCurve: 'continuous',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  primaryAccountText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryAccountButton: {
    alignItems: 'center',
    backgroundColor: '#252B28',
    borderCurve: 'continuous',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryAccountText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  textAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    marginTop: 17,
    minHeight: 40,
  },
  textActionLabel: {
    color: palette.forest,
    fontSize: 14,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flexBasis: 220,
    flexGrow: 1,
    minHeight: 148,
  },
  actionTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 15,
  },
  actionBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  privacyNote: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 2,
  },
  privacyCopy: {
    flex: 1,
  },
  privacyTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  privacyBody: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
}));