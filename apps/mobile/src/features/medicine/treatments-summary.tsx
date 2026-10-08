import { type Href, useRouter } from 'expo-router';
import { ChevronRight, Pill } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { describeSchedule, dosesForDay, progressOf, toLocalDateKey } from '@/features/medicine/schedule';
import { useTreatments } from '@/features/medicine/use-treatments';
import { ProgressBar } from '@/features/medicine/treatments-screen';
import { SectionHeading } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme, wobble, glassSurface } from '@/ui/palette';

/** Medical-profile card: active treatments (including prescribed ones) and today's progress. */
export function TreatmentsSummary() {
  useScheme();
  const router = useRouter();
  const { treatments, logs, loading } = useTreatments();
  const active = treatments.filter((t) => t.status === 'active');
  const progress = progressOf(dosesForDay(treatments, logs, toLocalDateKey(new Date())));

  return (
    <View>
      <SectionHeading title="Treatments" detail={loading ? undefined : `${active.length} active`} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/treatments' as Href)} style={styles.card}>
        {active.length ? active.map((t) => (
          <View key={t.id} style={styles.item}>
            <Text style={styles.title}>{t.name}</Text>
            {t.prescribed ? <Text style={styles.tag}>Prescribed{t.prescriber_name ? ` by ${t.prescriber_name}` : ''}</Text> : null}
            {t.medications.map((m) => <View key={m.id} style={styles.row}><Pill color={palette.forest} size={13} /><Text style={styles.meta}>{m.name} — {describeSchedule(m)}</Text></View>)}
          </View>
        )) : <Text style={styles.meta}>{loading ? 'Loading…' : 'No active treatment. Add one, or your doctor can prescribe it.'}</Text>}
        {progress.total ? <View style={styles.progress}><ProgressBar percent={progress.percent} /><Text style={styles.meta}>{progress.taken} of {progress.total} doses taken today</Text></View> : null}
        <View style={styles.more}><Text style={styles.moreLabel}>Open treatments</Text><ChevronRight color={palette.forest} size={16} /></View>
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { ...wobble, ...glassSurface(), borderWidth: 1, gap: 10, padding: 14 },
  item: { gap: 4 },
  title: { ...display, color: palette.ink, fontSize: 18 },
  tag: { color: palette.gold, fontSize: 12, fontWeight: '600' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  progress: { gap: 6 },
  more: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'flex-end' },
  moreLabel: { color: palette.forest, fontSize: 12, fontWeight: '700' },
}));
