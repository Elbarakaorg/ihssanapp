import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/ui/loading';
import { Page, PageHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { listStoredPledges } from './donations-api';
import { formatMad } from './donations-logic';

type Order = Awaited<ReturnType<typeof listStoredPledges>>[number];

export default function DonationHistoryScreen() {
  useScheme();
  const { locale } = useLocale();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useFocusEffect(useCallback(() => { void listStoredPledges().then(setOrders); }, []));

  return (
    <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}>
      <PageHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} eyebrow={donationCopy(locale, 'give.eyebrow')} title={donationCopy(locale, 'history.title')}>
        {donationCopy(locale, 'history.intro')}
      </PageHeading>
      {orders === null ? <Loading /> : orders.length === 0 ? (
        <Text style={[styles.muted, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'history.empty')}</Text>
      ) : orders.map((order) => (
        <Pressable key={order.id} accessibilityRole="button" onPress={() => router.push(`/pledge/${order.id}` as Href)} style={({ pressed }) => [uiStyles.card, styles.order, pressed && styles.pressed]}>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.title, locale === 'ar' && styles.rtlText]}>{order.caseTitle}</Text>
            <Text style={[styles.muted, locale === 'ar' && styles.rtlText]}>{order.reference} · {formatMad(order.amount, locale)} · {new Date(order.createdAt).toLocaleDateString(locale)}</Text>
          </View>
          <Text style={styles.open}>{donationCopy(locale, 'history.open')}</Text>
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
  rtlText: { writingDirection: 'rtl', textAlign: 'right' },
}));
