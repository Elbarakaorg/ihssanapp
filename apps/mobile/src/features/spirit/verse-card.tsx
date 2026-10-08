import { StyleSheet, Text, View } from 'react-native';

import type { Reflection } from '@/features/spirit/verses';
import { display, palette, themedStyles, useScheme, wobble, glassSurface } from '@/ui/palette';

export function VerseCard({ item, emphasis = false }: { item: Reflection; emphasis?: boolean }) {
  useScheme();
  return (
    <View style={[styles.card, emphasis && styles.emphasis]}>
      <Text accessibilityLanguage="ar" selectable style={[styles.arabic, emphasis && styles.arabicLarge]}>{item.arabic}</Text>
      <Text selectable style={styles.english}>{item.english}</Text>
      {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
      <Text style={styles.source}>{item.source}</Text>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { ...wobble, ...glassSurface(), borderWidth: StyleSheet.hairlineWidth, gap: 10, marginTop: 12, padding: 18 },
  emphasis: { backgroundColor: palette.leaf, borderColor: palette.leafDeep, marginTop: 0 },
  arabic: { color: palette.ink, fontFamily: 'Amiri_400Regular', fontSize: 24, lineHeight: 44, textAlign: 'center', writingDirection: 'rtl' },
  arabicLarge: { fontSize: 28, lineHeight: 50 },
  english: { ...display, color: palette.ink, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  note: { color: palette.muted, fontSize: 12, fontStyle: 'italic', lineHeight: 18, textAlign: 'center' },
  source: { color: palette.gold, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textAlign: 'center', textTransform: 'uppercase' },
}));
