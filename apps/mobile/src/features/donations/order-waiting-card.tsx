import { StyleSheet, Text, View } from 'react-native';

import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { ThinkingOrb } from '@/ui/thinking-orb';

/** Shows that the order is waiting on someone: first the donor's transfer, then the collector's check. */
export function WaitingCard({ phase }: { phase: 'transfer' | 'review' }) {
  useScheme();
  const transfer = phase === 'transfer';
  return (
    <View accessibilityLabel={transfer ? 'Waiting for your transfer' : 'Waiting for confirmation'} accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={styles.card}>
      <ThinkingOrb label={transfer ? 'Waiting for your transfer' : 'Waiting for confirmation'} size={64} state={transfer ? 'breathing' : 'working'} />
      <View style={styles.copy}>
        <Text style={styles.title}>{transfer ? 'Waiting for your transfer' : 'Waiting for confirmation'}</Text>
        <Text style={styles.body}>
          {transfer
            ? 'Send the transfer from your bank app, then confirm it below. We will count your donation once it is checked.'
            : 'Thank you. A fund collector is checking your transfer. You do not need to do anything else.'}
        </Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: palette.leaf, borderColor: palette.leafDeep, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 14, marginTop: 16, padding: 14 },
  copy: { flex: 1, gap: 4 },
  title: { ...display, color: palette.ink, fontSize: 17 },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
}));
