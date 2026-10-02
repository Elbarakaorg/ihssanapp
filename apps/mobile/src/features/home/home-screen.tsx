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
import { palette } from '@/ui/palette';

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [summary, setSummary] = useState({ count: 0, latestMeasurementDate: null as string | null });
  const [summaryReady, setSummaryReady] = useState(false);

  useEffect(() => {
    if (!session) {
      setDisplayName('');
      setSummary({ count: 0, latestMeasurementDate: null });
      setSummaryReady(true);
      return;
    }

    let active = true;
    setSummaryReady(false);

    void Promise.all([getCurrentUserProfile(), listMeasurementsForCurrentUser()]).then(([profile, measurements]) => {
      if (!active) return;
      setDisplayName(profile.display_name);
      setSummary(summarizeMeasurements(measurements));
      setSummaryReady(true);
    }).catch(() => {
      if (!active) return;
      setDisplayName('');
      setSummary({ count: 0, latestMeasurementDate: null });
      setSummaryReady(true);
    });

    return () => {
      active = false;
    };
  }, [session]);

  return (
    <Page>
      <View style={styles.topNav}>
        <BrandMark />
        <Pressable accessibilityLabel="Scan a QR code" accessibilityRole="button" onPress={() => router.push('/scan')} style={styles.scanButton}>
          <QrCode color={palette.forest} size={19} strokeWidth={1.9} />
        </Pressable>
      </View>
      <PreviewNotice />

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>{session ? `WELCOME BACK${displayName ? `, ${displayName}` : ''}` : 'YOUR HEALTH, YOUR PACE'}</Text>
        <Text style={styles.title}>{session ? 'Your health,\nyour pace.' : 'A clearer view\nof your health.'}</Text>
        <Text style={styles.description}>
          Keep your test results together, learn what each test measures, and choose when to share them with a doctor.
        </Text>
      </View>

      <View style={styles.recordCard}>
        <View style={styles.recordTop}>
          <View>
            <Text style={styles.cardEyebrow}>YOUR HEALTH RECORD</Text>
            <Text style={styles.recordCount}>
              {!summaryReady ? 'Loading your record' : summary.count ? `${summary.count} ${summary.count === 1 ? 'result' : 'results'} recorded` : 'Ready when you are'}
            </Text>
          </View>
          <View style={styles.recordIcon}>
            <Heart color={palette.forest} size={21} strokeWidth={1.8} />
          </View>
        </View>
        <View style={styles.rule} />
        <Text style={styles.emptyText}>
          {!session
            ? 'Sign in to see your saved measurements and keep your health history in one place.'
            : summary.count
              ? `Your latest result is dated ${new Date(summary.latestMeasurementDate ?? '').toLocaleDateString()}.`
              : 'No measurements saved yet. Add your first result to start your health timeline.'}
        </Text>
        {session ? (
          <View style={styles.accountActions}>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/health')} style={styles.primaryAccountButton}>
              <Text style={styles.primaryAccountText}>{summary.count ? 'View health record' : 'Add a result'}</Text>
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

const styles = StyleSheet.create({
  topNav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  scanButton: { alignItems: 'center', backgroundColor: palette.white, borderRadius: 21, height: 42, justifyContent: 'center', shadowColor: '#1C1C1E', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, width: 42 },
  intro: {
    marginBottom: 28,
    paddingTop: 8,
  },
  eyebrow: {
    color: palette.coral,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 11,
  },
  title: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 38,
    fontWeight: '700',
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
    backgroundColor: palette.leaf,
    borderRadius: 16,
    padding: 21,
  },
  recordTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardEyebrow: {
    color: palette.forest,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  recordCount: {
    color: palette.ink,
    fontSize: 23,
    fontWeight: '700',
    marginTop: 7,
  },
  recordIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F6EF',
    borderRadius: 24,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rule: {
    backgroundColor: '#C5D8C7',
    height: 1,
    marginVertical: 16,
  },
  emptyText: {
    color: '#53685B',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 490,
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
    borderRadius: 11,
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
    backgroundColor: '#F4F8F4',
    borderRadius: 11,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryAccountText: {
    color: palette.forest,
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
    minHeight: 160,
  },
  actionTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '700',
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
});