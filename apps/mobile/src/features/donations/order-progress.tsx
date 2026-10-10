import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { palette, themedStyles, useScheme } from '@/ui/palette';
import { ORDER_STAGES } from './donations-logic';

const DOT = 22;
const CLAMP = Extrapolation.CLAMP;

function Dot({ index, progress, ring }: { index: number; progress: SharedValue<number>; ring: SharedValue<number> }) {
  const body = useAnimatedStyle(() => {
    const reached = interpolate(progress.get(), [index - 0.5, index], [0, 1], CLAMP);
    return { backgroundColor: reached > 0.5 ? palette.forest : palette.white, borderColor: reached > 0.5 ? palette.forest : palette.leafDeep, transform: [{ scale: 0.9 + 0.1 * reached }] };
  });
  const check = useAnimatedStyle(() => {
    const done = interpolate(progress.get(), [index, index + 0.5], [0, 1], CLAMP);
    return { opacity: done, transform: [{ scale: 0.4 + 0.6 * done }] };
  });
  const core = useAnimatedStyle(() => {
    const current = interpolate(Math.abs(progress.get() - index), [0, 0.5], [1, 0], CLAMP);
    return { opacity: current, transform: [{ scale: 0.6 + 0.4 * current }] };
  });
  const pulse = useAnimatedStyle(() => {
    const current = interpolate(Math.abs(progress.get() - index), [0, 0.5], [1, 0], CLAMP);
    return { opacity: current * 0.4 * (1 - ring.get()), transform: [{ scale: 1 + ring.get() * 0.9 }] };
  });
  return (
    <View style={styles.dotBox}>
      <Animated.View pointerEvents="none" style={[styles.pulse, pulse]} />
      <Animated.View style={[styles.dot, body]}>
        <Animated.View style={[styles.core, core]} />
        <Animated.View style={[styles.check, check]}><Check color={palette.white} size={13} strokeWidth={3.4} /></Animated.View>
      </Animated.View>
    </View>
  );
}

/** Four dots, no numbers: created, pending transfer, confirm, done. */
export function OrderProgress({ stage }: { stage: number }) {
  useScheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? stage : 0);
  const ring = useSharedValue(0);

  useEffect(() => {
    progress.set(reduced ? stage : withSpring(stage, { duration: 700, dampingRatio: 1 }));
  }, [stage, reduced, progress]);

  const waiting = stage > 0 && stage < ORDER_STAGES.length - 1;
  useEffect(() => {
    if (reduced || !waiting) { ring.set(0); return undefined; }
    ring.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false));
    return () => ring.set(0);
  }, [reduced, waiting, ring]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: interpolate(progress.get(), [0, ORDER_STAGES.length - 1], [0, 1], CLAMP) }] }));

  return (
    <View accessibilityLabel={`Donation progress: ${ORDER_STAGES[stage]}`} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: ORDER_STAGES.length - 1, now: stage }} style={styles.wrap}>
      <View style={styles.track}><Animated.View style={[styles.fill, fill]} /></View>
      <View style={styles.row}>
        {ORDER_STAGES.map((label, index) => (
          <View key={label} style={styles.column}>
            <Dot index={index} progress={progress} ring={ring} />
            <Text style={[styles.label, index === stage && styles.labelActive]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { marginTop: 16 },
  track: { backgroundColor: palette.leaf, borderRadius: 2, height: 4, left: '12.5%', position: 'absolute', right: '12.5%', top: DOT / 2 - 2 },
  fill: { backgroundColor: palette.forest, borderRadius: 2, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, transformOrigin: 'left center' },
  row: { flexDirection: 'row' },
  column: { alignItems: 'center', flex: 1, gap: 6 },
  dotBox: { alignItems: 'center', height: DOT, justifyContent: 'center', width: DOT },
  dot: { alignItems: 'center', borderRadius: DOT / 2, borderWidth: 2, height: DOT, justifyContent: 'center', width: DOT },
  core: { backgroundColor: palette.forest, borderRadius: 4, height: 8, position: 'absolute', width: 8 },
  check: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  pulse: { backgroundColor: palette.forest, borderRadius: DOT / 2, height: DOT, position: 'absolute', width: DOT },
  label: { color: palette.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  labelActive: { color: palette.forest, fontWeight: '800' },
}));
