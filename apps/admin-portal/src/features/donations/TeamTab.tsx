import { useState } from 'react';
import { Copy, LoaderCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { APP_URL, type Member, check, db, when } from './shared';
import { Field, useNotice } from './ui';

export default function TeamTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const notice = useNotice();
  const [label, setLabel] = useState('');
  const [link, setLink] = useState<{ url: string; role: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const members = useQuery({
    queryKey: ['case-members', caseId],
    queryFn: async () => { const { data, error } = await db().rpc('admin_list_case_collectors', { p_case_id: caseId }); check(error); return (data ?? []) as Member[]; },
  });

  const invite = async (role: 'collector' | 'beneficiary') => {
    setBusy(true);
    try {
      const { data, error } = await db().rpc('admin_create_collector_invite', { p_case_id: caseId, p_label: label.trim() || null, p_days: 7, p_role: role });
      check(error);
      setLink({ url: `${APP_URL.replace(/\/+$/, '')}/collect/accept?token=${encodeURIComponent((data as { token: string }).token)}`, role });
      setLabel('');
      await qc.invalidateQueries({ queryKey: ['case-members', caseId] });
    } catch (e) { notice.fail(e); } finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    if (!window.confirm('Remove this person or invitation?')) return;
    try { check((await db().rpc('admin_revoke_collector', { p_id: id })).error); notice.ok('Removed.'); await qc.invalidateQueries({ queryKey: ['case-members', caseId] }); } catch (e) { notice.fail(e); }
  };

  return (
    <div className="dn-page">
      {notice.view}
      <section className="panel">
        <h2 className="dn-h">Invite someone to this case</h2>
        <p className="dn-sub">The person signs in to the Ihssan app, opens the link and the case appears under “Your cases” in their account. Each link works once and expires in 7 days.</p>
        <Field label="Label (only you see it)"><input maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Fatima, aunt of the patient" value={label} /></Field>
        <div className="dn-actions" style={{ marginTop: 12 }}>
          <button className="button button-primary" disabled={busy} onClick={() => void invite('beneficiary')} type="button">Invite patient / family</button>
          <button className="button button-secondary" disabled={busy} onClick={() => void invite('collector')} type="button">Invite fund collector</button>
        </div>
        <ul className="dn-sub" style={{ marginTop: 12 }}>
          <li><strong>Patient / family</strong> can approve or hide donor comments and see progress. They cannot see receipts or confirm donations.</li>
          <li><strong>Fund collector</strong> can also open receipts and confirm or reject donations, for this case only.</li>
        </ul>
        {link ? (
          <div className="dn-secret" role="status">
            <strong>Copy this {link.role === 'beneficiary' ? 'patient' : 'collector'} link now — it is shown only once.</strong>
            <code>{link.url}</code>
            <button className="button button-secondary" onClick={() => { void navigator.clipboard.writeText(link.url); notice.ok('Link copied.'); }} type="button"><Copy size={14} /> Copy link</button>
          </div>
        ) : null}
      </section>
      <section className="panel">
        <h2 className="dn-h">People with access</h2>
        {members.isLoading ? <p><LoaderCircle className="spin" size={16} /> Loading…</p> : null}
        {members.data?.length === 0 ? <p className="dn-empty">Nobody has been invited yet.</p> : null}
        <div className="dn-list">
          {members.data?.map((m) => (
            <div className="dn-item" key={m.id}>
              <div className="dn-item-row">
                <div>
                  <span className="dn-item-title">{m.kind === 'invite' ? 'Pending invitation' : m.user_name ?? 'Member'} <span className="dn-role">{m.role === 'beneficiary' ? 'Patient' : 'Collector'}</span></span>
                  <div className="dn-item-meta">{m.label ? `${m.label} · ` : ''}{m.kind === 'invite' ? `expires ${when(m.expires_at)}` : `joined ${when(m.created_at)}`}</div>
                </div>
                <button className="button button-secondary" onClick={() => void revoke(m.id)} type="button">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
