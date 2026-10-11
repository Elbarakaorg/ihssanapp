import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Message } from '@/features/doctor/ui';
import { uiStyles } from '@/ui/patient-ui';
import { display, palette, rtlLayout, themedStyles, useScheme } from '@/ui/palette';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { type OpenOrder, cancelPledge, changePledgeAmount } from './donations-api';
import { formatMad, parseAmount, timeLeft, validateAmount } from './donations-logic';

/** An unfinished donation the donor can continue, re-amount or cancel; `onChange(null)` means it was cancelled. */
export function OpenOrderCard({ order, minDonation, onChange }: { order: OpenOrder; minDonation: number; onChange: (next: OpenOrder | null) => void }) {
  useScheme();
  const { locale } = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'amount' | 'cancel'>('view');
  const [amountText, setAmountText] = useState(String(order.amount_mad));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = timeLeft(order.expires_at, Date.now(), locale);

  const saveAmount = async () => {
    const amount = parseAmount(amountText);
    const problem = validateAmount(amount, minDonation, locale);
    if (problem || amount === null) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      await changePledgeAmount(order.id, amount);
      setMode('view');
      onChange({ ...order, amount_mad: amount });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the amount.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      await cancelPledge(order.id);
      onChange(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel this order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[uiStyles.card, styles.card, locale === 'ar' && styles.rtl]}>
      <Text style={[styles.title, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'order.unfinished')}</Text>
      <Text style={[styles.meta, locale === 'ar' && styles.rtlText]}>{formatMad(order.amount_mad, locale)} · {order.reference} · {left.label}</Text>

      {mode === 'amount' ? (
        <>
          <View style={styles.amountBox}>
            <TextInput accessibilityLabel={donationCopy(locale, 'order.amountInput')} keyboardType="number-pad" maxLength={9} onChangeText={setAmountText} placeholderTextColor={palette.muted} style={styles.amountInput} value={amountText} />
            <Text style={styles.currency}>MAD</Text>
          </View>
          <Button label={donationCopy(locale, 'order.saveAmount')} busy={busy} onPress={() => void saveAmount()} />
          <Pressable accessibilityRole="link" disabled={busy} onPress={() => { setMode('view'); setError(''); }} style={styles.link}>
            <Text style={styles.linkLabel}>{donationCopy(locale, 'order.keepAmount', { amount: formatMad(order.amount_mad, locale) })}</Text>
          </Pressable>
        </>
      ) : mode === 'cancel' ? (
        <>
          <Text style={[styles.meta, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'order.cancelWarning')}</Text>
          <Button tone="danger" label={donationCopy(locale, 'order.cancelConfirm')} busy={busy} onPress={() => void cancel()} />
          <Pressable accessibilityRole="link" disabled={busy} onPress={() => { setMode('view'); setError(''); }} style={styles.link}>
            <Text style={styles.linkLabel}>{donationCopy(locale, 'order.keep')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Button label={donationCopy(locale, 'order.continue')} onPress={() => router.push(`/pledge/${order.id}` as Href)} />
          <View style={styles.links}>
            <Pressable accessibilityRole="link" onPress={() => { setMode('amount'); setError(''); }} style={styles.link}>
              <Text style={styles.linkLabel}>{donationCopy(locale, 'order.change')}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => { setMode('cancel'); setError(''); }} style={styles.link}>
              <Text style={styles.cancelLabel}>{donationCopy(locale, 'order.cancel')}</Text>
            </Pressable>
          </View>
        </>
      )}
      {error ? <Message kind="error">{error}</Message> : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { gap: 4, marginTop: 14, padding: 16 },
  title: { ...display, color: palette.ink, fontSize: 18 },
  meta: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  amountBox: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginTop: 10, paddingHorizontal: 16 },
  amountInput: { ...display, color: palette.ink, flex: 1, fontSize: 28, minHeight: 56, outlineStyle: 'none' } as object,
  currency: { color: palette.muted, fontSize: 15, fontWeight: '700' },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { alignSelf: 'center', justifyContent: 'center', minHeight: 42, paddingHorizontal: 8 },
  linkLabel: { color: palette.forest, fontSize: 13, fontWeight: '600' },
  cancelLabel: { color: palette.coral, fontSize: 13, fontWeight: '600' },
  rtl: { ...rtlLayout },
  rtlText: { writingDirection: 'rtl', textAlign: 'right' },
}));
