import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { Button, Message } from '@/features/doctor/ui';
import { canPromptInstall, disablePush, enablePush, getPushStatus, isInstalledApp, onInstallStateChange, promptInstall, sendTestPush } from '@/features/notifications/web-push';
import type { PushStatus } from '@/features/notifications/web-push-logic';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { palette, themedStyles, useScheme, wobble, glassSurface } from '@/ui/palette';

/** Web only: lets someone on Android Chrome install the site to the home screen and receive push notifications. */
export function InstallAndNotifyCard() {
  useScheme();
  const { locale } = useLocale();
  const { session } = useAuth();
  const [installable, setInstallable] = useState(canPromptInstall());
  const [installed] = useState(isInstalledApp());
  const [status, setStatus] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const rtl = locale === 'ar';

  useEffect(() => onInstallStateChange(() => setInstallable(canPromptInstall())), []);
  useEffect(() => { void getPushStatus().then(setStatus); }, [session]);

  const toggle = useCallback(async (next: boolean) => {
    setBusy(true); setMessage(null);
    try { setStatus(next ? await enablePush() : await disablePush()); } catch { setMessage({ kind: 'error', text: donationCopy(locale, 'pwa.notifyError') }); } finally { setBusy(false); }
  }, [locale]);

  const test = async () => {
    setBusy(true); setMessage(null);
    try { await sendTestPush(); setMessage({ kind: 'ok', text: donationCopy(locale, 'pwa.testSent') }); } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : donationCopy(locale, 'pwa.notifyError') }); } finally { setBusy(false); }
  };

  if (Platform.OS !== 'web') return null;
  return (
    <View style={[styles.card, rtl && styles.rtl]}>
      <Text style={[styles.title, rtl && styles.rtlText]}>{donationCopy(locale, 'pwa.installTitle')}</Text>
      {installed ? <Text style={[styles.meta, rtl && styles.rtlText]}>{donationCopy(locale, 'pwa.installed')}</Text> : (
        <>
          <Text style={[styles.meta, rtl && styles.rtlText]}>{donationCopy(locale, installable ? 'pwa.installBody' : 'pwa.installManual')}</Text>
          {installable ? <Button label={donationCopy(locale, 'pwa.installAction')} onPress={() => void promptInstall()} /> : null}
        </>
      )}

      <View style={styles.divider} />
      <View style={[styles.row, rtl && styles.rtl]}>
        <View style={styles.copy}>
          <Text style={[styles.title, rtl && styles.rtlText]}>{donationCopy(locale, 'pwa.notifyTitle')}</Text>
          <Text style={[styles.meta, rtl && styles.rtlText]}>{donationCopy(locale, status === 'denied' ? 'pwa.notifyDenied' : status === 'unsupported' ? 'pwa.notifyUnsupported' : !session ? 'pwa.notifySignIn' : 'pwa.notifyBody')}</Text>
        </View>
        <Switch accessibilityLabel={donationCopy(locale, 'pwa.notifyTitle')} disabled={busy || !session || status === 'unsupported' || status === 'denied'} onValueChange={(v) => void toggle(v)} trackColor={{ true: palette.forest }} value={status === 'on'} />
      </View>
      {status === 'on' && session ? <Button tone="secondary" label={donationCopy(locale, 'pwa.test')} busy={busy} onPress={() => void test()} /> : null}
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { ...wobble, ...glassSurface(), borderWidth: 1, gap: 8, marginTop: 14, padding: 14 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  copy: { flex: 1, gap: 2 },
  title: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  divider: { backgroundColor: palette.line, height: 1, marginVertical: 6 },
  rtl: { direction: 'rtl' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
}));
