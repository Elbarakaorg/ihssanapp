import { useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { type Bank, type Media, check, db, publicUrl, upload } from './shared';
import { Badge, Field, useNotice } from './ui';

export function BankTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const notice = useNotice();
  const [f, setF] = useState({ bank_name: '', account_holder: '', account_number: '', note: '' });
  const q = useQuery({
    queryKey: ['case-banks', caseId],
    queryFn: async () => { const { data, error } = await db().from('donation_bank_accounts').select('id,bank_name,account_holder,account_number,note,is_active').eq('case_id', caseId).order('created_at'); check(error); return (data ?? []) as Bank[]; },
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['case-banks', caseId] });
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    try { check((await fn()).error); notice.ok(ok); await refresh(); } catch (e) { notice.fail(e); }
  };

  return (
    <div className="dn-page">
      {notice.view}
      <section className="panel">
        <h2 className="dn-h">Bank accounts</h2>
        <p className="dn-sub">Donors see these only after starting a donation order. Only the platform owner can view or change them. A case needs one active account before it can be published.</p>
        {q.error ? <div className="alert alert-error" role="alert">Bank details are visible and editable only by the platform owner.</div> : null}
        {q.isLoading ? <p><LoaderCircle className="spin" size={16} /> Loading…</p> : null}
        {q.data?.length === 0 ? <p className="dn-empty">No bank account yet.</p> : null}
        <div className="dn-list">
          {q.data?.map((b) => (
            <div className="dn-item" key={b.id}>
              <div className="dn-item-row">
                <div><span className="dn-item-title">{b.bank_name}</span><div className="dn-item-meta">{b.account_holder} · {b.account_number}{b.note ? ` · ${b.note}` : ''}</div></div>
                <Badge tone={b.is_active ? 'funded' : 'closed'}>{b.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className="dn-actions">
                <button className="button button-secondary" onClick={() => void run(() => db().from('donation_bank_accounts').update({ is_active: !b.is_active }).eq('id', b.id), 'Updated.')} type="button">{b.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="button button-secondary" onClick={() => { if (window.confirm('Delete this account?')) void run(() => db().from('donation_bank_accounts').delete().eq('id', b.id), 'Deleted.'); }} type="button"><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2 className="dn-h">Add an account</h2>
        <form className="dn-form" onSubmit={(e) => { e.preventDefault(); void run(() => db().from('donation_bank_accounts').insert({ case_id: caseId, ...f, note: f.note || null }), 'Bank account added.').then(() => setF({ bank_name: '', account_holder: '', account_number: '', note: '' })); }}>
          <div className="dn-two">
            <Field label="Bank"><input minLength={2} onChange={(e) => setF({ ...f, bank_name: e.target.value })} required value={f.bank_name} /></Field>
            <Field label="Account holder"><input minLength={2} onChange={(e) => setF({ ...f, account_holder: e.target.value })} required value={f.account_holder} /></Field>
          </div>
          <Field label="RIB / account number"><input inputMode="numeric" maxLength={40} minLength={8} onChange={(e) => setF({ ...f, account_number: e.target.value })} required value={f.account_number} /></Field>
          <Field label="Note (optional)"><input maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} value={f.note} /></Field>
          <div><button className="button button-primary" type="submit">Add account</button></div>
        </form>
      </section>
    </div>
  );
}

export function GalleryTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const notice = useNotice();
  const [caption, setCaption] = useState('');
  const q = useQuery({
    queryKey: ['case-media', caseId],
    queryFn: async () => { const { data, error } = await db().from('donation_case_media').select('id,path,caption').eq('case_id', caseId).order('created_at'); check(error); return (data ?? []) as Media[]; },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['case-media', caseId] });
  return (
    <div className="dn-page">
      {notice.view}
      <section className="panel">
        <h2 className="dn-h">Gallery</h2>
        <p className="dn-sub">Photos shown on the public case page. JPG, PNG or WebP, up to 5 MB.</p>
        {q.data?.length === 0 ? <p className="dn-empty">No photos yet.</p> : null}
        <div className="dn-gallery">
          {q.data?.map((m) => (
            <figure key={m.id}>
              <img alt={m.caption ?? ''} src={publicUrl(m.path)} />
              <figcaption>{m.caption}</figcaption>
              <button className="button button-secondary" onClick={() => void (async () => { try { check((await db().from('donation_case_media').delete().eq('id', m.id)).error); await refresh(); } catch (e) { notice.fail(e); } })()} type="button"><Trash2 size={14} /> Remove</button>
            </figure>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2 className="dn-h">Add a photo</h2>
        <Field label="Caption (optional)"><input maxLength={300} onChange={(e) => setCaption(e.target.value)} value={caption} /></Field>
        <div style={{ marginTop: 10 }}>
          <input accept="image/jpeg,image/png,image/webp" onChange={(e) => {
            const file = e.target.files?.[0]; e.target.value = '';
            if (!file) return;
            void upload(caseId, file).then(async (path) => { check((await db().from('donation_case_media').insert({ case_id: caseId, path, caption: caption || null })).error); setCaption(''); notice.ok('Photo added.'); await refresh(); }).catch(notice.fail);
          }} type="file" />
        </div>
      </section>
    </div>
  );
}
