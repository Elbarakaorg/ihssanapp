import { type Href, useRouter } from 'expo-router';
import { Check, Pill, SkipForward, Undo2 } from 'lucide-react-native';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { BackLink, Button, Chip, Message } from '@/features/doctor/ui';
import { AdherenceView } from '@/features/medicine/adherence-view';
import { RemindersToggle } from '@/features/medicine/reminders-toggle';
import { StockEditor } from '@/features/medicine/stock-editor';
import { deleteMyTreatment, getMyAdherence, setTreatmentStatus } from '@/features/medicine/repository';
import { asNeededForDay, describeSchedule, dosesForDay, formatAmount, progressOf, toLocalDateKey, weeklyAdherence, type Dose, type Treatment } from '@/features/medicine/schedule';
import { useTreatments } from '@/features/medicine/use-treatments';
import { Loading } from '@/ui/loading';
import { Page, PageHeading, SectionHeading } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme, wobble } from '@/ui/palette';

export function ProgressBar({ percent }: { percent: number }) {
  useScheme();
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>;
}

export function DoseRow({ dose, onSet }: { dose: Dose; onSet: (status: 'taken' | 'skipped' | null) => void }) {
  useScheme();
  const done = dose.status === 'taken' || dose.status === 'skipped';
  return (
    <View style={[styles.dose, dose.status === 'taken' && styles.doseTaken]}>
      <Text style={styles.slot}>{dose.slot}</Text>
      <View style={styles.doseCopy}>
        <Text style={[styles.doseName, dose.status === 'taken' && styles.struck]}>{dose.name}</Text>
        <Text style={styles.meta}>{[dose.label, dose.instructions].filter(Boolean).join(' · ') || dose.treatmentName}</Text>
        {dose.status === 'missed' ? <Text style={styles.missed}>Not logged yet</Text> : null}
        {dose.status === 'skipped' ? <Text style={styles.meta}>Skipped</Text> : null}
      </View>
      {done ? (
        <Pressable accessibilityLabel={`Undo ${dose.name}`} accessibilityRole="button" onPress={() => onSet(null)} style={styles.iconButton}><Undo2 color={palette.muted} size={18} /></Pressable>
      ) : (
        <View style={styles.doseActions}>
          <Pressable accessibilityLabel={`Skip ${dose.name}`} accessibilityRole="button" onPress={() => onSet('skipped')} style={styles.iconButton}><SkipForward color={palette.muted} size={18} /></Pressable>
          <Pressable accessibilityLabel={`Mark ${dose.name} taken`} accessibilityRole="button" onPress={() => onSet('taken')} style={styles.takeButton}><Check color={palette.white} size={18} /></Pressable>
        </View>
      )}
    </View>
  );
}

const statusLabel: Record<Treatment['status'], string> = { active: 'Active', paused: 'Paused', completed: 'Completed', stopped: 'Stopped' };

