import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { display } from '@/ui/palette';
import { PreferenceIcons } from '@/ui/preference-icons';

export const ink = {
  bg: '#14110E',
  panel: 'rgba(255,255,255,0.05)',
  edge: 'rgba(255,255,255,0.14)',
  text: '#EDE5D6',
  muted: '#A39A8B',
  faint: '#7A7166',
  accent: '#A5BD8F',
  error: '#EFA98E',
};

export function DarkAuthShell({ children, showBack = true }: PropsWithChildren<{ showBack?: boolean }>) {
  const router = useRouter();

  return (
    <View style={styles.canvas}>
      <LinearGradient colors={['rgba(169,130,47,0.35)', 'rgba(169,130,47,0)']} pointerEvents="none" style={styles.glow} />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            {showBack ? (
              <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.backButton}>
                <ArrowLeft color={ink.text} size={20} strokeWidth={1.8} />
              </Pressable>
            ) : <View style={styles.backButton} />}
            <PreferenceIcons tone="dark" />
          </View>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandText}>IHSSAN</Text>
          </View>
          <Text style={styles.preview}>Preview build · use fictional health information</Text>
          <Animated.View entering={FadeInDown.duration(380)}>{children}</Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: ink.bg, flex: 1 },
  safe: { flex: 1 },
  glow: { height: 340, left: 0, position: 'absolute', right: 0, top: 0 },
  content: { alignSelf: 'center', maxWidth: 480, paddingBottom: 48, paddingHorizontal: 24, paddingTop: 8, width: '100%' },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 28 },
  brandDot: { backgroundColor: ink.accent, borderRadius: 4, boxShadow: '0 0 12px rgba(165,189,143,0.7)', height: 8, width: 8 },
  brandText: { ...display, color: ink.text, fontSize: 15, letterSpacing: 4 },
  preview: { color: ink.faint, fontSize: 11, marginBottom: 36, marginTop: 8 },
});
