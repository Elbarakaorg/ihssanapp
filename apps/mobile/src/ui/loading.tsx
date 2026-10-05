import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThinkingOrb } from '@/ui/thinking-orb';
import type { OrbState } from '@/ui/thinking-orb-types';

export function Loading({ label, state = 'working', style }: { label?: string; state?: OrbState; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'} style={[styles.box, style]}>
      <ThinkingOrb state={state} size={64} label={label} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 12, justifyContent: 'center', paddingVertical: 32 },
  label: { color: '#6b7280', fontSize: 14, textAlign: 'center' },
});
