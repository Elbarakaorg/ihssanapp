import { Pressable, StyleSheet, Text, View } from 'react-native';

import { devDataModes, setDevDataMode, useDevDataMode } from '@/features/medicine/dev-data';

/** Dev-only. Rendered behind `__DEV__` by its caller. */
export function DevDataToggle() {
  const mode = useDevDataMode();
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {devDataModes.map((m) => (
        <Pressable key={m.id} accessibilityRole="tab" accessibilityState={{ selected: mode === m.id }} onPress={() => setDevDataMode(m.id)} style={[styles.seg, mode === m.id && styles.on]}>
          <Text style={styles.label}>{m.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: '#8883', borderRadius: 10, flexDirection: 'row', marginBottom: 12, padding: 3 },
  seg: { alignItems: 'center', borderRadius: 8, flex: 1, minHeight: 32, justifyContent: 'center' },
  on: { backgroundColor: '#fff' },
  label: { color: '#333', fontSize: 11, fontWeight: '600' },
});
