import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GivingVerseCard } from './giving-verse-card';
import { ThankYou } from './thank-you';
import { BackLink, Button, Field, Message } from '@/features/doctor/ui';
import { Loading } from '@/ui/loading';
import { Page, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { type PledgeView, cancelPledge, getPledge, markPledgePaid, pickAndSubmitReceipt } from './donations-api';
import { ACCOUNT_RECEIPT_NOTICE, RECEIPT_LIMIT, formatMad, groupAccountNumber, pledgeStatus, timeLeft } from './donations-logic';
import { CopyRow, StatusPill } from './donations-ui';

export default function PledgeScreen() {
  useScheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pledge, setPledge] = useState<PledgeView | null | undefined>(undefined);
  const [note, setNote] = useState('');
  const [payer, setPayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    if (!id) return;
    getPledge(id).then(setPledge).catch((e) => { setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load this order.' }); setPledge(null); });
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  if (pledge === undefined) return <Page><Loading label="Loading your order" /></Page>;
  if (!pledge) return <Page><BackLink href="/give" label="Giving" /><Message kind="error">{message?.text ?? 'This order was not found on this device.'}</Message></Page>;

  const status = pledgeStatus(pledge.status);
  const left = timeLeft(pledge.expires_at, now);
  const waiting = pledge.status === 'pledged';

  const upload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const count = await pickAndSubmitReceipt(pledge.id, RECEIPT_LIMIT - pledge.receipt_count, note, payer);
      if (count) { setMessage({ kind: 'ok', text: 'Receipt received. A fund collector will review it soon.' }); setThanks(true); }
      load();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not upload your receipt.' });
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (payer.trim().length < 2) { setMessage({ kind: 'error', text: 'Write the name of the account you paid from, so we can match your transfer.' }); return; }
    setBusy(true);
    setMessage(null);
    try {
      await markPledgePaid(pledge.id, payer, note);
      setMessage({ kind: 'ok', text: 'Thank you. A fund collector will check the transfer against the account name you gave.' });
      setThanks(true);
      load();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not mark this order as paid.' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try { await cancelPledge(pledge.id); load(); } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not cancel.' }); } finally { setBusy(false); }
  };

  return (
    <Page>
      <BackLink href="/give" label="Giving" />
      <View style={styles.summary}>
        <View style={styles.flex}>
          <Text style={styles.amount}>{formatMad(pledge.amount_mad)}</Text>
          <Text numberOfLines={1} style={styles.caseName}>{pledge.case_title} · {pledge.reference}</Text>
        </View>
        <View style={styles.summaryRight}>
          <StatusPill status={pledge.status} />
          {waiting ? <Text style={[styles.timer, left.expired && styles.timerOut]}>{left.label}</Text> : null}
        </View>
      </View>
      {pledge.review_note ? <Message kind="info">{pledge.review_note}</Message> : null}
      <ThankYou visible={thanks} onClose={() => setThanks(false)} />
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      {pledge.banks.length ? (
        <>
          <SectionHeading title="Send your transfer to" />
          {pledge.banks.map((bank) => (
            <View key={bank.id} style={[uiStyles.card, styles.bank]}>
              <Text style={styles.bankName}>{bank.bank_name}</Text>
              <CopyRow label="Account holder" value={bank.account_holder} />
              {bank.rib ? <CopyRow label="RIB (24 digits)" value={bank.rib} display={groupAccountNumber(bank.rib)} /> : null}
              {bank.account_number ? <CopyRow label="Account number" value={bank.account_number} display={groupAccountNumber(bank.account_number)} /> : null}
              <CopyRow label="Amount" value={String(pledge.amount_mad)} display={formatMad(pledge.amount_mad)} />
              <CopyRow label="Transfer reference" value={pledge.reference} />
              {bank.note ? <Text style={styles.hint}>{bank.note}</Text> : null}
            </View>
          ))}
          <Text style={styles.fine}>Add the reference to your transfer message if your bank allows it. Only send the exact amount you entered; keep the receipt.</Text>
        </>
      ) : null}

      {waiting || pledge.can_upload ? <GivingVerseCard /> : null}

      {pledge.can_upload ? (
        <>
          <SectionHeading title="Your receipt" detail={`${pledge.receipt_count} of ${RECEIPT_LIMIT} attached`} />
          <Message kind="info">{ACCOUNT_RECEIPT_NOTICE}</Message>
          <Field label="Name of the account you paid from" value={payer} onChangeText={setPayer} maxLength={80} placeholder={pledge.receipt_count ? 'Optional' : 'Required if you have no receipt'} />
          <Field label="Note for the collector (optional)" value={note} onChangeText={setNote} maxLength={300} multiline />
          <Button label={pledge.receipt_count ? 'Add another receipt' : 'Upload receipt'} busy={busy} disabled={pledge.receipt_count >= RECEIPT_LIMIT} onPress={() => void upload()} />
          {pledge.can_mark_paid && pledge.receipt_count === 0 ? <Button tone="secondary" label="I paid but have no receipt" busy={busy} onPress={() => void markPaid()} /> : null}
        </>
      ) : null}
      <Text style={styles.hint}>{status.hint}</Text>
      {pledge.payer_name ? <Text style={styles.hint}>Paid from the account of: {pledge.payer_name}</Text> : null}
      {waiting ? <Button tone="secondary" label="Cancel this order" disabled={busy} onPress={() => void cancel()} /> : null}
      <Button tone="secondary" label="Back to the case" onPress={() => router.push(`/cases/${pledge.case_slug ?? pledge.case_id}` as Href)} />
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  summary: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  summaryRight: { alignItems: 'flex-end', gap: 4 },
  amount: { ...display, color: palette.ink, fontSize: 30, lineHeight: 36 },
  caseName: { color: palette.muted, fontSize: 12 },
  timer: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  timerOut: { color: palette.coral },
  hint: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  bank: { gap: 8, marginTop: 8, padding: 16 },
  bankName: { ...display, color: palette.ink, fontSize: 18 },
  fine: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 10 },
}));
