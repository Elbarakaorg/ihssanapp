import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ActivityTracker from '@/features/home/activity-tracker';
import { Page, PageHeading, PreviewNotice } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';

export default function ActivityScreen() {
  useScheme();
  const router = useRouter();
  return <Page>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><ArrowLeft color={palette.ink} size={18} /><Text style={styles.backText}>Home</Text></Pressable>
    <PreviewNotice />
    <PageHeading eyebrow="Movement" title="Steps & walking">Build a steady routine with a daily step goal and focused walking sessions. Distance and calorie values are estimates.</PageHeading>
    <ActivityTracker detailed />
    <View style={styles.disclaimer}><Text style={styles.disclaimerText}>Activity estimates are for general wellness only. Step availability and historical data vary by device and platform.</Text></View>
  </Page>;
}

const styles = themedStyles(() => StyleSheet.create({
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 16, minHeight: 42 },
  backText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  disclaimer: { backgroundColor: palette.sky, borderRadius: 12, marginTop: 2, padding: 14 },
  disclaimerText: { color: palette.muted, fontSize: 12, lineHeight: 18 },
}));