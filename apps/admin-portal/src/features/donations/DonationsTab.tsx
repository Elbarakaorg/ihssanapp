import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Undo2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { type Pledge, STATUS_LABEL, check, db, errorText, mad, openReceipt, when } from './shared';
import { Badge, Chips, Dialog, Field, statusTone, useNotice } from './ui';

const TABS = ['receipt_submitted', 'pledged', 'confirmed', 'rejected', 'expired'] as const;
type Tab = (typeof TABS)[number];

function Receipts({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<{ path: string; url: string }[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(paths.map((path) => openReceipt(path).then((url) => ({ path, url })).catch(() => null))).then((all) => { if (active) setUrls(all.filter((u): u is { path: string; url: string } => u !== null)); });
    return () => { active = false; };
  }, [paths]);
  if (paths.length === 0) return <span className="dn-item-meta">No receipt uploaded yet.</span>;
  return (
    <div className="dn-receipts">
      {urls.map(({ path, url }) => path.toLowerCase().endsWith('.pdf')
        ? <a className="dn-receipt dn-receipt-file" href={url} key={path} rel="noopener noreferrer" target="_blank">Open PDF</a>
        : <a href={url} key={path} rel="noopener noreferrer" target="_blank"><img alt="Transfer receipt" className="dn-receipt" src={url} /></a>)}
    </div>
  );
}

type Decision = { pledge: Pledge; kind: 'confirm' | 'reject' | 'reverse' };

export default function DonationsTab({ caseId, canReverse = true, onChanged }: { caseId: string; canReverse?: boolean; onChanged: () => void }) {
  const qc = useQueryClient();
  const notice = useNotice();
  const [tab, setTab] = useState<Tab>('receipt_submitted');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ['case-pledges', caseId, tab],
    queryFn: async () => { const { data, error } = await db().rpc('list_case_pledges', { p_case_id: caseId, p_status: tab, p_limit: 200 }); check(error); return (data ?? []) as Pledge[]; },
  });

  const open = (pledge: Pledge, kind: Decision['kind']) => { setDecision({ pledge, kind }); setAmount(String(pledge.amount_mad)); setNote(''); setPublish(false); };

  const submit = async () => {
    if (!decision) return;
    const value = Number(amount);
    if (decision.kind === 'confirm' && (!Number.isInteger(value) || value < 1)) { notice.fail(new Error('Enter the amount that actually reached the account.')); return; }
    if (decision.kind !== 'confirm' && note.trim().length < 3) { notice.fail(new Error('Add a short reason.')); return; }
    setBusy(true);
    try {
      check((await db().rpc('review_pledge', {
        p_id: decision.pledge.id, p_decision: decision.kind, p_amount: decision.kind === 'confirm' ? value : null,
        p_note: note.trim() || null, p_show_comment: decision.kind === 'confirm' ? publish : false,
      })).error);
      notice.ok(decision.kind === 'confirm' ? 'Donation confirmed. The progress bar is updated.' : decision.kind === 'reject' ? 'Donation rejected.' : 'Donation reversed.');
      setDecision(null);
      await qc.invalidateQueries({ queryKey: ['case-pledges', caseId] });
      onChanged();
    } catch (e) { notice.fail(e); } finally { setBusy(false); }
  };

  const d = decision?.pledge;
  return (
    <div className="dn-page">
      {notice.view}
      <Chips onChange={setTab} options={TABS.map((t) => ({ id: t, label: STATUS_LABEL[t] }))} value={tab} />
      {q.isLoading ? <p><LoaderCircle className="spin" size={16} /> Loading…</p> : null}
      {q.error ? <div className="alert alert-error" role="alert">{errorText(q.error)}</div> : null}
      {q.data?.length === 0 ? <p className="dn-empty">{tab === 'receipt_submitted' ? 'No receipts are waiting for review.' : 'Nothing here.'}</p> : null}
      <div className="dn-list">
        {q.data?.map((p) => (
          <div className="dn-item" key={p.id}>
            <div className="dn-item-row">
              <div>
                <span className="dn-item-title">{mad(p.confirmed_amount_mad ?? p.amount_mad)}</span>
                <div className="dn-item-meta">{p.reference} · {p.is_anonymous ? 'Anonymous' : p.display_name}{p.donor_contact ? ` · ${p.donor_contact}` : ''}</div>
                <div className="dn-item-meta">{p.receipt_uploaded_at ? `Receipt sent ${when(p.receipt_uploaded_at)}` : `Order created ${when(p.created_at)}`}{p.status === 'pledged' ? ` · expires ${when(p.expires_at)}` : ''}</div>
              </div>
              <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
            </div>
            {p.comment ? <blockquote className="dn-quote">{p.comment}</blockquote> : null}
            {p.receipt_note ? <div className="dn-item-meta">Donor note: {p.receipt_note}</div> : null}
            <Receipts paths={p.receipt_paths} />
            {p.review_note ? <div className="dn-item-meta">Review note: {p.review_note}</div> : null}
            <div className="dn-actions">
              {['receipt_submitted', 'pledged', 'expired'].includes(p.status) ? (
                <>
                  <button className="button button-primary" onClick={() => open(p, 'confirm')} type="button"><Check size={15} /> Confirm received</button>
                  <button className="button button-secondary" onClick={() => open(p, 'reject')} type="button"><X size={15} /> Reject</button>
                </>
              ) : null}
              {p.status === 'confirmed' && canReverse ? <button className="button button-secondary" onClick={() => open(p, 'reverse')} type="button"><Undo2 size={15} /> Reverse</button> : null}
            </div>
          </div>
        ))}
      </div>

      {decision && d ? (
        <Dialog
          actions={<><button className="button button-secondary" onClick={() => setDecision(null)} type="button">Cancel</button><button className={`button ${decision.kind === 'confirm' ? 'button-primary' : 'button-secondary'}`} disabled={busy} onClick={() => void submit()} type="button">{busy ? 'Saving…' : decision.kind === 'confirm' ? 'Confirm donation' : decision.kind === 'reject' ? 'Reject donation' : 'Reverse donation'}</button></>}
          onClose={() => setDecision(null)}
          title={decision.kind === 'confirm' ? `Confirm ${d.reference}` : decision.kind === 'reject' ? `Reject ${d.reference}` : `Reverse ${d.reference}`}
        >
          {decision.kind === 'confirm' ? (
            <>
              <p className="dn-confirm-note">Check the receipt against the bank statement first. The progress bar counts exactly the amount you enter.</p>
              <Receipts paths={d.receipt_paths} />
              <Field label="Amount received (MAD)"><input min={1} onChange={(e) => setAmount(e.target.value)} type="number" value={amount} /></Field>
              {d.comment ? <label className="dn-toggle"><input checked={publish} onChange={(e) => setPublish(e.target.checked)} type="checkbox" /><span>Publish the donor&apos;s comment now<small>“{d.comment}”. Otherwise it waits in Donor comments.</small></span></label> : null}
              <Field label="Internal note (optional)"><input maxLength={500} onChange={(e) => setNote(e.target.value)} value={note} /></Field>
            </>
          ) : (
            <Field hint="The donor sees this reason." label="Reason"><textarea maxLength={500} onChange={(e) => setNote(e.target.value)} rows={3} value={note} /></Field>
          )}
        </Dialog>
      ) : null}
    </div>
  );
}
