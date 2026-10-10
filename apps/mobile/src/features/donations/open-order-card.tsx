import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Message } from '@/features/doctor/ui';
import { uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { type OpenOrder, cancelPledge, changePledgeAmount } from './donations-api';
import { formatMad, parseAmount, timeLeft, validateAmount } from './donations-logic';

/** An unfinished donation the donor can continue, re-amount or cancel; `onChange(null)` means it was cancelled. */
export function OpenOrderCard({ order, minDonation, onChange }: { order: OpenOrder; minDonation: number; onChange: (next: OpenOrder | null) => void }) {
  useScheme();
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'amount' | 'cancel'>('view');
  const [amountText, setAmountText] = useState(String(order.amount_mad));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = timeLeft(order.expires_at);

  const saveAmount = async () => {
    const amount = parseAmount(amountText);
    const problem = validateAmount(amount, minDonation);
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
    <View style={[uiStyles.card, styles.card]}>
      <Text style={styles.title}>You have an unfinished donation</Text>
      <Text style={styles.meta}>{formatMad(order.amount_mad)} · {order.reference} · {left.label}</Text>

      {mode === 'amount' ? (
        <>
          <View style={styles.amountBox}>
            <TextInput accessibilityLabel="New amount in MAD" keyboardType="number-pad" maxLength={9} onChangeText={setAmountText} placeholderTextColor={palette.muted} style={styles.amountInput} value={amountText} />
            <Text style={styles.currency}>MAD</Text>
          </View>
          <Button label="Save amount" busy={busy} onPress={() => void saveAmount()} />
          <Pressable accessibilityRole="link" disabled={busy} onPress={() => { setMode('view'); setError(''); }} style={styles.link}>
            <Text style={styles.linkLabel}>Keep {formatMad(order.amount_mad)}</Text>
          </Pressable>
        </>
      ) : mode === 'cancel' ? (
        <>
          <Text style={styles.meta}>If you already sent the money, do not cancel. Continue and add your receipt instead.</Text>
          <Button tone="danger" label="Yes, cancel this order" busy={busy} onPress={() => void cancel()} />
          <Pressable accessibilityRole="link" disabled={busy} onPress={() => { setMode('view'); setError(''); }} style={styles.link}>
            <Text style={styles.linkLabel}>Keep my order</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Button label="Continue my donation" onPress={() => router.push(`/pledge/${order.id}` as Href)} />
          <View style={styles.links}>
            <Pressable accessibilityRole="link" onPress={() => { setMode('amount'); setError(''); }} style={styles.link}>
              <Text style={styles.linkLabel}>Change amount</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => { setMode('cancel'); setError(''); }} style={styles.link}>
              <Text style={styles.cancelLabel}>Cancel order</Text>
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
}));
