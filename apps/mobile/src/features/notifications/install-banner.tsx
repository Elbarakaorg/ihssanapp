import { X } from 'lucide-react-native';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { canPromptInstall, isInstalledApp, onInstallStateChange, promptInstall } from '@/features/notifications/web-push';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { palette, rtlLayout, themedStyles, useScheme, wobble, glassSurface } from '@/ui/palette';

const DISMISSED_KEY = 'ihssan.installBannerDismissed';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

const snoozed = () => {
  try { return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) ?? 0) < SNOOZE_MS; } catch { return false; }
};

/** Web only: offers "Add to home screen" as soon as the browser says the app can be installed. */
export function InstallBanner({ hidden }: { hidden?: boolean }) {
  useScheme();
  const { locale } = useLocale();
  const path = usePathname();
  const [available, setAvailable] = useState(canPromptInstall());
  const [dismissed, setDismissed] = useState(snoozed());

  useEffect(() => onInstallStateChange(() => setAvailable(canPromptInstall())), []);

  if (Platform.OS !== 'web' || hidden || /^\/(auth|scan|share|account)(\/|$)/.test(path) || dismissed || !available || isInstalledApp()) return null;
  const rtl = locale === 'ar';
  const dismiss = () => { try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* private mode */ } setDismissed(true); };

  return (
    <View accessibilityRole="alert" style={[styles.banner, rtl && styles.rtl]}>
      <View style={styles.copy}>
        <Text style={[styles.title, rtl && styles.rtlText]}>{donationCopy(locale, 'pwa.installTitle')}</Text>
        <Text style={[styles.meta, rtl && styles.rtlText]}>{donationCopy(locale, 'pwa.installBody')}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => void promptInstall().then((outcome) => { if (outcome === 'dismissed') dismiss(); })} style={styles.action}>
        <Text style={styles.actionText}>{donationCopy(locale, 'pwa.installAction')}</Text>
      </Pressable>
      <Pressable accessibilityLabel={donationCopy(locale, 'pwa.later')} accessibilityRole="button" hitSlop={10} onPress={dismiss} style={styles.close}>
        <X color={palette.muted} size={18} />
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  banner: { ...wobble, ...glassSurface(), alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 10, marginHorizontal: 12, marginBottom: 8, padding: 12 },
  copy: { flex: 1, gap: 2 },
  title: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  action: { backgroundColor: palette.forest, borderRadius: 14, justifyContent: 'center', minHeight: 40, paddingHorizontal: 14 },
  actionText: { color: palette.white, fontSize: 13, fontWeight: '700' },
  close: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  rtl: { ...rtlLayout },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
}));
