import { StyleSheet, Text, View } from 'react-native';

import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { ThinkingOrb } from '@/ui/thinking-orb';

/** Shows that the order is waiting on someone: first the donor's transfer, then the collector's check. */
export function WaitingCard({ phase }: { phase: 'transfer' | 'review' }) {
  useScheme();
  const { locale } = useLocale();
  const transfer = phase === 'transfer';
  const title = donationCopy(locale, transfer ? 'waiting.transferTitle' : 'waiting.reviewTitle');
  return (
    <View accessibilityLabel={title} accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={[styles.card, locale === 'ar' && styles.rtl]}>
      <ThinkingOrb label={title} size={64} state={transfer ? 'breathing' : 'working'} />
      <View style={styles.copy}>
        <Text style={[styles.title, locale === 'ar' && styles.rtlText]}>{title}</Text>
        <Text style={[styles.body, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, transfer ? 'waiting.transferBody' : 'waiting.reviewBody')}</Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: palette.leaf, borderColor: palette.leafDeep, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 14, marginTop: 16, padding: 14 },
  copy: { flex: 1, gap: 4 },
  title: { ...display, color: palette.ink, fontSize: 17 },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  rtl: { direction: 'rtl' },
  rtlText: { writingDirection: 'rtl', textAlign: 'right' },
}));
