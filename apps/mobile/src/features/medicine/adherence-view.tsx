import { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Message } from '@/features/doctor/ui';
import { adherencePercent, adherenceReport, overallAdherence, type AdherenceRow } from '@/features/medicine/schedule';
import { ProgressBar } from '@/features/medicine/treatments-screen';
import { Loading } from '@/ui/loading';
import { display, palette, themedStyles, useScheme, wobble, glassSurface } from '@/ui/palette';

const ranges = [7, 30, 90];

/** Adherence per medicine over 7/30/90 days. `load` supplies the data (patient's own, or a shared patient's). */
export function AdherenceView({ load, label, shareable = false }: { load: (days: number) => Promise<AdherenceRow[]>; label?: string; shareable?: boolean }) {
  useScheme();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<AdherenceRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setRows(null);
    setError('');
    load(days).then((r) => { if (active) setRows(r); }).catch((e) => { if (active) { setRows([]); setError(e instanceof Error ? e.message : 'Could not load adherence.'); } });
    return () => { active = false; };
  }, [days, load]);

  const overall = rows ? overallAdherence(rows) : null;
  const share = () => {
    if (!rows) return;
    const message = adherenceReport(rows, days, label);
    if (Platform.OS === 'web') { void navigator.clipboard?.writeText(message); return; }
    void Share.share({ message });
  };

  return (
    <View>
      <View style={styles.wrap}>{ranges.map((d) => <Chip key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />)}</View>
      {error ? <Message kind="error">{error}</Message> : null}
      {!rows ? <Loading inline label="Calculating" /> : (
        <View style={styles.card}>
          <View style={styles.top}>
            <Text style={styles.percent}>{overall?.percent === null || !overall ? '—' : `${overall.percent}%`}</Text>
            <Text style={styles.meta}>{overall?.expected ? `${overall.taken} of ${overall.expected} scheduled doses taken` : 'No scheduled doses in this period'}</Text>
          </View>
          {overall?.percent != null ? <ProgressBar percent={overall.percent} /> : null}
          {rows.map((r) => {
            const pct = adherencePercent(r);
            return (
              <View key={r.medication_id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={[styles.pct, pct !== null && pct < 70 && styles.low]}>{pct === null ? 'as needed' : `${pct}%`}</Text>
                </View>
                {pct !== null ? <ProgressBar percent={pct} /> : null}
                <Text style={styles.meta}>
                  {r.expected === null ? `${r.taken} intakes · ${Number(r.taken_amount)} ${r.unit} in total` : `${r.taken} of ${r.expected} taken${r.skipped ? ` · ${r.skipped} skipped` : ''}`}
                </Text>
              </View>
            );
          })}
          <Text style={styles.note}>Based on what the patient logged. Doses that were never logged count as missed.</Text>
          {shareable && rows.length ? <Button label={Platform.OS === 'web' ? 'Copy report' : 'Share report'} onPress={share} tone="secondary" /> : null}
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  card: { ...wobble, ...glassSurface(), borderWidth: 1, gap: 10, marginTop: 10, padding: 14 },
  top: { alignItems: 'baseline', flexDirection: 'row', gap: 10 },
  percent: { ...display, color: palette.ink, fontSize: 34, fontVariant: ['tabular-nums'] },
  meta: { color: palette.muted, flexShrink: 1, fontSize: 12, lineHeight: 18 },
  row: { gap: 5 },
  rowTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: palette.ink, flex: 1, fontSize: 14, fontWeight: '600' },
  pct: { color: palette.forest, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
  low: { color: palette.coral },
  note: { color: palette.muted, fontSize: 11, fontStyle: 'italic', lineHeight: 16 },
}));
