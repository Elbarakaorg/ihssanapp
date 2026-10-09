import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { givingVerses } from './giving-verses';

/** A calm, rotating reminder of the reward of giving. Sits below the bank details so it never pushes them down. */
export function GivingVerseCard() {
  useScheme();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * givingVerses.length));
  const fade = useSharedValue(1);

  useEffect(() => {
    const timer = setInterval(() => {
      fade.value = withTiming(0, { duration: reduced ? 0 : 350 });
      setTimeout(() => { setIndex((current) => (current + 1) % givingVerses.length); fade.value = withTiming(1, { duration: reduced ? 0 : 500 }); }, reduced ? 0 : 380);
    }, 12000);
    return () => clearInterval(timer);
  }, [fade, reduced]);

  const style = useAnimatedStyle(() => ({ opacity: fade.value }));
  const verse = givingVerses[index];
  return (
    <View style={styles.card}>
      <Animated.View style={[styles.inner, style]}>
        <Text accessibilityLanguage="ar" style={styles.arabic}>{verse.arabic}</Text>
        <Text style={styles.english}>{verse.english}</Text>
        <Text style={styles.source}>{verse.source}</Text>
      </Animated.View>
      <View style={styles.dots}>{givingVerses.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotOn]} />)}</View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { backgroundColor: palette.leaf, borderColor: palette.leafDeep, borderRadius: 20, borderWidth: 1, gap: 12, marginTop: 16, padding: 18 },
  inner: { alignItems: 'center', gap: 10 },
  arabic: { color: palette.ink, fontFamily: 'Amiri_400Regular', fontSize: 23, lineHeight: 42, textAlign: 'center', writingDirection: 'rtl' },
  english: { ...display, color: palette.ink, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  source: { color: palette.forest, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center', textTransform: 'uppercase' },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  dot: { backgroundColor: palette.leafDeep, borderRadius: 3, height: 5, width: 5 },
  dotOn: { backgroundColor: palette.forest, width: 14 },
}));
