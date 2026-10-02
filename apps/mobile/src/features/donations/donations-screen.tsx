import { BadgeCheck, HeartHandshake, Landmark } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Page, PageHeading, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette } from '@/ui/palette';

export default function DonationsScreen() {
  return (
    <Page>
      <PreviewNotice />
      <PageHeading eyebrow="Ihssan Foundation" title="Give with purpose">
        Support verified cases across Morocco. Donations and fund distribution will be handled by Ihssan's foundation.
      </PageHeading>

      <View style={styles.emptyCase}>
        <View style={styles.heartTile}>
          <HeartHandshake color={palette.forest} size={25} strokeWidth={1.7} />
        </View>
        <Text style={styles.emptyTitle}>Verified cases will appear here</Text>
        <Text style={styles.emptyBody}>There are no published cases in this preview. Each case will show its verification status and how funds are allocated.</Text>
      </View>

      <SectionHeading title="How giving works" />
      <View style={styles.steps}>
        <View style={[uiStyles.card, styles.stepCard]}>
          <View style={styles.stepIcon}><BadgeCheck color={palette.forest} size={18} /></View>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Cases are reviewed</Text>
            <Text style={styles.stepBody}>The foundation verifies cases before publication.</Text>
          </View>
        </View>
        <View style={[uiStyles.card, styles.stepCard]}>
          <View style={[styles.stepIcon, { backgroundColor: palette.sky }]}><Landmark color={palette.forest} size={18} /></View>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Funds go through the foundation</Text>
            <Text style={styles.stepBody}>Payment and distribution records are kept separate and traceable.</Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  emptyCase: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 31,
  },
  heartTile: {
    alignItems: 'center',
    backgroundColor: '#F3F7F1',
    borderRadius: 28,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  emptyTitle: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 22,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyBody: {
    color: '#596F60',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 400,
    textAlign: 'center',
  },
  steps: {
    gap: 9,
  },
  stepCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  stepIcon: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderRadius: 6,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  stepCopy: {
    flex: 1,
  },
  stepTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  stepBody: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});