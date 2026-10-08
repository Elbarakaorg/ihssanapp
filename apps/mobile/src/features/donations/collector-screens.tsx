import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { BackLink, Button, Chip, Field, Message } from '@/features/doctor/ui';
import { Loading } from '@/ui/loading';
import { Ornament, Page, PageHeading, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { type CaseComment, type CollectorCase, type ReviewPledge, acceptCollectorInvite, bulkReviewComments, listCasePledges, listCaseComments, listCollectorCases, receiptUrl, reviewPledge } from './donations-api';
import { formatMad, parseAmount } from './donations-logic';
import { Progress, StatusPill } from './donations-ui';

export function CollectHome() {
  useScheme();
  const router = useRouter();
  const [cases, setCases] = useState<CollectorCase[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { listCollectorCases().then(setCases).catch((e) => { setError(e instanceof Error ? e.message : 'Could not load.'); setCases([]); }); }, []);
  return (
    <Page>
      <BackLink href="/give" label="Giving" />
      <PageHeading eyebrow="Giving" title="Your cases">Cases you collect for or are part of. Collectors confirm only what has reached the bank account; family members approve donor comments.</PageHeading>
      {error ? <Message kind="error">{error}</Message> : null}
      {cases === null ? <Loading label="Loading" /> : null}
      {cases?.length === 0 && !error ? <Text style={styles.muted}>You have not been added to any case yet. Open the invitation link the foundation sent you.</Text> : null}
      {cases?.map((c) => (
        <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/collect/${c.id}` as Href)} style={[uiStyles.card, styles.card]}>
          <Text style={styles.title}>{c.title}</Text>
          <Progress raised={c.raised_mad} goal={c.goal_mad} donors={c.donor_count} />
          {c.role !== 'beneficiary' && c.awaiting_review > 0 ? <Text style={styles.badge}>{c.awaiting_review} awaiting review</Text> : null}
          {(c.pending_comments ?? 0) > 0 ? <Text style={styles.badge}>{c.pending_comments} comment{c.pending_comments === 1 ? '' : 's'} to approve</Text> : null}
          {c.role === 'beneficiary' || (c.awaiting_review === 0 && !(c.pending_comments ?? 0)) ? <Text style={styles.muted}>{c.role === 'beneficiary' ? 'Your case' : 'Nothing waiting'}</Text> : null}
        </Pressable>
      ))}
    </Page>
  );
}

const TABS: [string, string][] = [['receipt_submitted', 'Awaiting review'], ['pledged', 'Pending transfer'], ['confirmed', 'Confirmed'], ['rejected', 'Rejected']];

function Receipts({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => { void Promise.all(paths.map(receiptUrl)).then((all) => setUrls(all.filter((u): u is string => !!u))); }, [paths]);
  return <View style={styles.receipts}>{urls.map((u) => <Pressable key={u} accessibilityRole="link" onPress={() => { if (typeof window !== 'undefined') window.open(u, '_blank', 'noopener'); }}><Image accessibilityLabel="Receipt" source={{ uri: u }} style={styles.receipt} resizeMode="cover" /></Pressable>)}</View>;
}

function PledgeRow({ pledge, onChanged }: { pledge: ReviewPledge; onChanged: () => void }) {
  const [amount, setAmount] = useState(String(pledge.amount_mad));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const decide = async (decision: 'confirm' | 'reject') => {
    const value = parseAmount(amount);
    if (decision === 'confirm' && value === null) { setError('Enter the amount that reached the account.'); return; }
    if (decision === 'reject' && reason.trim().length < 3) { setError('Give a short reason so the donor understands.'); return; }
    setBusy(true); setError('');
    try { await reviewPledge({ id: pledge.id, decision, amount: value ?? undefined, note: reason }); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); setBusy(false); }
  };
  const actionable = pledge.status === 'receipt_submitted' || pledge.status === 'pledged' || pledge.status === 'expired';
  return (
    <View style={[uiStyles.card, styles.card]}>
      <View style={styles.row}><Text style={styles.title}>{formatMad(pledge.amount_mad)}</Text><StatusPill status={pledge.status} /></View>
      <Text style={styles.muted}>{pledge.reference} · {pledge.is_anonymous ? 'Anonymous' : pledge.display_name}</Text>
      {pledge.donor_contact ? <Text style={styles.muted}>Contact: {pledge.donor_contact}</Text> : null}
      {pledge.comment ? <Text style={styles.body}>“{pledge.comment}”</Text> : null}
      {pledge.receipt_note ? <Text style={styles.muted}>Donor note: {pledge.receipt_note}</Text> : null}
      {pledge.receipt_paths.length ? <Receipts paths={pledge.receipt_paths} /> : null}
      {pledge.review_note ? <Text style={styles.muted}>Note: {pledge.review_note}</Text> : null}
      {actionable ? (
        <>
          <Field label="Amount received (MAD)" value={amount} onChangeText={setAmount} keyboardType="number-pad" maxLength={9} />
          <Field label="Reason (required to reject)" value={reason} onChangeText={setReason} maxLength={200} />
          {error ? <Message kind="error">{error}</Message> : null}
          <Button label="Confirm received" busy={busy} onPress={() => void decide('confirm')} />
          <Button tone="danger" label="Reject" disabled={busy} onPress={() => void decide('reject')} />
        </>
      ) : null}
    </View>
  );
}

function Comments({ caseId }: { caseId: string }) {
  const [rows, setRows] = useState<CaseComment[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setRows(null); setPicked([]);
    listCaseComments(caseId, 'pending').then(setRows).catch((e) => { setError(e instanceof Error ? e.message : 'Could not load.'); setRows([]); });
  }, [caseId]);
  useEffect(load, [load]);
  const decide = async (ids: string[], decision: 'approve' | 'hide') => {
    if (!ids.length) return;
    setBusy(true); setError('');
    try { await bulkReviewComments(ids, decision); load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <>
      <SectionHeading title="Comments to approve" />
      <Text style={styles.muted}>Comments from donors stay private until you approve them.</Text>
      {error ? <Message kind="error">{error}</Message> : null}
      {rows === null ? <Loading label="Loading" /> : null}
      {rows?.length === 0 && !error ? <Text style={styles.muted}>No comments waiting.</Text> : null}
      {rows && rows.length > 0 ? (
        <>
          <Button label={picked.length === rows.length ? 'Clear selection' : 'Select all'} tone="secondary" onPress={() => setPicked(picked.length === rows.length ? [] : rows.map((r) => r.id))} />
          {picked.length > 0 ? (
            <>
              <Button label={`Approve ${picked.length} selected`} busy={busy} onPress={() => void decide(picked, 'approve')} />
              <Button label={`Hide ${picked.length} selected`} tone="danger" disabled={busy} onPress={() => void decide(picked, 'hide')} />
            </>
          ) : null}
        </>
      ) : null}
      {rows?.map((c) => (
        <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: picked.includes(c.id) }} onPress={() => toggle(c.id)} style={[uiStyles.card, styles.card, picked.includes(c.id) && styles.picked]}>
          <Text style={styles.muted}>{c.is_anonymous || !c.display_name ? 'Anonymous' : c.display_name} · {formatMad(c.amount_mad)}</Text>
          <Text style={styles.body}>“{c.comment}”</Text>
        </Pressable>
      ))}
    </>
  );
}

export function CollectCase() {
  useScheme();
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
    <Page>
      <BackLink href={'/collect' as Href} label="Your cases" />
      <PageHeading eyebrow={isBeneficiary ? 'Your case' : 'Fund collector'} title={isBeneficiary ? 'Comments' : 'Donations'}>{isBeneficiary ? 'Approve the kind words donors leave on your case.' : 'Check each receipt against your bank statement before confirming.'}</PageHeading>
      {role === null ? <Loading label="Loading" /> : null}
      {caseId && role !== null ? <Comments caseId={caseId} /> : null}
      {isBeneficiary ? null : <View style={styles.tabs}>{TABS.map(([key, label]) => <Chip key={key} label={label} selected={tab === key} onPress={() => setTab(key)} />)}</View>}
      {isBeneficiary ? null : (
        <>
          <Ornament />
          {error ? <Message kind="error">{error}</Message> : null}
          {rows === null && role !== null ? <Loading label="Loading" /> : null}
          {rows?.length === 0 && !error ? <Text style={styles.muted}>Nothing here.</Text> : null}
          {rows?.map((p) => <PledgeRow key={p.id} pledge={p} onChanged={load} />)}
        </>
      )}
    </Page>
  );
}

export function CollectAccept() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');
  const accept = async () => {
    if (!token) return;
    setState('busy'); setError('');
    try { const r = await acceptCollectorInvite(token); setState('done'); router.replace(`/collect/${r.case_id}` as Href); } catch (e) { setError(e instanceof Error ? e.message : 'Invalid invitation.'); setState('idle'); }
  };
  return (
    <Page>
      <PageHeading eyebrow="Giving" title="Invitation">You have been invited to a case. Collectors confirm donations; family members approve donor comments.</PageHeading>
      {!token ? <Message kind="error">This invitation link is incomplete.</Message> : null}
      {error ? <Message kind="error">{error}</Message> : null}
      {session ? <Button label="Accept invitation" busy={state === 'busy'} disabled={!token} onPress={() => void accept()} /> : <Button label="Sign in to accept" onPress={() => router.push('/account' as Href)} />}
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
  receipts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  receipt: { backgroundColor: palette.leaf, borderRadius: 10, height: 96, width: 96 },
}));
