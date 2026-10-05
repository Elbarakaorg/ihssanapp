import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { ThinkingOrb } from '@/ui/thinking-orb';
import type { OrbState } from '@/ui/thinking-orb-types';

export function Loading({ label, state = 'working', style, inline = false }: { label?: string; state?: OrbState; style?: StyleProp<ViewStyle>; inline?: boolean }) {
  const { height } = useWindowDimensions();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'} style={[styles.box, !inline && { minHeight: height * 0.6 }, style]}>
      <ThinkingOrb state={state} size={64} label={label} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 12, justifyContent: 'center', paddingVertical: 32 },
  label: { color: '#6b7280', fontSize: 14, textAlign: 'center' },
});
