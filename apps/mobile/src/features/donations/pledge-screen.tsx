import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GivingVerseCard } from './giving-verse-card';
import { OrderGuide } from './order-guide';
import { GuideFab } from './order-guide-fab';
import { OrderProgress } from './order-progress';
import { WaitingCard } from './order-waiting-card';
import { ThankYou } from './thank-you';
import { BackLink, Button, Field, Message } from '@/features/doctor/ui';
import { Loading } from '@/ui/loading';
import { Page, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { type PledgeView, cancelPledge, getPledge, markPledgePaid, pickAndSubmitReceipt } from './donations-api';
import { RECEIPT_LIMIT, formatMad, groupAccountNumber, orderStage, pledgeStatus, timeLeft } from './donations-logic';
import { CopyRow, StatusPill } from './donations-ui';

export default function PledgeScreen() {
  useScheme();
  const { locale } = useLocale();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pledge, setPledge] = useState<PledgeView | null | undefined>(undefined);
  const [payer, setPayer] = useState('');
  const [noReceipt, setNoReceipt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    if (!id) return;
    getPledge(id).then(setPledge).catch((e) => { setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load this order.' }); setPledge(null); });
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  const orderId = pledge?.id;
  const needsTransfer = pledge?.status === 'pledged' && pledge.receipt_count === 0;
  const guideShown = useRef(false);
  useEffect(() => {
    if (!orderId || !needsTransfer || guideShown.current) return;
    guideShown.current = true;
    setGuideOpen(true);
  }, [orderId, needsTransfer]);

  if (pledge === undefined) return <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}><Loading label={donationCopy(locale, 'pledge.loading')} /></Page>;
  if (!pledge) return <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}><BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href="/give" label={donationCopy(locale, 'case.giving')} /><Message kind="error">{message?.text ?? donationCopy(locale, 'pledge.notFound')}</Message></Page>;

  const status = pledgeStatus(pledge.status, locale);
  const left = timeLeft(pledge.expires_at, now, locale);
  const waiting = pledge.status === 'pledged';
  const hasReceipt = pledge.receipt_count > 0;
  const receiptMessage = pledge.status === 'confirmed'
    ? donationCopy(locale, 'pledge.receiptConfirmed')
    : pledge.status === 'receipt_submitted'
      ? donationCopy(locale, 'pledge.receiptPending')
      : status.hint || donationCopy(locale, 'pledge.reviewFallback');
  const caseHref = `/cases/${pledge.case_slug ?? pledge.case_id}` as Href;
  const stage = orderStage(pledge.status);

  const upload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const count = await pickAndSubmitReceipt(pledge.id, RECEIPT_LIMIT - pledge.receipt_count);
      if (count) { setMessage({ kind: 'ok', text: donationCopy(locale, 'pledge.uploadingReview') }); setThanks(true); }
      load();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : donationCopy(locale, 'pledge.uploadError') });
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (payer.trim().length < 2) { setMessage({ kind: 'error', text: donationCopy(locale, 'pledge.payerRequired') }); return; }
    setBusy(true);
    setMessage(null);
    try {
      await markPledgePaid(pledge.id, payer);
      setMessage({ kind: 'ok', text: donationCopy(locale, 'pledge.noReceiptThanks') });
      setThanks(true);
      load();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : donationCopy(locale, 'pledge.markPaidError') });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try { await cancelPledge(pledge.id); load(); } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : donationCopy(locale, 'pledge.cancelError') }); } finally { setBusy(false); }
  };

  return (
    <>
    <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}>
      <BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href="/give" label={donationCopy(locale, 'case.giving')} />
      <View style={[styles.summary, locale === 'ar' && styles.rtl]}>
        <View style={styles.flex}>
          <Text style={[styles.amount, locale === 'ar' && styles.rtlText]}>{formatMad(pledge.amount_mad, locale)}</Text>
          <Text numberOfLines={1} style={[styles.caseName, locale === 'ar' && styles.rtlText]}>{pledge.case_title} · {pledge.reference}</Text>
        </View>
        <View style={styles.summaryRight}>
          <StatusPill status={pledge.status} />
          {waiting ? <Text style={[styles.timer, left.expired && styles.timerOut]}>{left.label}</Text> : null}
        </View>
      </View>
      {stage !== null ? <OrderProgress stage={stage} /> : null}
      {needsTransfer ? <WaitingCard phase="transfer" /> : pledge.status === 'receipt_submitted' ? <WaitingCard phase="review" /> : null}
      {pledge.review_note ? <Message kind="info">{pledge.review_note}</Message> : null}
      <ThankYou visible={thanks} onClose={() => setThanks(false)} />
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      {pledge.banks.length ? (
        <>
          <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'pledge.sendTransfer')} />
          {pledge.banks.map((bank) => (
            <View key={bank.id} style={[uiStyles.card, styles.bank]}>
              <Text style={styles.bankName}>{bank.bank_name}</Text>
              <CopyRow label={donationCopy(locale, 'bank.holder')} value={bank.account_holder} />
              {bank.rib ? <CopyRow label={donationCopy(locale, 'bank.rib')} value={bank.rib} display={groupAccountNumber(bank.rib)} /> : null}
              {bank.account_number ? <CopyRow label={donationCopy(locale, 'bank.account')} value={bank.account_number} display={groupAccountNumber(bank.account_number)} /> : null}
              <CopyRow label={donationCopy(locale, 'donate.amount')} value={String(pledge.amount_mad)} display={formatMad(pledge.amount_mad, locale)} />
              <CopyRow label={donationCopy(locale, 'bank.reference')} value={pledge.reference} />
              {bank.note ? <Text style={styles.hint}>{bank.note}</Text> : null}
            </View>
          ))}
          <Text style={[styles.fine, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'pledge.referenceHint')}</Text>
        </>
      ) : null}

      {waiting || pledge.can_upload ? <GivingVerseCard /> : null}

      {hasReceipt ? (
        <View style={styles.receiptComplete}>
          <Message kind={pledge.status === 'rejected' || pledge.status === 'reversed' ? 'info' : 'ok'}>{receiptMessage}</Message>
          <Button label={donationCopy(locale, 'pledge.donateAgain')} onPress={() => router.push(caseHref)} />
        </View>
      ) : pledge.can_upload ? (
        <>
          {noReceipt ? (
            <>
              <Field label={donationCopy(locale, 'pledge.accountName')} direction={locale === 'ar' ? 'rtl' : 'ltr'} value={payer} onChangeText={setPayer} maxLength={80} placeholder={donationCopy(locale, 'pledge.accountNamePlaceholder')} autoCapitalize="words" />
              <Button label={donationCopy(locale, 'pledge.confirmDonation')} busy={busy} onPress={() => void markPaid()} />
              <Text style={[styles.fine, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'pledge.collectorMatch')}</Text>
              <Pressable accessibilityRole="link" disabled={busy} onPress={() => setNoReceipt(false)} style={styles.textAction}>
                <Text style={styles.textActionLabel}>{donationCopy(locale, 'pledge.uploadInstead')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Button label={pledge.receipt_count >= RECEIPT_LIMIT ? donationCopy(locale, 'pledge.receiptLimit') : pledge.receipt_count ? donationCopy(locale, 'pledge.uploadAgain') : donationCopy(locale, 'pledge.uploadConfirm')} busy={busy} disabled={pledge.receipt_count >= RECEIPT_LIMIT} onPress={() => void upload()} />
              {pledge.can_mark_paid && pledge.receipt_count === 0 ? (
                <Pressable accessibilityRole="link" disabled={busy} onPress={() => { setMessage(null); setNoReceipt(true); }} style={styles.textAction}>
                  <Text style={styles.textActionLabel}>{donationCopy(locale, 'pledge.noReceipt')}</Text>
                </Pressable>
              ) : null}
              <Text style={[styles.fine, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'pledge.reviewReceipt')}</Text>
            </>
          )}
        </>
      ) : null}
      {!hasReceipt ? <Text style={styles.hint}>{status.hint}</Text> : null}
      {pledge.payer_name ? <Text style={[styles.hint, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'pledge.paidFrom', { name: pledge.payer_name })}</Text> : null}
      <View style={[styles.footerActions, locale === 'ar' && styles.rtl]}>
        <Pressable accessibilityLabel={donationCopy(locale, 'pledge.returnCaseLabel')} accessibilityRole="link" onPress={() => router.push(caseHref)} style={styles.returnLink}>
          {locale === 'ar' ? <ArrowRight color={palette.forest} size={17} /> : <ArrowLeft color={palette.forest} size={17} />}
          <Text style={styles.textActionLabel}>{donationCopy(locale, 'pledge.returnCase')}</Text>
        </Pressable>
        {waiting ? (
          <Pressable accessibilityRole="link" disabled={busy} onPress={() => void cancel()} style={styles.cancelLink}>
            <Text style={styles.cancelLabel}>{donationCopy(locale, 'pledge.cancelDonation')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Page>
    {needsTransfer ? <GuideFab onPress={() => setGuideOpen(true)} /> : null}
    <OrderGuide onClose={() => setGuideOpen(false)} visible={guideOpen} />
    </>
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
  textAction: { alignSelf: 'center', minHeight: 42, justifyContent: 'center', paddingHorizontal: 8 },
  textActionLabel: { color: palette.forest, fontSize: 13, fontWeight: '600' },
  footerActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, minHeight: 44 },
  returnLink: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 44, paddingRight: 8 },
  cancelLink: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingLeft: 8 },
  cancelLabel: { color: palette.coral, fontSize: 13, fontWeight: '600' },
  bank: { gap: 8, marginTop: 8, padding: 16 },
  bankName: { ...display, color: palette.ink, fontSize: 18 },
  fine: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  receiptComplete: { gap: 8, marginTop: 8 },
  rtlText: { writingDirection: 'rtl', textAlign: 'right' },
  rtl: { direction: 'rtl' },
}));
