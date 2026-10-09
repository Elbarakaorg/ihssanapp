import * as Haptics from 'expo-haptics';
import { type Href, usePathname, useRouter } from 'expo-router';
import { Activity, Compass, HeartHandshake, House, type LucideIcon, Menu } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RightDrawer } from '@/features/navigation/right-drawer';
import { palette, themedStyles, useScheme } from '@/ui/palette';

type Item = { key: string; label: string; href: Href; Icon: LucideIcon; match: (path: string) => boolean };

const ITEMS: Item[] = [
  { key: 'home', label: 'Home', href: '/' as Href, Icon: House, match: (p) => p === '/' || p === '/index' },
  { key: 'health', label: 'Health', href: '/health' as Href, Icon: Activity, match: (p) => /^\/(health|medicines|treatments|metrics|measurement|activity|appointments|my-patients)/.test(p) },
  { key: 'discover', label: 'Discover', href: '/discover' as Href, Icon: Compass, match: (p) => /^\/(discover|doctors|doctor-profile|articles|blogs|practice-locations|verses)/.test(p) },
  { key: 'give', label: 'Give', href: '/give' as Href, Icon: HeartHandshake, match: (p) => /^\/(give|cases|pledge|collect|my-donations)/.test(p) },
];

// Full-screen flows where a persistent bar would get in the way.
const HIDDEN = /^\/(auth|scan|share|account)(\/|$)/;

/** The one bottom bar for the whole app, rendered by the root layout so it shows on every page. */
export function AppTabBar() {
  useScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (HIDDEN.test(path) || keyboard) return null;
  const tap = () => { if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  return (
    <>
      <View style={[styles.bar, { height: 58 + insets.bottom, paddingBottom: insets.bottom }]}>
        {ITEMS.map(({ key, label, href, Icon, match }) => {
          const active = match(path);
          return (
            <Pressable key={key} accessibilityLabel={label} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { tap(); router.navigate(href); }} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <Icon color={active ? palette.forest : palette.muted} size={20} strokeWidth={active ? 2.1 : 1.8} />
              <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
        <Pressable accessibilityLabel="Menu" accessibilityRole="button" onPress={() => { tap(); setMenuOpen(true); }} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <Menu color={menuOpen ? palette.forest : palette.muted} size={20} strokeWidth={1.8} />
          <Text style={[styles.label, menuOpen && styles.labelActive]}>Menu</Text>
        </Pressable>
      </View>
      <RightDrawer onClose={() => setMenuOpen(false)} visible={menuOpen} />
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  bar: {
    backgroundColor: palette.glass,
    borderTopColor: palette.glassEdge,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px) saturate(1.15)', WebkitBackdropFilter: 'blur(16px) saturate(1.15)' } as object) : null),
  },
  item: { alignItems: 'center', flex: 1, gap: 3, justifyContent: 'center', paddingTop: 5 },
  pressed: { opacity: 0.7 },
  label: { color: palette.muted, fontSize: 10, fontWeight: '600' },
  labelActive: { color: palette.forest },
}));
