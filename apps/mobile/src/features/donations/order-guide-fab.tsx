import { BookOpen } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { palette, themedStyles, useScheme } from '@/ui/palette';

/** A floating button that reopens the donating guide; it pops in, pulses a few times, and shows a short hint once. */
export function GuideFab({ onPress }: { onPress: () => void }) {
  useScheme();
  const reduced = useReducedMotion();
  const enter = useSharedValue(reduced ? 1 : 0);
  const ring = useSharedValue(reduced ? 1 : 0);
  const hint = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    enter.set(withDelay(500, withSpring(1, { duration: 500, dampingRatio: 0.6 })));
    ring.set(withDelay(1100, withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), 3, false)));
    hint.set(withDelay(1000, withSequence(withTiming(1, { duration: 250 }), withDelay(3800, withTiming(0, { duration: 300 })))));
  }, [reduced, enter, ring, hint]);

  const body = useAnimatedStyle(() => ({ opacity: Math.min(enter.get() * 2, 1), transform: [{ scale: interpolate(enter.get(), [0, 1], [0.4, 1]) * (1 - 0.06 * press.get()) }] }));
  const pulse = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - ring.get()), transform: [{ scale: 1 + ring.get() * 0.7 }] }));
  const label = useAnimatedStyle(() => ({ opacity: hint.get(), transform: [{ translateX: (1 - hint.get()) * 10 }] }));

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.hint, label]}><Text style={styles.hintText}>How it works</Text></Animated.View>
      <Animated.View style={body}>
        <Animated.View pointerEvents="none" style={[styles.pulse, pulse]} />
        <Pressable accessibilityHint="Opens a step-by-step guide" accessibilityLabel="How donating works" accessibilityRole="button" onPress={onPress} onPressIn={() => press.set(withTiming(1, { duration: 120 }))} onPressOut={() => press.set(withTiming(0, { duration: 120 }))} style={styles.button}>
          <BookOpen color={palette.white} size={22} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { alignItems: 'center', bottom: 16, flexDirection: 'row', gap: 10, position: 'absolute', right: 16 },
  button: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 28, boxShadow: '0 6px 16px rgba(20,40,28,0.3)', height: 56, justifyContent: 'center', width: 56 },
  pulse: { backgroundColor: palette.forest, borderRadius: 28, height: 56, position: 'absolute', width: 56 },
  hint: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  hintText: { color: palette.ink, fontSize: 13, fontWeight: '700' },
}));
