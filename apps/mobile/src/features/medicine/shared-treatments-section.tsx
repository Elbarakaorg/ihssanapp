import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { Pill } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Message } from '@/features/doctor/ui';
import { endPrescribedTreatment, getSharedPatientTreatments, type SharedTreatment } from '@/features/medicine/repository';
import { AdherenceView } from '@/features/medicine/adherence-view';
import { getSharedPatientAdherence } from '@/features/medicine/repository';
import { describeSchedule } from '@/features/medicine/schedule';
import { SectionHeading } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme, wobble } from '@/ui/palette';

export function SharedTreatmentsSection({ grantId }: { grantId: string }) {
  useScheme();
  const router = useRouter();
  const [items, setItems] = useState<SharedTreatment[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setError(''); setItems(await getSharedPatientTreatments(grantId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load treatments.'); setItems([]); }
  }, [grantId]);
  const loadAdherence = useCallback((days: number) => getSharedPatientAdherence(grantId, days), [grantId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View>
      <SectionHeading title="Treatments" detail={items ? `${items.filter((t) => t.status === 'active').length} active` : undefined} />
      {error ? <Message kind="error">{error}</Message> : null}
      {items?.map((t) => (
        <View key={t.id} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{t.name}</Text>
            <Text style={[styles.status, t.status !== 'active' && styles.off]}>{t.status}</Text>
          </View>
          {t.prescribed ? <Text style={styles.tag}>{t.prescribed_by_me ? 'Prescribed by you' : 'Prescribed by another clinician'}</Text> : <Text style={styles.meta}>Added by the patient</Text>}
          {t.medications.map((m) => (
            <View key={m.id} style={styles.row}>
              <Pill color={palette.forest} size={14} />
              <Text style={styles.meta}>{[m.name, m.strength].filter(Boolean).join(' ')} — {describeSchedule(m)}{m.instructions ? ` · ${m.instructions}` : ''} · {m.taken_7d} taken in 7 days</Text>
            </View>
          ))}
          {t.notes ? <Text style={styles.meta}>{t.notes}</Text> : null}
          {t.prescribed_by_me && (t.status === 'active' || t.status === 'paused') ? (
            <Button label="End this treatment" onPress={() => void endPrescribedTreatment(t.id).then(load).catch((e) => setError(e instanceof Error ? e.message : 'Could not end this treatment.'))} tone="secondary" />
          ) : null}
        </View>
      ))}
      {items?.length ? <><SectionHeading title="Adherence" detail="Self-reported doses" /><AdherenceView load={loadAdherence} /></> : null}
      {items && !items.length && !error ? <Text style={styles.meta}>No treatments recorded yet.</Text> : null}
      <Button label="Prescribe a treatment" onPress={() => router.push(`/my-patients/prescribe?grantId=${grantId}` as Href)} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { ...wobble, backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, gap: 6, marginTop: 10, padding: 14 },
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...display, color: palette.ink, fontSize: 18 },
  status: { color: palette.forest, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  off: { color: palette.muted },
  tag: { color: palette.gold, fontSize: 12, fontWeight: '600' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  meta: { color: palette.muted, flex: 1, fontSize: 12, lineHeight: 18 },
}));
