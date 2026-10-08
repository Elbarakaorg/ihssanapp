import { useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { type Audio, type Bank, type Media, type Video, check, db, mediaUrl, publicUrl, upload, uploadMedia } from './shared';
import { Badge, Field, useNotice } from './ui';

export function BankTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const notice = useNotice();
  const [f, setF] = useState({ bank_name: '', account_holder: '', rib: '', account_number: '', note: '' });
  const q = useQuery({
    queryKey: ['case-banks', caseId],
    queryFn: async () => { const { data, error } = await db().from('donation_bank_accounts').select('id,bank_name,account_holder,account_number,rib,note,is_active').eq('case_id', caseId).order('created_at'); check(error); return (data ?? []) as Bank[]; },
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
                <div><span className="dn-item-title">{b.bank_name}</span><div className="dn-item-meta">{b.account_holder}{b.rib ? ` · RIB ${b.rib}` : ''}{b.account_number ? ` · Account ${b.account_number}` : ''}{b.note ? ` · ${b.note}` : ''}</div></div>
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
        <form className="dn-form" onSubmit={(e) => { e.preventDefault(); void run(() => db().from('donation_bank_accounts').insert({ case_id: caseId, ...f, rib: f.rib || null, account_number: f.account_number || null, note: f.note || null }), 'Bank account added.').then(() => setF({ bank_name: '', account_holder: '', rib: '', account_number: '', note: '' })); }}>
          <div className="dn-two">
            <Field label="Bank"><input minLength={2} onChange={(e) => setF({ ...f, bank_name: e.target.value })} required value={f.bank_name} /></Field>
            <Field label="Account holder"><input minLength={2} onChange={(e) => setF({ ...f, account_holder: e.target.value })} required value={f.account_holder} /></Field>
          </div>
          <div className="dn-two">
            <Field hint="24 digits. Spaces are fine." label="RIB"><input autoComplete="off" inputMode="numeric" maxLength={32} onChange={(e) => setF({ ...f, rib: e.target.value })} pattern="[0-9 ]{24,32}" required={!f.account_number} value={f.rib} /></Field>
            <Field hint="Filled in from the RIB (digits 7 to 22) when left empty." label="Account number"><input autoComplete="off" inputMode="numeric" maxLength={40} minLength={f.account_number ? 8 : undefined} onChange={(e) => setF({ ...f, account_number: e.target.value })} required={!f.rib} value={f.account_number} /></Field>
          </div>
          <Field label="Note (optional)"><input maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} value={f.note} /></Field>
          <div><button className="button button-primary" type="submit">Add account</button></div>
        </form>
      </section>
    </div>
  );
}

export function GalleryTab({ caseId }: { caseId: string }) {
  return (
    <>
      <PhotosPanel caseId={caseId} />
      <ReelsPanel caseId={caseId} />
      <AudioPanel caseId={caseId} />
    </>
  );
}

