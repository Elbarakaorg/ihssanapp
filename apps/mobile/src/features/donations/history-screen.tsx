import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/ui/loading';
import { Page, PageHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { listStoredPledges } from './donations-api';
import { formatMad } from './donations-logic';

type Order = Awaited<ReturnType<typeof listStoredPledges>>[number];

export default function DonationHistoryScreen() {
  useScheme();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useFocusEffect(useCallback(() => { void listStoredPledges().then(setOrders); }, []));

  return (
    <Page>
      <PageHeading eyebrow="Ihssan Giving" title="My donations">
        Orders you started on this device. Open one to see its status or add a receipt.
      </PageHeading>
      {orders === null ? <Loading /> : orders.length === 0 ? (
        <Text style={styles.muted}>You have not made a donation yet.</Text>
      ) : orders.map((order) => (
        <Pressable key={order.id} accessibilityRole="button" onPress={() => router.push(`/pledge/${order.id}` as Href)} style={({ pressed }) => [uiStyles.card, styles.order, pressed && styles.pressed]}>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.title}>{order.caseTitle}</Text>
            <Text style={styles.muted}>{order.reference} · {formatMad(order.amount)} · {new Date(order.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.open}>Open</Text>
        </Pressable>
      ))}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.88 },
  order: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 8, padding: 14 },
  title: { ...display, color: palette.ink, fontSize: 15 },
  open: { color: palette.forest, fontSize: 13, fontWeight: '700' },
}));
