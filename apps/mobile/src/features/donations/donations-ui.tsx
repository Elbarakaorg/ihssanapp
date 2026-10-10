import * as Clipboard from 'expo-clipboard';
import { Check, Copy, Flame } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RemoteImage } from '@/features/doctor/doctor-image';
import { display, palette, themedStyles, useScheme, wobble, glassSurface } from '@/ui/palette';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { CASE_BUCKET, type CaseSummary, type Category } from './donations-api';
import { formatMad, percentFunded, pledgeStatus } from './donations-logic';

export function ProgressBar({ raised, goal }: { raised: number; goal: number }) {
  useScheme();
  const { locale } = useLocale();
  const percent = percentFunded(raised, goal);
  return (
    <View accessibilityLabel={donationCopy(locale, 'give.fundedPercent', { percent })} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(percent, raised > 0 ? 2 : 0)}%` }]} />
    </View>
  );
}

export function Progress({ raised, goal, donors }: { raised: number; goal: number; donors?: number }) {
  useScheme();
  const { locale } = useLocale();
  return (
    <View style={styles.progress}>
      <ProgressBar raised={raised} goal={goal} />
      <View style={styles.amounts}>
        <Text style={styles.raised}>{formatMad(raised, locale)} <Text style={styles.of}>{locale === 'fr' ? 'sur' : locale === 'ar' ? 'من' : 'of'} {formatMad(goal, locale)}</Text></Text>
        <Text style={styles.percent}>{percentFunded(raised, goal)}%</Text>
      </View>
      {donors !== undefined ? <Text style={styles.of}>{donationCopy(locale, donors === 1 ? 'give.donationSingular' : 'give.donationPlural', { count: donors })}</Text> : null}
    </View>
  );
}

export function UrgentBadge() {
  useScheme();
  const { locale } = useLocale();
  return <View style={styles.urgent}><Flame color={palette.coral} size={12} /><Text style={styles.urgentLabel}>{donationCopy(locale, 'give.urgentCase')}</Text></View>;
}

export function StatusPill({ status }: { status: string }) {
  useScheme();
  const { locale } = useLocale();
  const info = pledgeStatus(status, locale);
  const tone = info.tone === 'ok' ? styles.pillOk : info.tone === 'bad' ? styles.pillBad : info.tone === 'wait' ? styles.pillWait : styles.pillInfo;
  return <View style={[styles.pill, tone]}><Text style={styles.pillLabel}>{info.label}</Text></View>;
}

export function CaseCard({ item, categories, onPress }: { item: CaseSummary; categories: Category[]; onPress: () => void }) {
  useScheme();
  const { locale } = useLocale();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}. ${donationCopy(locale, 'give.fundedPercent', { percent: item.percent })}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View>
        <RemoteImage bucket={CASE_BUCKET} path={item.photo_path} placeholderSize={34} style={styles.photo} />
        <View pointerEvents="none" style={styles.badges}>
          {item.is_urgent ? <UrgentBadge /> : null}
            {item.category_label ? <Text style={styles.tag}>{categories?.find((category) => category.slug === item.category)?.[`label_${locale}`] ?? item.category_label}</Text> : null}
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.by}>{[item.beneficiary_name, item.city].filter(Boolean).join(' · ')}</Text>
        <Progress raised={item.raised_mad} goal={item.goal_mad} />
        {item.status === 'funded' ? <Text style={styles.funded}>{donationCopy(locale, 'give.fullyFunded')}</Text> : null}
      </View>
    </Pressable>
  );
}

export function CopyRow({ label, value, display: shown }: { label: string; value: string; display?: string }) {
  useScheme();
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      accessibilityLabel={donationCopy(locale, 'bank.copy', { label })}
      accessibilityRole="button"
      onPress={() => { void Clipboard.setStringAsync(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}
      style={({ pressed }) => [styles.copyRow, pressed && styles.pressed]}
    >
      <View style={styles.copyText}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text selectable style={styles.copyValue}>{shown ?? value}</Text>
      </View>
      {copied ? <><Text style={styles.copied}>{donationCopy(locale, 'bank.copied')}</Text><Check color={palette.forest} size={18} /></> : <Copy color={palette.muted} size={18} />}
    </Pressable>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  track: { backgroundColor: palette.leaf, borderRadius: 6, height: 10, overflow: 'hidden' },
  fill: { backgroundColor: palette.forest, borderRadius: 6, height: 10 },
  progress: { gap: 6 },
  amounts: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  raised: { ...display, color: palette.ink, fontSize: 17 },
  of: { color: palette.muted, fontSize: 12, fontWeight: '400' },
  percent: { color: palette.forest, fontSize: 13, fontWeight: '700' },
  urgent: { alignItems: 'center', backgroundColor: palette.dangerBg, borderRadius: 10, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 3 },
  urgentLabel: { color: palette.coral, fontSize: 11, fontWeight: '700' },
  pill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  pillOk: { backgroundColor: palette.successBg }, pillBad: { backgroundColor: palette.dangerBg }, pillWait: { backgroundColor: palette.leaf }, pillInfo: { backgroundColor: palette.sky },
  pillLabel: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  card: { ...wobble, ...glassSurface(), borderWidth: 1, marginTop: 14, overflow: 'hidden' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  photo: { aspectRatio: 4 / 3, width: '100%' },
  badges: { alignItems: 'center', flexDirection: 'row', gap: 6, left: 10, position: 'absolute', top: 10 },
  by: { color: palette.muted, fontSize: 13 },
  cardBody: { gap: 8, padding: 14 },
  tags: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: 'rgba(253,253,250,0.92)', borderRadius: 10, color: palette.forest, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  title: { ...display, color: palette.ink, fontSize: 19, lineHeight: 24 },
  summary: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  funded: { color: palette.forest, fontSize: 12, fontWeight: '700' },
  copyRow: { ...wobble, alignItems: 'center', backgroundColor: palette.paper, borderColor: palette.line, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 8, minHeight: 52, padding: 12 },
  copyText: { flex: 1, gap: 2 },
  copyLabel: { color: palette.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  copied: { color: palette.forest, fontSize: 11, fontWeight: '700' },
  copyValue: { color: palette.ink, fontSize: 15, fontWeight: '600' },
}));
