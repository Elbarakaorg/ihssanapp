import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { BackLink, Button, Chip, Field, Message } from '@/features/doctor/ui';
import { Loading } from '@/ui/loading';
import { Ornament, Page, PageHeading, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { type AppLocale, useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { type CaseComment, addExternalDonation, type CollectorCase, type ReviewPledge, acceptCollectorInvite, bulkReviewComments, listCasePledges, listCaseComments, listCollectorCases, receiptUrl, reviewPledge } from './donations-api';
import { formatMad, parseAmount } from './donations-logic';
import { Progress, StatusPill } from './donations-ui';

const PENDING_INVITE = 'ihssan.pendingInvite.v1';

export function CollectHome() {
  useScheme();
  const { locale } = useLocale();
  const router = useRouter();
  const [cases, setCases] = useState<CollectorCase[] | null>(null);
  const [error, setError] = useState('');
  const { session } = useAuth();
  useEffect(() => {
    if (!session) return;
    void AsyncStorage.getItem(PENDING_INVITE).then(async (token) => {
      if (!token) return;
      await AsyncStorage.removeItem(PENDING_INVITE);
      try { const r = await acceptCollectorInvite(token); router.replace(`/collect/${r.case_id}` as Href); } catch (e) { setError(e instanceof Error ? e.message : donationCopy(locale, 'collect.inviteExpired')); }
    });
  }, [session, router, locale]);
  useEffect(() => { listCollectorCases().then(setCases).catch((e) => { setError(e instanceof Error ? e.message : donationCopy(locale, 'collect.loadError')); setCases([]); }); }, [locale]);
  return (
    <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}>
      <BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href="/give" label={donationCopy(locale, 'collect.giving')} />
      <PageHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} eyebrow={donationCopy(locale, 'collect.eyebrow')} title={donationCopy(locale, 'collect.title')}>{donationCopy(locale, 'collect.description')}</PageHeading>
      {error ? <Message kind="error">{error}</Message> : null}
      {cases === null ? <Loading label={donationCopy(locale, 'collect.loading')} /> : null}
      {cases?.length === 0 && !error ? <Text style={styles.muted}>{donationCopy(locale, 'collect.empty')}</Text> : null}
      {cases?.map((c) => (
        <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/collect/${c.id}` as Href)} style={[uiStyles.card, styles.card]}>
          <Text style={styles.title}>{c.title}</Text>
          <Progress raised={c.raised_mad} goal={c.goal_mad} donors={c.donor_count} />
          {c.role !== 'beneficiary' && c.awaiting_review > 0 ? <Text style={styles.badge}>{donationCopy(locale, 'collect.awaitingReview', { count: c.awaiting_review })}</Text> : null}
          {(c.pending_comments ?? 0) > 0 ? <Text style={styles.badge}>{pendingCommentCopy(locale, c.pending_comments ?? 0)}</Text> : null}
          {c.role === 'beneficiary' || (c.awaiting_review === 0 && !(c.pending_comments ?? 0)) ? <Text style={styles.muted}>{donationCopy(locale, c.role === 'beneficiary' ? 'collect.yourCase' : 'collect.nothingWaiting')}</Text> : null}
        </Pressable>
      ))}
    </Page>
  );
}

const TABS = [['receipt_submitted', 'collect.tabAwaiting'], ['pledged', 'collect.tabTransfer'], ['confirmed', 'collect.tabConfirmed'], ['rejected', 'collect.tabRejected']] as const;

function pendingCommentCopy(locale: AppLocale, count: number) {
  const key = locale !== 'ar'
    ? count === 1 ? 'collect.commentsOne' : 'collect.commentsMany'
    : count === 1 ? 'collect.commentsOne' : count === 2 ? 'collect.commentsTwo' : count <= 10 ? 'collect.commentsFew' : 'collect.commentsMany';
  return donationCopy(locale, key, { count });
}

function Receipts({ paths }: { paths: string[] }) {
  const { locale } = useLocale();
  const [urls, setUrls] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { void Promise.all(paths.map(receiptUrl)).then((all) => setUrls(all.filter((u): u is string => !!u))); }, [paths]);
  return (
    <View style={styles.receipts}>
      {urls.map((u, i) => (
        <Pressable key={u} accessibilityLabel={donationCopy(locale, 'receipt.view', { number: i + 1 })} accessibilityRole="button" onPress={() => setOpen(u)} style={styles.receiptWrap}>
          <Image accessibilityLabel={donationCopy(locale, 'receipt.image')} accessibilityIgnoresInvertColors source={{ uri: u }} style={styles.receipt} resizeMode="cover" />
          <Text style={styles.viewLink}>{donationCopy(locale, 'receipt.label')}</Text>
        </Pressable>
      ))}
      <Modal animationType="fade" onRequestClose={() => setOpen(null)} transparent visible={open !== null}>
        <Pressable accessibilityLabel={donationCopy(locale, 'receipt.close')} onPress={() => setOpen(null)} style={styles.lightbox}>
          {open ? <Image accessibilityLabel={donationCopy(locale, 'receipt.image')} source={{ uri: open }} style={styles.lightboxImage} resizeMode="contain" /> : null}
          <Text style={styles.lightboxClose}>{donationCopy(locale, 'receipt.closeHint')}</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

function ExternalForm({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return <Button tone="secondary" label={donationCopy(locale, 'collect.outsideAction')} onPress={() => setOpen(true)} />;
  const save = async () => {
    const value = parseAmount(amount);
    if (value === null) { setError(donationCopy(locale, 'collect.amountError')); return; }
    if (!anonymous && name.trim().length < 2) { setError(donationCopy(locale, 'collect.nameError')); return; }
    setBusy(true); setError('');
    try {
      await addExternalDonation({ caseId, amount: value, donorName: name, anonymous, receivedOn: new Date().toISOString().slice(0, 10), note, comment: '' });
      setOpen(false); setAmount(''); setName(''); setNote(''); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : donationCopy(locale, 'collect.recordError')); } finally { setBusy(false); }
  };
  return (
    <View style={[uiStyles.card, styles.card]}>
      <Text style={styles.title}>{donationCopy(locale, 'collect.outsideTitle')}</Text>
      <Text style={styles.muted}>{donationCopy(locale, 'collect.outsideDescription')}</Text>
      <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'collect.amountReceived')} value={amount} onChangeText={setAmount} keyboardType="number-pad" maxLength={9} />
      <Chip label={donationCopy(locale, 'collect.anonymousDonor')} selected={anonymous} onPress={() => setAnonymous(!anonymous)} />
      {anonymous ? null : <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'collect.donorName')} value={name} onChangeText={setName} maxLength={60} />}
      <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'collect.internalNote')} value={note} onChangeText={setNote} maxLength={300} />
      {error ? <Message kind="error">{error}</Message> : null}
      <Button label={donationCopy(locale, 'collect.addDonation')} busy={busy} onPress={() => void save()} />
      <Button tone="secondary" label={donationCopy(locale, 'collect.cancel')} disabled={busy} onPress={() => setOpen(false)} />
    </View>
  );
}

function PledgeRow({ pledge, onChanged }: { pledge: ReviewPledge; onChanged: () => void }) {
  const { locale } = useLocale();
  const [amount, setAmount] = useState(String(pledge.amount_mad));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const decide = async (decision: 'confirm' | 'reject') => {
    const value = parseAmount(amount);
    if (decision === 'confirm' && value === null) { setError(donationCopy(locale, 'collect.amountReachedError')); return; }
    if (decision === 'reject' && reason.trim().length < 3) { setError(donationCopy(locale, 'collect.rejectReasonError')); return; }
    setBusy(true); setError('');
    try { await reviewPledge({ id: pledge.id, decision, amount: value ?? undefined, note: reason }); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : donationCopy(locale, 'collect.saveError')); setBusy(false); }
  };
  const actionable = pledge.status === 'receipt_submitted' || pledge.status === 'pledged' || pledge.status === 'expired';
  return (
    <View style={[uiStyles.card, styles.card]}>
      <View style={styles.row}><Text style={styles.title}>{formatMad(pledge.amount_mad, locale)}</Text><StatusPill status={pledge.status} /></View>
      {pledge.source === 'external' ? <Text style={styles.badge}>{donationCopy(locale, 'collect.externalBadge')}{pledge.received_on ? ` · ${pledge.received_on}` : ''}</Text> : null}
      {pledge.payer_name ? <Text style={styles.body}>{donationCopy(locale, 'collect.paidFrom', { name: pledge.payer_name })}{pledge.receipt_paths.length === 0 ? ` ${donationCopy(locale, 'collect.noReceipt')}` : ''}</Text> : null}
      <Text style={styles.muted}>{pledge.reference} · {pledge.is_anonymous ? donationCopy(locale, 'collect.anonymous') : pledge.display_name}</Text>
      {pledge.donor_contact ? <Text style={styles.muted}>{donationCopy(locale, 'collect.contact', { contact: pledge.donor_contact })}</Text> : null}
      {pledge.comment ? <Text style={styles.body}>“{pledge.comment}”</Text> : null}
      {pledge.receipt_note ? <Text style={styles.muted}>{donationCopy(locale, 'collect.donorNote', { note: pledge.receipt_note })}</Text> : null}
      {pledge.receipt_paths.length ? <Receipts paths={pledge.receipt_paths} /> : null}
      {pledge.review_note ? <Text style={styles.muted}>{donationCopy(locale, 'collect.note', { note: pledge.review_note })}</Text> : null}
      {actionable ? (
        <>
          <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'collect.amountReceived')} value={amount} onChangeText={setAmount} keyboardType="number-pad" maxLength={9} />
          <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'collect.reasonReject')} value={reason} onChangeText={setReason} maxLength={200} />
          {error ? <Message kind="error">{error}</Message> : null}
          <Button label={donationCopy(locale, 'collect.confirmReceived')} busy={busy} onPress={() => void decide('confirm')} />
          <Button tone="danger" label={donationCopy(locale, 'collect.reject')} disabled={busy} onPress={() => void decide('reject')} />
        </>
      ) : null}
    </View>
  );
}

function Comments({ caseId }: { caseId: string }) {
  const { locale } = useLocale();
  const [rows, setRows] = useState<CaseComment[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setRows(null); setPicked([]);
    listCaseComments(caseId, 'pending').then(setRows).catch((e) => { setError(e instanceof Error ? e.message : donationCopy(locale, 'collect.loadError')); setRows([]); });
  }, [caseId, locale]);
  useEffect(load, [load]);
  const decide = async (ids: string[], decision: 'approve' | 'hide') => {
    if (!ids.length) return;
    setBusy(true); setError('');
    try { await bulkReviewComments(ids, decision); load(); } catch (e) { setError(e instanceof Error ? e.message : donationCopy(locale, 'collect.saveError')); } finally { setBusy(false); }
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <>
      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'collect.commentsTitle')} />
      <Text style={styles.muted}>{donationCopy(locale, 'collect.commentsPrivacy')}</Text>
      {error ? <Message kind="error">{error}</Message> : null}
      {rows === null ? <Loading label={donationCopy(locale, 'collect.loading')} /> : null}
      {rows?.length === 0 && !error ? <Text style={styles.muted}>{donationCopy(locale, 'collect.noComments')}</Text> : null}
      {rows && rows.length > 0 ? (
        <>
          <Button label={donationCopy(locale, picked.length === rows.length ? 'collect.clearSelection' : 'collect.selectAll')} tone="secondary" onPress={() => setPicked(picked.length === rows.length ? [] : rows.map((r) => r.id))} />
          {picked.length > 0 ? (
            <>
              <Button label={donationCopy(locale, 'collect.approveSelected', { count: picked.length })} busy={busy} onPress={() => void decide(picked, 'approve')} />
              <Button label={donationCopy(locale, 'collect.hideSelected', { count: picked.length })} tone="danger" disabled={busy} onPress={() => void decide(picked, 'hide')} />
            </>
          ) : null}
        </>
      ) : null}
      {rows?.map((c) => (
        <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: picked.includes(c.id) }} onPress={() => toggle(c.id)} style={[uiStyles.card, styles.card, picked.includes(c.id) && styles.picked]}>
          <Text style={styles.muted}>{c.is_anonymous || !c.display_name ? donationCopy(locale, 'collect.anonymous') : c.display_name} · {c.kind === 'wish' || c.amount_mad === null ? donationCopy(locale, 'collect.wellWish') : formatMad(c.amount_mad, locale)}</Text>
          <Text style={styles.body}>“{c.comment}”</Text>
        </Pressable>
      ))}
    </>
  );
}

export function CollectCase() {
  useScheme();
  const { locale } = useLocale();
  const router = useRouter();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const [tab, setTab] = useState('receipt_submitted');
  const [role, setRole] = useState<CollectorCase['role'] | null>(null);
  const [rows, setRows] = useState<ReviewPledge[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (caseId) void listCollectorCases().then((all) => setRole(all.find((c) => c.id === caseId)?.role ?? 'collector')).catch(() => setRole('collector')); }, [caseId]);
  const isBeneficiary = role === 'beneficiary';
  const load = useCallback(() => {
    if (!caseId || role === null || role === 'beneficiary') return;
    setRows(null); setError('');
    listCasePledges(caseId, tab).then(setRows).catch((e) => { setError(e instanceof Error ? e.message : 'Could not load.'); setRows([]); });
  }, [caseId, tab, role]);
  useEffect(load, [load]);
  return (
    <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}>
      <BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href={'/collect' as Href} label={donationCopy(locale, 'collect.yourCases')} />
      <PageHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} eyebrow={donationCopy(locale, 'collect.eyebrow')} title={donationCopy(locale, isBeneficiary ? 'collect.beneficiaryTitle' : 'collect.collectorTitle')}>{donationCopy(locale, isBeneficiary ? 'collect.beneficiaryIntro' : 'collect.collectorIntro')}</PageHeading>
      {role === null ? <Loading label={donationCopy(locale, 'collect.loading')} /> : null}
      {caseId && role !== null ? <Comments caseId={caseId} /> : null}
      {caseId && role !== null ? <Button tone="secondary" label={donationCopy(locale, 'collect.editProfile')} onPress={() => router.push(`/collect/manage/${caseId}` as Href)} /> : null}
      {caseId && role !== null && !isBeneficiary ? <ExternalForm caseId={caseId} onDone={load} /> : null}
      {isBeneficiary ? null : <View style={[styles.tabs, locale === 'ar' && styles.rtl]}>{TABS.map(([key, label]) => <Chip key={key} label={donationCopy(locale, label)} selected={tab === key} onPress={() => setTab(key)} />)}</View>}
      {isBeneficiary ? null : (
        <>
          <Ornament />
          {error ? <Message kind="error">{error}</Message> : null}
          {rows === null && role !== null ? <Loading label={donationCopy(locale, 'collect.loading')} /> : null}
          {rows?.length === 0 && !error ? <Text style={styles.muted}>{donationCopy(locale, 'collect.nothingHere')}</Text> : null}
          {rows?.map((p) => <PledgeRow key={p.id} pledge={p} onChanged={load} />)}
        </>
      )}
    </Page>
  );
}

export function CollectAccept() {
  useScheme();
  const { locale } = useLocale();
  const router = useRouter();
  const { session } = useAuth();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');
  const accept = async () => {
    if (!token) return;
    setState('busy'); setError('');
    try { const r = await acceptCollectorInvite(token); setState('done'); router.replace(`/collect/${r.case_id}` as Href); } catch (e) { setError(e instanceof Error ? e.message : donationCopy(locale, 'invite.invalid')); setState('idle'); }
  };
  return (
    <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}>
      <PageHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} eyebrow={donationCopy(locale, 'invite.eyebrow')} title={donationCopy(locale, 'invite.title')}>{donationCopy(locale, 'invite.body')}</PageHeading>
      {!token ? <Message kind="error">{donationCopy(locale, 'invite.incomplete')}</Message> : null}
      {error ? <Message kind="error">{error}</Message> : null}
      {session ? <Button label={donationCopy(locale, 'invite.accept')} busy={state === 'busy'} disabled={!token} onPress={() => void accept()} /> : <><Message kind="info">{donationCopy(locale, 'invite.signInInstruction')}</Message><Button label={donationCopy(locale, 'invite.signIn')} onPress={() => { if (token) void AsyncStorage.setItem(PENDING_INVITE, token); router.push('/account' as Href); }} /></>}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  muted: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  body: { color: palette.ink, fontSize: 14, lineHeight: 21, marginTop: 6 },
  picked: { borderColor: palette.forest, borderWidth: 2 },
  card: { gap: 6, marginTop: 10, padding: 14 },
  title: { ...display, color: palette.ink, fontSize: 18 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  badge: { color: palette.coral, fontSize: 13, fontWeight: '700' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  rtl: { direction: 'rtl' },
  receipts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  receiptWrap: { gap: 4 },
  viewLink: { color: palette.forest, fontSize: 12, fontWeight: '700' },
  strong: { fontWeight: '700' },
  lightbox: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.88)', flex: 1, justifyContent: 'center', padding: 16 },
  lightboxImage: { height: '80%', width: '100%' },
  lightboxClose: { color: palette.white, fontSize: 13, marginTop: 12 },
  receipt: { backgroundColor: palette.leaf, borderRadius: 10, height: 96, width: 96 },
}));
