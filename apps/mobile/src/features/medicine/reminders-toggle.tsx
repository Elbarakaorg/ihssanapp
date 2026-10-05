import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Message } from '@/features/doctor/ui';
import { remindersEnabled, remindersSupported, setReminders } from '@/features/medicine/reminders';
import type { Treatment } from '@/features/medicine/schedule';
import { palette, themedStyles, useScheme, wobble } from '@/ui/palette';

export function RemindersToggle({ treatments }: { treatments: Treatment[] }) {
  useScheme();
  const [on, setOn] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { void remindersEnabled().then(setOn); }, []);
  if (!remindersSupported) return <Message kind="info">Dose reminders work in the Ihssan mobile app.</Message>;

  const toggle = async (next: boolean) => {
    setMessage('');
    try {
      const ok = await setReminders(next, treatments);
      setOn(next && ok);
      if (next && !ok) setMessage('Notifications are turned off for Ihssan. Allow them in your phone settings to get reminders.');
    } catch { setMessage('Could not change reminders. Try again.'); }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>Dose reminders</Text>
          <Text style={styles.meta}>A notification at each scheduled dose time. Reminders are planned a week ahead each time you open the app.</Text>
        </View>
        <Switch accessibilityLabel="Dose reminders" onValueChange={(v) => void toggle(v)} trackColor={{ true: palette.forest }} value={on} />
      </View>
      {message ? <Text style={styles.warn}>{message}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { ...wobble, backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, gap: 8, marginTop: 12, padding: 14 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  copy: { flex: 1, gap: 2 },
  title: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  warn: { color: palette.coral, fontSize: 12, fontWeight: '600' },
}));
