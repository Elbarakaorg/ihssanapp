import { useRouter } from 'expo-router';
import { ArrowRight, Compass, MapPin, Stethoscope, Pill } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Page, PageHeading, PreviewNotice } from '@/ui/patient-ui';
import { palette, radii, spacing, themedStyles, useScheme } from '@/ui/palette';

export default function DiscoveryScreen() {
  useScheme();
  const router = useRouter();

  return (
    <Page>
      <PreviewNotice />
      <PageHeading eyebrow="Care directory" title="Find care near you">
        A directory of verified doctors and pharmacies for communities across Morocco.
      </PageHeading>

      <View style={styles.directoryPanel}>
        <View style={styles.panelIcon}>
          <Compass color={palette.forest} size={23} strokeWidth={1.8} />
        </View>
        <Text style={styles.panelTitle}>Provider listings are coming soon</Text>
        <Text style={styles.panelBody}>
          Care search is not active in this preview. When verified listings are available, you’ll be able to search by city and check opening hours.
        </Text>
        <View style={styles.divider} />
        <View style={styles.coverageRow}>
          <MapPin color={palette.forest} size={17} strokeWidth={1.8} />
          <Text style={styles.coverageLabel}>Planned coverage</Text>
          <Text style={styles.coverageValue}>Morocco</Text>
        </View>
      </View>

      <View style={styles.services}>
        <Text style={styles.servicesTitle}>The directory will include</Text>
        <View style={styles.serviceRow}>
          <View style={styles.serviceIcon}>
            <Stethoscope color={palette.forest} size={18} strokeWidth={1.8} />
          </View>
          <View style={styles.serviceCopy}>
            <Text style={styles.serviceName}>Doctors</Text>
            <Text style={styles.serviceDetail}>Verified care providers and their practice details</Text>
          </View>
        </View>
        <View style={styles.serviceRow}>
          <View style={[styles.serviceIcon, styles.pharmacyIcon]}>
            <Pill color={palette.forest} size={18} strokeWidth={1.8} />
          </View>
          <View style={styles.serviceCopy}>
            <Text style={styles.serviceName}>Pharmacies</Text>
            <Text style={styles.serviceDetail}>Nearby locations and published opening hours</Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate('/health')}
        style={({ pressed }) => [styles.healthLink, pressed && styles.pressed]}>
        <Text style={styles.healthLinkText}>Explore health tracking</Text>
        <ArrowRight color={palette.forest} size={18} />
      </Pressable>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  directoryPanel: {
    backgroundColor: palette.white,
    borderCurve: 'continuous',
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.large,
    padding: spacing.lg,
  },
  panelIcon: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: radii.small,
    height: 48,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 48,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 27,
  },
  panelBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  divider: {
    backgroundColor: palette.leafDeep,
    height: 1,
    marginVertical: spacing.md,
  },
  coverageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  coverageLabel: {
    color: palette.muted,
    flex: 1,
    fontSize: 13,
  },
  coverageValue: {
    color: palette.forest,
    fontSize: 13,
    fontWeight: '700',
  },
  services: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  servicesTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  serviceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  serviceIcon: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: radii.small,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pharmacyIcon: {
    backgroundColor: palette.leaf,
  },
  serviceCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  serviceName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  serviceDetail: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  healthLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  healthLinkText: {
    color: palette.forest,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
}));
