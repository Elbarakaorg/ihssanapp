import { useEffect, useState } from 'react';
import { Check, Eye, LoaderCircle, Plus, Undo2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { type Pledge, STATUS_LABEL, check, db, errorText, mad, openReceipt, when } from './shared';
import { Badge, Chips, Dialog, Field, statusTone, useNotice } from './ui';

const TABS = ['receipt_submitted', 'pledged', 'confirmed', 'rejected', 'expired'] as const;
type Tab = (typeof TABS)[number];

function Receipts({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<{ path: string; url: string }[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all(paths.map((path) => openReceipt(path).then((url) => ({ path, url })).catch(() => null))).then((all) => { if (active) setUrls(all.filter((u): u is { path: string; url: string } => u !== null)); });
    return () => { active = false; };
  }, [paths]);
  if (paths.length === 0) return <span className="dn-item-meta">No receipt uploaded yet.</span>;
  const shown = urls.find((u) => u.path === viewing);
  return (
    <>
      <div className="dn-receipts">
        {urls.map(({ path, url }, i) => {
          const pdf = path.toLowerCase().endsWith('.pdf');
          return (
            <div className="dn-receipt-card" key={path}>
              {pdf ? <div className="dn-receipt dn-receipt-file">PDF</div> : <img alt={`Transfer receipt ${i + 1}`} className="dn-receipt" src={url} />}
              {pdf
                ? <a className="button button-secondary" href={url} rel="noopener noreferrer" target="_blank"><Eye size={14} /> View receipt</a>
                : <button className="button button-secondary" onClick={() => setViewing(path)} type="button"><Eye size={14} /> View receipt</button>}
            </div>
          );
        })}
      </div>
      {shown ? (
        <Dialog actions={<a className="button button-secondary" href={shown.url} rel="noopener noreferrer" target="_blank">Open in new tab</a>} onClose={() => setViewing(null)} title="Transfer receipt">
          <img alt="Transfer receipt" className="dn-lightbox" src={shown.url} />
        </Dialog>
      ) : null}
    </>
  );
}

function ExternalDialog({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
  const notice = useNotice();
  const [f, setF] = useState({ amount: '', name: '', anonymous: false, date: new Date().toISOString().slice(0, 10), note: '', comment: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const amount = Number(f.amount);
    if (!Number.isInteger(amount) || amount < 1) { notice.fail(new Error('Enter the amount received.')); return; }
    if (!f.anonymous && f.name.trim().length < 2) { notice.fail(new Error('Add the donor name or choose anonymous.')); return; }
    setBusy(true);
    try {
      check((await db().rpc('add_external_donation', {
        p_case_id: caseId, p_amount: amount, p_donor_name: f.anonymous ? null : f.name.trim(), p_is_anonymous: f.anonymous,
        p_received_on: f.date || null, p_note: f.note.trim() || null, p_comment: f.comment.trim() || null,
      })).error);
      onSaved();
    } catch (e) { notice.fail(e); } finally { setBusy(false); }
  };
  return (
    <Dialog
      actions={<><button className="button button-secondary" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={busy} onClick={() => void save()} type="button">{busy ? 'Saving…' : 'Add donation'}</button></>}
      onClose={onClose}
      title="Record an outside donation"
    >
      {notice.view}
      <p className="dn-confirm-note">For money received outside the app (cash, a transfer made directly to the family). It counts toward the progress bar straight away and shows in the donations list as External.</p>
      <Field label="Amount received (MAD)"><input min={1} onChange={(e) => setF({ ...f, amount: e.target.value })} type="number" value={f.amount} /></Field>
      <label className="dn-toggle"><input checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} type="checkbox" /><span>Anonymous donor</span></label>
      {f.anonymous ? null : <Field label="Donor name"><input maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} value={f.name} /></Field>}
      <Field label="Date received"><input max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, date: e.target.value })} type="date" value={f.date} /></Field>
      <Field label="Donor message (optional, shown publicly)"><input maxLength={300} onChange={(e) => setF({ ...f, comment: e.target.value })} value={f.comment} /></Field>
      <Field hint="Visible to admins and collectors only." label="Internal note (optional)"><input maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. handed to the family in cash" value={f.note} /></Field>
    </Dialog>
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
  const [adding, setAdding] = useState(false);

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
      <div className="dn-actions" style={{ justifyContent: 'space-between' }}>
        <Chips onChange={setTab} options={TABS.map((t) => ({ id: t, label: STATUS_LABEL[t] }))} value={tab} />
        <button className="button button-secondary" onClick={() => setAdding(true)} type="button"><Plus size={15} /> Record outside donation</button>
      </div>
      {adding ? <ExternalDialog caseId={caseId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); notice.ok('Donation recorded. The progress bar is updated.'); void qc.invalidateQueries({ queryKey: ['case-pledges', caseId] }); onChanged(); }} /> : null}
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
              <div className="dn-badges">{p.source === 'external' ? <Badge>External</Badge> : null}<Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge></div>
            </div>
            {p.comment ? <blockquote className="dn-quote">{p.comment}</blockquote> : null}
            {p.payer_name ? <div className="dn-item-meta">Paid from account of: <strong>{p.payer_name}</strong>{p.paid_marked_at ? ` · marked paid ${when(p.paid_marked_at)}` : ''}{p.receipt_paths.length === 0 ? ' · no receipt' : ''}</div> : null}
            {p.source === 'external' && p.received_on ? <div className="dn-item-meta">Received on {p.received_on}</div> : null}
            {p.receipt_note ? <div className="dn-item-meta">Donor note: {p.receipt_note}</div> : null}
            {p.source === 'external' ? null : <Receipts paths={p.receipt_paths} />}
            {p.review_note ? <div className="dn-item-meta">Review note: {p.review_note}</div> : null}
            <div className="dn-actions">
              {['receipt_submitted', 'pledged', 'expired'].includes(p.status) ? (
                <>
                  <button className="button button-primary" onClick={() => open(p, 'confirm')} type="button"><Check size={15} /> Confirm received</button>
                  <button className="button button-secondary" onClick={() => open(p, 'reject')} type="button"><X size={15} /> Reject</button>
                </>
              ) : null}
              {p.status === 'confirmed' && (canReverse || p.source === 'external') ? <button className="button button-secondary" onClick={() => open(p, 'reverse')} type="button"><Undo2 size={15} /> Reverse</button> : null}
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
              {d.payer_name ? <p className="dn-item-meta">The donor says they paid from the account of <strong>{d.payer_name}</strong>. Match it with the bank statement.</p> : null}
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
