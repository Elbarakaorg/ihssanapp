import { useRouter } from 'expo-router';
import { ArrowRight, Heart, MapPin, ShieldCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark, Page, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette } from '@/ui/palette';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <Page>
      <BrandMark />
      <PreviewNotice />

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>YOUR HEALTH, YOUR PACE</Text>
        <Text style={styles.title}>A clearer view{'\n'}of your health.</Text>
        <Text style={styles.description}>
          Keep your test results together, learn what each test measures, and choose when to share them with a doctor.
        </Text>
      </View>

      <View style={styles.recordCard}>
        <View style={styles.recordTop}>
          <View>
            <Text style={styles.cardEyebrow}>YOUR HEALTH RECORD</Text>
            <Text style={styles.recordCount}>Ready when you are</Text>
          </View>
          <View style={styles.recordIcon}>
            <Heart color={palette.forest} size={21} strokeWidth={1.8} />
          </View>
        </View>
        <View style={styles.rule} />
        <Text style={styles.emptyText}>No measurements yet. Your results will appear here after you add them.</Text>
        <View style={styles.accountActions}>
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/auth')} style={styles.primaryAccountButton}>
            <Text style={styles.primaryAccountText}>Sign in to your account</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/auth')} style={styles.secondaryAccountButton}>
            <Text style={styles.secondaryAccountText}>Create an account</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/health')} style={styles.textAction}>
          <Text style={styles.textActionLabel}>Explore health tracking</Text>
          <ArrowRight color={palette.forest} size={17} />
        </Pressable>
      </View>

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
          <Text style={styles.privacyBody}>Doctor access starts with your approval. This preview does not connect to an account or save health data.</Text>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: 25,
    paddingTop: 5,
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
    fontSize: 39,
    fontWeight: '400',
    lineHeight: 46,
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
    borderRadius: 8,
    padding: 20,
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
    fontFamily: 'Georgia',
    fontSize: 23,
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
    borderRadius: 7,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  primaryAccountText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryAccountButton: {
    alignItems: 'center',
    backgroundColor: '#F4F8F4',
    borderRadius: 7,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
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
    minHeight: 154,
  },
  actionTitle: {
    color: palette.ink,
    fontSize: 16,
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