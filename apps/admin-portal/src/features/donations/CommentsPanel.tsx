import { useState } from 'react';
import { Check, EyeOff, LoaderCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { type CommentRow, check, db, mad, when } from './shared';
import { Badge, Chips, useNotice } from './ui';

type Status = 'pending' | 'approved' | 'hidden';

export default function CommentsPanel({ caseId, onChanged }: { caseId?: string; onChanged?: () => void }) {
  const qc = useQueryClient();
  const notice = useNotice();
  const [status, setStatus] = useState<Status>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const key = ['donation-comments', caseId ?? 'all'];

  const q = useQuery({
    queryKey: [...key, status],
    queryFn: async () => {
      const { data, error } = await db().rpc('list_case_comments', { p_case_id: caseId ?? null, p_status: status, p_limit: 200 });
      check(error);
      return (data ?? []) as CommentRow[];
    },
  });
  const rows = q.data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const decide = async (ids: string[], decision: 'approve' | 'hide') => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const { error } = await db().rpc('bulk_review_comments', { p_ids: ids, p_decision: decision });
      check(error);
      notice.ok(`${ids.length} comment${ids.length === 1 ? '' : 's'} ${decision === 'approve' ? 'approved' : 'hidden'}.`);
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ['donation-comments'] });
      await qc.invalidateQueries({ queryKey: ['donation-analytics'] });
      onChanged?.();
    } catch (e) { notice.fail(e); } finally { setBusy(false); }
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="dn-page">
      {notice.view}
      <p className="dn-sub" style={{ margin: 0 }}>Donor comments and well-wishes from visitors are public once approved. Approve the kind ones, hide anything that is spam, abusive or identifies someone.</p>
      <Chips onChange={(s) => { setStatus(s); setSelected(new Set()); }} options={[{ id: 'pending', label: 'To approve' }, { id: 'approved', label: 'Approved' }, { id: 'hidden', label: 'Hidden' }]} value={status} />

      {rows.length > 0 ? (
        <div className="dn-bulk">
          <label className="dn-actions" style={{ cursor: 'pointer' }}>
            <input checked={allSelected} className="dn-check" onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} type="checkbox" />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>
          <div className="dn-actions">
            {status !== 'approved' ? <button className="button button-secondary" disabled={busy || selected.size === 0} onClick={() => void decide([...selected], 'approve')} type="button"><Check size={15} /> Approve selected</button> : null}
            {status !== 'hidden' ? <button className="button button-secondary" disabled={busy || selected.size === 0} onClick={() => void decide([...selected], 'hide')} type="button"><EyeOff size={15} /> Hide selected</button> : null}
          </div>
        </div>
      ) : null}

      {q.isLoading ? <p><LoaderCircle className="spin" size={16} /> Loading…</p> : null}
      {q.error ? <div className="alert alert-error" role="alert">{(q.error as Error).message}</div> : null}
      {q.data && rows.length === 0 ? <p className="dn-empty">{status === 'pending' ? 'No comments waiting for approval.' : 'Nothing here.'}</p> : null}
      <div className="dn-list">
        {rows.map((r) => (
          <div className={`dn-item${selected.has(r.id) ? ' dn-item-selected' : ''}`} key={r.id}>
            <div className="dn-item-row">
              <div className="dn-actions" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <input aria-label={`Select ${r.kind === 'wish' ? 'well-wish' : 'comment'} from ${r.display_name ?? 'Anonymous'}`} checked={selected.has(r.id)} className="dn-check" onChange={() => toggle(r.id)} type="checkbox" />
                <div>
                  <span className="dn-item-title">{r.is_anonymous || !r.display_name ? 'Anonymous' : r.display_name}</span>
                  <div className="dn-item-meta">{r.kind === 'wish' ? 'Well-wish' : `${mad(r.amount_mad ?? 0)} · ${r.reference}`} · {when(r.confirmed_at)}{caseId ? '' : ` · ${r.case_title}`}</div>
                </div>
              </div>
              <Badge tone={r.comment_status === 'hidden' ? 'danger' : r.comment_status === 'pending' ? 'warn' : undefined}>{r.comment_status}</Badge>
            </div>
            <blockquote className="dn-quote">{r.comment}</blockquote>
            <div className="dn-actions">
              {r.comment_status !== 'approved' ? <button className="button button-primary" disabled={busy} onClick={() => void decide([r.id], 'approve')} type="button"><Check size={15} /> Approve</button> : null}
              {r.comment_status !== 'hidden' ? <button className="button button-secondary" disabled={busy} onClick={() => void decide([r.id], 'hide')} type="button"><EyeOff size={15} /> Hide</button> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