export default function TreatmentsScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const { treatments, logs, loading, error, reload, setDose, takeAsNeeded } = useTreatments();
  const today = toLocalDateKey(new Date());
  const doses = dosesForDay(treatments, logs, today);
  const progress = progressOf(doses);
  const asNeeded = asNeededForDay(treatments, logs, today);
  const week = weeklyAdherence(treatments, logs, new Date());

  const changeStatus = async (t: Treatment, status: Treatment['status']) => {
    try { await setTreatmentStatus(t.id, status); await reload(); } catch (e) { Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again.'); }
  };
  const remove = (t: Treatment) => {
    const run = async () => { try { await deleteMyTreatment(t.id); await reload(); } catch (e) { Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.'); } };
    if (Platform.OS === 'web') { if (window.confirm(`Delete “${t.name}” and its dose history?`)) void run(); return; }
    Alert.alert('Delete treatment?', `“${t.name}” and its dose history will be removed.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run() }]);
  };

  return (
    <Page>
      <BackLink href="/" label="Home" />
      <PageHeading eyebrow="Daily care" title="Treatments">Track each dose and see how the week is going.</PageHeading>

      {!session ? (
        <>
          <Message kind="info">Sign in to build a treatment, log doses and see treatments prescribed by your doctor.</Message>
          <Button label="Sign in" onPress={() => router.push('/auth' as Href)} />
          <Button label="Browse the medicine directory" onPress={() => router.push('/medicines' as Href)} tone="secondary" />
        </>
      ) : loading ? <Loading label="Loading treatments" /> : (
        <>
          {error ? <Message kind="error">{error}</Message> : null}
          <SectionHeading title="Today" detail={doses.length ? `${progress.taken} of ${progress.total} taken` : undefined} />
          {doses.length ? (
            <View style={styles.card}>
              <View style={styles.progressTop}><Text style={styles.percent}>{progress.percent}%</Text><Text style={styles.meta}>of today’s doses</Text></View>
              <ProgressBar percent={progress.percent} />
              <View style={styles.week}>
                {week.map((d) => (
                  <View key={d.dateKey} style={styles.weekDay}>
                    <View style={styles.weekBar}><View style={[styles.weekFill, { height: `${d.percent}%` }, d.total === 0 && { height: 0 }]} /></View>
                    <Text style={[styles.weekLabel, d.dateKey === today && styles.weekToday]}>{d.date.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.meta}>Last 7 days</Text>
              {doses.map((d) => <DoseRow dose={d} key={d.key} onSet={(status) => void setDose(d.medicationId, today, d.slot, status)} />)}
            </View>
          ) : (
            <Message kind="info">{treatments.some((t) => t.status === 'active') ? 'Nothing is scheduled for today.' : 'No active treatment yet. Add one, or your doctor can prescribe one for you.'}</Message>
          )}

          {asNeeded.length ? (
            <>
              <SectionHeading title="As needed" detail="Within your daily maximum" />
              {asNeeded.map((a) => {
                const max = a.medication.max_daily_amount ?? a.medication.amount;
                const nowSlot = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };
                return (
                  <View key={a.medication.id} style={styles.card}>
                    <Text style={styles.doseName}>{a.medication.name}</Text>
                    <Text style={styles.meta}>Prescribed dose: {formatAmount(a.medication.amount, a.medication.unit)} · maximum {formatAmount(max, a.medication.unit)} a day{a.medication.min_interval_hours ? ` · ${a.medication.min_interval_hours} h apart` : ''}</Text>
                    {a.medication.instructions ? <Text style={styles.meta}>{a.medication.instructions}</Text> : null}
                    <ProgressBar percent={Math.min(100, Math.round((a.takenAmount / max) * 100))} />
                    <Text style={styles.meta}>Taken today: {formatAmount(a.takenAmount, a.medication.unit)} of {formatAmount(max, a.medication.unit)}</Text>
                    {a.intakes.map((l) => (
                      <View key={l.slot} style={styles.medRow}>
                        <Text style={styles.slot}>{l.slot}</Text>
                        <Text style={[styles.meta, styles.doseCopy]}>{formatAmount(l.amount ?? a.medication.amount, a.medication.unit)}</Text>
                        <Pressable accessibilityLabel={`Undo ${a.medication.name} at ${l.slot}`} accessibilityRole="button" onPress={() => void takeAsNeeded(a.medication.id, today, l.slot, null)} style={styles.iconButton}><Undo2 color={palette.muted} size={18} /></Pressable>
                      </View>
                    ))}
                    {a.reason ? <Text style={styles.missed}>{a.reason}</Text> : null}
                    <Button label={`Take ${formatAmount(a.medication.amount, a.medication.unit)} now`} onPress={() => void takeAsNeeded(a.medication.id, today, nowSlot(), 'taken')} tone={a.canTake ? 'primary' : 'secondary'} disabled={!a.canTake} />
                  </View>
                );
              })}
            </>
          ) : null}

          <Button label="New treatment" onPress={() => router.push('/treatments/edit' as Href)} />
          <Button label="Browse the medicine directory" onPress={() => router.push('/medicines' as Href)} tone="secondary" />

          <RemindersToggle treatments={treatments} />

          {treatments.length ? (
            <>
              <SectionHeading title="Adherence" detail="How consistent you have been" />
              <AdherenceView label="My report" load={getMyAdherence} shareable />
            </>
          ) : null}

          <SectionHeading title="Your treatments" detail={`${treatments.length}`} />
          {treatments.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.doseCopy}>
                  <Text style={styles.cardTitle}>{t.name}</Text>
                  {t.prescribed ? <Text style={styles.prescribed}>Prescribed{t.prescriber_name ? ` by ${t.prescriber_name}` : ''}</Text> : null}
                </View>
                <Text style={[styles.status, t.status !== 'active' && styles.statusOff]}>{statusLabel[t.status]}</Text>
              </View>
              {t.medications.map((m) => (
                <View key={m.id} style={styles.medBlock}>
                  <View style={styles.medRow}>
                  <Pill color={palette.forest} size={14} />
                  <Text style={[styles.meta, styles.doseCopy]}>{[m.name, m.strength].filter(Boolean).join(' ')} — {describeSchedule(m)}{m.instructions ? ` · ${m.instructions}` : ''}</Text>
                  </View>
                  <StockEditor medication={m} onSaved={() => void reload()} />
                </View>
              ))}
              {t.notes ? <Text style={styles.meta}>{t.notes}</Text> : null}
              <Text style={styles.meta}>From {t.starts_on}{t.ends_on ? ` to ${t.ends_on}` : ''}</Text>
              <View style={styles.actions}>
                {!t.prescribed ? <Chip label="Edit" onPress={() => router.push(`/treatments/edit?id=${t.id}` as Href)} /> : null}
                {t.status === 'active' ? <Chip label="Pause" onPress={() => void changeStatus(t, 'paused')} /> : null}
                {t.status === 'paused' || t.status === 'stopped' || t.status === 'completed' ? <Chip label="Resume" onPress={() => void changeStatus(t, 'active')} /> : null}
                {t.status === 'active' || t.status === 'paused' ? <Chip label="Mark complete" onPress={() => void changeStatus(t, 'completed')} /> : null}
                {!t.prescribed ? <Chip label="Delete" onPress={() => remove(t)} /> : null}
              </View>
            </View>
          ))}
          <Text style={styles.disclaimer}>This tracker is a memory aid, not medical advice. Follow your doctor’s or pharmacist’s instructions, and ask them before changing or stopping a medicine.</Text>
        </>
      )}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { ...wobble, backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, gap: 8, marginTop: 12, padding: 14 },
  cardHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  cardTitle: { ...display, color: palette.ink, fontSize: 19 },
  prescribed: { color: palette.gold, fontSize: 12, fontWeight: '600' },
  status: { color: palette.forest, fontSize: 11, fontWeight: '700' },
  statusOff: { color: palette.muted },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  medBlock: { gap: 6 },
  medRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  track: { backgroundColor: palette.leaf, borderRadius: 6, height: 10, overflow: 'hidden' },
  fill: { backgroundColor: palette.forest, borderRadius: 6, height: 10 },
  progressTop: { alignItems: 'baseline', flexDirection: 'row', gap: 8 },
  percent: { ...display, color: palette.ink, fontSize: 34, fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', gap: 6, justifyContent: 'space-between', marginTop: 6 },
  weekDay: { alignItems: 'center', flex: 1, gap: 4 },
  weekBar: { backgroundColor: palette.leaf, borderRadius: 4, height: 44, justifyContent: 'flex-end', overflow: 'hidden', width: '70%' },
  weekFill: { backgroundColor: palette.forest, width: '100%' },
  weekLabel: { color: palette.muted, fontSize: 10 },
  weekToday: { color: palette.ink, fontWeight: '700' },
  dose: { alignItems: 'center', borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 60, paddingVertical: 8 },
  doseTaken: { opacity: 0.65 },
  slot: { color: palette.forest, fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '700', width: 46 },
  doseCopy: { flex: 1, minWidth: 0 },
  doseName: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  struck: { textDecorationLine: 'line-through' },
  missed: { color: palette.coral, fontSize: 11, fontWeight: '600' },
  doseActions: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  takeButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  disclaimer: { color: palette.muted, fontSize: 11, fontStyle: 'italic', lineHeight: 16, marginTop: 20 },
}));
