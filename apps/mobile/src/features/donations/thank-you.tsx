import { Heart } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Button } from '@/features/doctor/ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';

import { givingVerses } from './giving-verses';

function Ring({ delay, reduced }: { delay: number; reduced: boolean }) {
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) progress.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [delay, progress, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: reduced ? 0.25 : 0.5 * (1 - progress.value), transform: [{ scale: reduced ? 1.4 : 0.6 + progress.value * 1.2 }] }));
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
}

export function ThankYou({ visible, onClose, title = 'JazakAllahu khayran' }: { visible: boolean; onClose: () => void; title?: string }) {
  useScheme();
  const reduced = useReducedMotion();
  const verse = useMemo(() => givingVerses[Math.floor(Math.random() * givingVerses.length)], [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const heart = useSharedValue(reduced ? 1 : 0);
  const text = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!visible || reduced) { heart.value = visible ? 1 : 0; text.value = visible ? 1 : 0; return; }
    heart.value = 0; text.value = 0;
    heart.value = withSequence(withSpring(1.15, { damping: 8, stiffness: 140 }), withSpring(1, { damping: 12 }));
    text.value = withDelay(500, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [visible, reduced, heart, text]);

  const heartStyle = useAnimatedStyle(() => ({ opacity: Math.min(heart.value * 2, 1), transform: [{ scale: heart.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: text.value, transform: [{ translateY: (1 - text.value) * 14 }] }));

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.backdrop}>
        <Pressable accessibilityViewIsModal style={styles.card}>
          <View style={styles.stage}>
            <Ring delay={0} reduced={reduced} />
            <Ring delay={1200} reduced={reduced} />
            <Animated.View style={[styles.heart, heartStyle]}><Heart color={palette.white} fill={palette.white} size={32} /></Animated.View>
          </View>
          <Animated.View style={[styles.content, textStyle]}>
            <Text style={styles.title}>{title}</Text>
            <Text accessibilityLanguage="ar" style={styles.arabic}>{verse.arabic}</Text>
            <Text style={styles.english}>{verse.english}</Text>
            <Text style={styles.source}>{verse.source}</Text>
          </Animated.View>
          <Button label="Alhamdulillah" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(20,40,28,0.55)', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: palette.white, borderRadius: 24, gap: 16, maxWidth: 420, padding: 24, width: '100%' },
  stage: { alignItems: 'center', height: 110, justifyContent: 'center' },
  ring: { backgroundColor: palette.leafDeep, borderRadius: 60, height: 100, position: 'absolute', width: 100 },
  heart: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 36, height: 72, justifyContent: 'center', width: 72 },
  content: { alignItems: 'center', gap: 10 },
  title: { ...display, color: palette.ink, fontSize: 22, textAlign: 'center' },
  arabic: { color: palette.ink, fontFamily: 'Amiri_400Regular', fontSize: 24, lineHeight: 44, textAlign: 'center', writingDirection: 'rtl' },
  english: { ...display, color: palette.ink, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  source: { color: palette.gold, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textAlign: 'center', textTransform: 'uppercase' },
}));