function PhotosPanel({ caseId }: { caseId: string }) {
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

function ReelsPanel({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const notice = useNotice();
  const [link, setLink] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ['case-videos', caseId],
    queryFn: async () => { const { data, error } = await db().from('donation_case_videos').select('id,kind,url,path,caption').eq('case_id', caseId).order('sort_order').order('created_at'); check(error); return (data ?? []) as Video[]; },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['case-videos', caseId] });
  const add = async (kind: 'instagram' | 'upload', value: string) => {
    check((await db().rpc('add_case_video', { p_case_id: caseId, p_kind: kind, p_value: value, p_caption: caption || null })).error);
    setCaption(''); setLink(''); notice.ok('Added.'); await refresh();
  };
  const remove = async (v: Video) => {
    try {
      const { data, error } = await db().rpc('delete_case_video', { p_id: v.id });
      check(error);
      if (typeof data === 'string' && data) await db().storage.from('case-videos').remove([data]);
      await refresh();
    } catch (e) { notice.fail(e); }
  };
  return (
    <>
      {notice.view}
      <section className="panel">
        <h2 className="dn-h">Instagram reels and videos</h2>
        <p className="dn-sub">Paste a public Instagram reel or post link and it plays on the case page. Embeds only work for public accounts that allow embedding; otherwise upload the video instead (MP4, MOV or WebM, up to 50 MB).</p>
        {q.data?.length === 0 ? <p className="dn-empty">No videos yet.</p> : null}
        <div className="dn-list">
          {q.data?.map((v) => (
            <div className="dn-item" key={v.id}>
              <div className="dn-media-row">
                <div><span className="dn-item-title">{v.kind === 'instagram' ? 'Instagram' : 'Uploaded video'}</span><div className="dn-item-meta">{v.url ?? v.path}{v.caption ? ` · ${v.caption}` : ''}</div></div>
                <button className="button button-secondary" onClick={() => void remove(v)} type="button"><Trash2 size={14} /> Remove</button>
              </div>
              {v.kind === 'upload' && v.path ? <video controls preload="metadata" src={mediaUrl('case-videos', v.path)} style={{ maxHeight: 220 }} /> : null}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2 className="dn-h">Add a video</h2>
        <form className="dn-form" onSubmit={(e) => { e.preventDefault(); setBusy(true); void add('instagram', link.trim()).catch(notice.fail).finally(() => setBusy(false)); }}>
          <Field label="Instagram reel or post link"><input onChange={(e) => setLink(e.target.value)} placeholder="https://www.instagram.com/reel/…" required type="url" value={link} /></Field>
          <Field label="Caption (optional)"><input maxLength={200} onChange={(e) => setCaption(e.target.value)} value={caption} /></Field>
          <div className="dn-actions">
            <button className="button button-primary" disabled={busy} type="submit">Add Instagram link</button>
            <label className="button button-secondary" style={{ cursor: 'pointer' }}>
              Upload a video file
              <input accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => {
                const file = e.target.files?.[0]; e.target.value = '';
                if (!file) return;
                setBusy(true);
                void uploadMedia('video', caseId, file).then((path) => add('upload', path)).catch(notice.fail).finally(() => setBusy(false));
              }} type="file" />
            </label>
          </div>
        </form>
      </section>
    </>
  );
}

function AudioPanel({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const notice = useNotice();
  const [title, setTitle] = useState('');
  const q = useQuery({
    queryKey: ['case-audio', caseId],
    queryFn: async () => { const { data, error } = await db().from('donation_case_audio').select('id,path,title,duration_seconds').eq('case_id', caseId).order('created_at'); check(error); return (data ?? []) as Audio[]; },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['case-audio', caseId] });
  return (
    <section className="panel">
      {notice.view}
      <h2 className="dn-h">Audio messages</h2>
      <p className="dn-sub">A voice message from the family or collector. The player only appears on the case page once something is uploaded. Collectors can also record directly in the mobile app.</p>
      {q.data?.length === 0 ? <p className="dn-empty">No audio yet.</p> : null}
      <div className="dn-list">
        {q.data?.map((a) => (
          <div className="dn-item" key={a.id}>
            <div className="dn-media-row">
              <span className="dn-item-title">{a.title || 'Audio message'}</span>
              <button className="button button-secondary" onClick={() => void (async () => {
                try {
                  const { data, error } = await db().rpc('delete_case_audio', { p_id: a.id });
                  check(error);
                  if (typeof data === 'string' && data) await db().storage.from('case-audio').remove([data]);
                  await refresh();
                } catch (e) { notice.fail(e); }
              })()} type="button"><Trash2 size={14} /> Remove</button>
            </div>
            <audio controls preload="none" src={mediaUrl('case-audio', a.path)} />
          </div>
        ))}
      </div>
      <Field label="Title (optional)"><input maxLength={120} onChange={(e) => setTitle(e.target.value)} value={title} /></Field>
      <div style={{ marginTop: 10 }}>
        <input accept="audio/mp4,audio/x-m4a,audio/mpeg,audio/webm,audio/ogg,audio/wav,audio/aac" onChange={(e) => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (!file) return;
          void uploadMedia('audio', caseId, file).then(async (path) => {
            check((await db().rpc('add_case_audio', { p_case_id: caseId, p_path: path, p_title: title || null, p_duration: null })).error);
            setTitle(''); notice.ok('Audio added.'); await refresh();
          }).catch(notice.fail);
        }} type="file" />
      </div>
    </section>
  );
}
