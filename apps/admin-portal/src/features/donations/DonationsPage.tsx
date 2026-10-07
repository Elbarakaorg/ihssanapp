import { useState, type FormEvent } from 'react';
import { CircleAlert, LoaderCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';

const STATUSES = ['draft', 'published', 'closed'] as const;
const SOCIAL = ['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'website', 'whatsapp'] as const;
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? 'https://ihssanapp.com';

type Category = { slug: string; label_en: string };
type Row = {
  id: string; title: string; summary: string; city: string | null; goal_mad: number; raised_mad: number; initial_raised_mad: number; donor_count: number; status: string;
  category: string | null; beneficiary_name: string | null; age: number | null; bio: string | null; photo_path: string | null; min_donation_mad: number; is_urgent: boolean;
  social_links: { kind: string; url: string }[] | null; contact_phone: string | null; contact_email: string | null; show_contact: boolean; verification_note: string | null;
};
type Form = {
  id: string | null; title: string; summary: string; city: string; goal_mad: string; initial_raised_mad: string; min_donation_mad: string; status: string; category: string;
  beneficiary_name: string; age: string; bio: string; photo_path: string; is_urgent: boolean; social_links: { kind: string; url: string }[];
  contact_phone: string; contact_email: string; show_contact: boolean; verification_note: string;
};
type Pledge = { id: string; reference: string; amount_mad: number; display_name: string | null; is_anonymous: boolean; comment: string | null; status: string; receipt_paths: string[]; receipt_note: string | null; donor_contact: string | null; confirmed_amount_mad: number | null; review_note: string | null };
type Member = { id: string; kind: string; label: string | null; user_name: string | null; created_at: string; expires_at: string | null };
type Bank = { id: string; bank_name: string; account_holder: string; account_number: string; note: string | null; is_active: boolean };
type Media = { id: string; path: string; caption: string | null };

const blank: Form = {
  id: null, title: '', summary: '', city: '', goal_mad: '', initial_raised_mad: '0', min_donation_mad: '20', status: 'draft', category: '', beneficiary_name: '', age: '', bio: '',
  photo_path: '', is_urgent: false, social_links: [], contact_phone: '', contact_email: '', show_contact: false, verification_note: '',
};

const fromRow = (r: Row): Form => ({
  id: r.id, title: r.title, summary: r.summary, city: r.city ?? '', goal_mad: String(r.goal_mad), initial_raised_mad: String(r.initial_raised_mad), min_donation_mad: String(r.min_donation_mad),
  status: r.status === 'funded' ? 'published' : r.status, category: r.category ?? '', beneficiary_name: r.beneficiary_name ?? '', age: r.age === null ? '' : String(r.age), bio: r.bio ?? '',
  photo_path: r.photo_path ?? '', is_urgent: r.is_urgent, social_links: r.social_links ?? [], contact_phone: r.contact_phone ?? '', contact_email: r.contact_email ?? '',
  show_contact: r.show_contact, verification_note: r.verification_note ?? '',
});

const db = () => { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; };
const mad = (n: number) => `${new Intl.NumberFormat('en-US').format(n)} MAD`;
const check = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

async function upload(caseId: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${caseId}/${crypto.randomUUID()}.${ext}`;
  check((await db().storage.from('case-media').upload(path, file, { contentType: file.type })).error);
  return path;
}
const publicUrl = (path: string) => db().storage.from('case-media').getPublicUrl(path).data.publicUrl;

export default function DonationsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [managing, setManaging] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const cases = useQuery({
    queryKey: ['donation-cases'],
    queryFn: async () => {
      const { data, error: e } = await db().from('donation_cases').select('*').order('created_at', { ascending: false }).limit(200);
      check(e);
      return (data ?? []) as Row[];
    },
  });
  const categories = useQuery({
    queryKey: ['donation-categories'],
    queryFn: async () => { const { data, error: e } = await db().from('donation_categories').select('slug,label_en').order('sort_order'); check(e); return (data ?? []) as Category[]; },
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['donation-cases'] });
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong.');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: e } = await db().rpc('admin_save_donation_case', {
        p: { ...form, goal_mad: Number(form.goal_mad), initial_raised_mad: Number(form.initial_raised_mad || 0), min_donation_mad: Number(form.min_donation_mad || 20), age: form.age === '' ? null : Number(form.age) },
      });
      check(e);
      setMessage('Saved.');
      refresh();
      if (!form.id && data) setForm({ ...form, id: data as string });
      else setForm(null);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <div className="page-stack">
      <header className="page-header">
        <div><p className="eyebrow">FOUNDATION</p><h1>Donation cases</h1><p>Create cases, manage bank accounts and collectors, and review receipts.</p></div>
        <div className="button-row">
          <button className="button button-secondary" onClick={refresh} disabled={cases.isFetching}><RefreshCw size={16} /> Refresh</button>
          <button className="button button-primary" onClick={() => { setForm(blank); setManaging(null); setMessage(''); }}><Plus size={16} /> New case</button>
        </div>
      </header>
      {(error || cases.error) && <div className="alert alert-error" role="alert"><CircleAlert size={16} /> {error || cases.error?.message}</div>}
      {message && <div className="alert" role="status">{message}</div>}

      {form && (
        <form className="panel" onSubmit={(e) => void save(e)}>
          <h2>{form.id ? 'Edit case' : 'New case'}</h2>
          <div className="form-grid">
            <label className="field-label">Title<input required minLength={4} maxLength={160} value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label className="field-label">Beneficiary name<input maxLength={80} value={form.beneficiary_name} onChange={(e) => set('beneficiary_name', e.target.value)} /></label>
            <label className="field-label">Category<select value={form.category} onChange={(e) => set('category', e.target.value)}><option value="">—</option>{categories.data?.map((c) => <option key={c.slug} value={c.slug}>{c.label_en}</option>)}</select></label>
            <label className="field-label">City<input maxLength={80} value={form.city} onChange={(e) => set('city', e.target.value)} /></label>
            <label className="field-label">Age<input type="number" min={0} max={120} value={form.age} onChange={(e) => set('age', e.target.value)} /></label>
            <label className="field-label">Goal (MAD)<input required type="number" min={1} max={100000000} value={form.goal_mad} onChange={(e) => set('goal_mad', e.target.value)} /></label>
            <label className="field-label">Already gathered before Ihssan (MAD)<input type="number" min={0} value={form.initial_raised_mad} onChange={(e) => set('initial_raised_mad', e.target.value)} /></label>
            <label className="field-label">Minimum donation (MAD)<input type="number" min={1} value={form.min_donation_mad} onChange={(e) => set('min_donation_mad', e.target.value)} /></label>
            <label className="field-label">Status<select value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>Short summary (20–1000)<textarea required minLength={20} maxLength={1000} rows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></label>
          <label className="field-label" style={{ marginTop: 12 }}>Full story<textarea maxLength={5000} rows={6} value={form.bio} onChange={(e) => set('bio', e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={form.is_urgent} onChange={(e) => set('is_urgent', e.target.checked)} /> Mark as urgent</label>
          <label className="field-label" style={{ marginTop: 12 }}>Internal verification note (never public)<textarea maxLength={500} rows={2} value={form.verification_note} onChange={(e) => set('verification_note', e.target.value)} /></label>

          <h3>Contact</h3>
          <div className="form-grid">
            <label className="field-label">Phone<input maxLength={30} value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} /></label>
            <label className="field-label">Email<input type="email" maxLength={120} value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={form.show_contact} onChange={(e) => set('show_contact', e.target.checked)} /> Show contact details publicly</label>

          <h3>Social links (https only, max 8)</h3>
          {form.social_links.map((link, i) => (
            <div className="form-row" key={i}>
              <select value={link.kind} onChange={(e) => set('social_links', form.social_links.map((l, j) => (j === i ? { ...l, kind: e.target.value } : l)))}>{SOCIAL.map((s) => <option key={s}>{s}</option>)}</select>
              <input type="url" pattern="https://.*" placeholder="https://" value={link.url} onChange={(e) => set('social_links', form.social_links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))} />
              <button type="button" className="button button-secondary" aria-label="Remove link" onClick={() => set('social_links', form.social_links.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          {form.social_links.length < 8 && <button type="button" className="button button-secondary" onClick={() => set('social_links', [...form.social_links, { kind: 'facebook', url: '' }])}>Add link</button>}

          {form.id && (
            <>
              <h3>Profile photo</h3>
              {form.photo_path && <img alt="" src={publicUrl(form.photo_path)} style={{ borderRadius: 8, maxHeight: 120 }} />}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(form.id!, file).then((p) => set('photo_path', p)).catch(fail); }} />
              <p className="form-help">Save the case after choosing a photo.</p>
            </>
          )}
          <div className="button-row">
            <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save'}</button>
            {form.id && <button className="button button-secondary" type="button" onClick={() => { const r = cases.data?.find((c) => c.id === form.id); if (r) { setManaging(r); setForm(null); } }}>Manage bank, gallery, collectors, donations</button>}
            <button className="button button-secondary" type="button" onClick={() => setForm(null)}>Close</button>
          </div>
        </form>
      )}

      {managing && <Manage row={managing} onClose={() => setManaging(null)} onChanged={refresh} fail={fail} setMessage={setMessage} />}

      <section className="panel">
        {cases.isLoading && <p className="loading-state"><LoaderCircle className="spin" size={16} /> Loading…</p>}
        {cases.data?.length === 0 && <p className="empty-state">No cases yet.</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Case</th><th>City</th><th>Progress</th><th>Status</th><th /></tr></thead>
            <tbody>
              {cases.data?.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.title}</strong>{row.is_urgent ? ' · urgent' : ''}</td>
                  <td>{row.city ?? '—'}</td>
                  <td>{mad(row.raised_mad)} / {mad(row.goal_mad)} · {row.donor_count} donors</td>
                  <td>{row.status}</td>
                  <td className="table-actions"><div className="button-row">
                    <button className="button button-secondary" onClick={() => { setForm(fromRow(row)); setManaging(null); setMessage(''); }}>Edit</button>
                    <button className="button button-secondary" onClick={() => { setManaging(row); setForm(null); setMessage(''); }}>Manage</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Manage({ row, onClose, onChanged, fail, setMessage }: { row: Row; onClose: () => void; onChanged: () => void; fail: (e: unknown) => void; setMessage: (m: string) => void }) {
  const qc = useQueryClient();
  const [inviteUrl, setInviteUrl] = useState('');
  const [label, setLabel] = useState('');
  const [bank, setBank] = useState({ bank_name: '', account_holder: '', account_number: '', note: '' });
  const [caption, setCaption] = useState('');
  const [tab, setTab] = useState('receipt_submitted');
  const key = (k: string) => [k, row.id];
  const reload = (k: string) => void qc.invalidateQueries({ queryKey: key(k) });
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, after: string[], ok?: string) => {
    try { check((await fn()).error); after.forEach(reload); onChanged(); if (ok) setMessage(ok); } catch (e) { fail(e); }
  };

  const banks = useQuery({ queryKey: key('banks'), queryFn: async () => { const { data, error } = await db().from('donation_bank_accounts').select('*').eq('case_id', row.id); check(error); return (data ?? []) as Bank[]; } });
  const media = useQuery({ queryKey: key('media'), queryFn: async () => { const { data, error } = await db().from('donation_case_media').select('id,path,caption').eq('case_id', row.id).order('sort_order').order('created_at'); check(error); return (data ?? []) as Media[]; } });
  const members = useQuery({ queryKey: key('members'), queryFn: async () => { const { data, error } = await db().rpc('admin_list_case_collectors', { p_case_id: row.id }); check(error); return (data ?? []) as Member[]; } });
  const pledges = useQuery({ queryKey: [...key('pledges'), tab], queryFn: async () => { const { data, error } = await db().rpc('list_case_pledges', { p_case_id: row.id, p_status: tab, p_limit: 100 }); check(error); return (data ?? []) as Pledge[]; } });

  const review = async (p: Pledge, decision: 'confirm' | 'reject' | 'reverse') => {
    let amount: number | null = null;
    let note: string | null = null;
    if (decision === 'confirm') { const v = window.prompt('Amount received (MAD)', String(p.amount_mad)); if (!v) return; amount = Number(v); if (!Number.isFinite(amount) || amount <= 0) { fail(new Error('Invalid amount.')); return; } }
    else { note = window.prompt(decision === 'reject' ? 'Reason for rejecting' : 'Reason for reversing'); if (!note || note.trim().length < 3) return; }
    await run(() => db().rpc('review_pledge', { p_id: p.id, p_decision: decision, p_amount: amount, p_note: note, p_show_comment: true }), ['pledges'], 'Saved.');
  };
  const openReceipt = async (path: string) => {
    const { data, error } = await db().storage.from('donation-receipts').createSignedUrl(path, 300);
    if (error || !data) fail(new Error('Could not open receipt.')); else window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <section className="panel">
      <div className="form-row"><h2>{row.title}</h2><button className="button button-secondary" onClick={onClose}>Close</button></div>

      <h3>Bank accounts (platform owner only)</h3>
      {banks.error && <p className="form-help">Bank details are visible and editable only by the platform owner.</p>}
      {banks.data?.map((b) => (
        <div className="form-row" key={b.id}>
          <span>{b.bank_name} · {b.account_holder} · {b.account_number}{b.is_active ? '' : ' (inactive)'}</span>
          <button className="button button-secondary" onClick={() => void run(() => db().from('donation_bank_accounts').update({ is_active: !b.is_active }).eq('id', b.id), ['banks'])}>{b.is_active ? 'Deactivate' : 'Activate'}</button>
          <button className="button button-secondary" onClick={() => { if (window.confirm('Delete this account?')) void run(() => db().from('donation_bank_accounts').delete().eq('id', b.id), ['banks']); }}>Delete</button>
        </div>
      ))}
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void run(() => db().from('donation_bank_accounts').insert({ case_id: row.id, ...bank, note: bank.note || null }), ['banks'], 'Bank account added.').then(() => setBank({ bank_name: '', account_holder: '', account_number: '', note: '' })); }}>
        <label className="field-label">Bank<input required minLength={2} value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} /></label>
        <label className="field-label">Account holder<input required minLength={2} value={bank.account_holder} onChange={(e) => setBank({ ...bank, account_holder: e.target.value })} /></label>
        <label className="field-label">RIB / account number<input required minLength={8} maxLength={40} value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} /></label>
        <label className="field-label">Note<input maxLength={200} value={bank.note} onChange={(e) => setBank({ ...bank, note: e.target.value })} /></label>
        <button className="button button-primary" type="submit">Add account</button>
      </form>

      <h3>Gallery</h3>
      <div className="form-row">
        {media.data?.map((m) => (
          <figure key={m.id} style={{ margin: 0 }}>
            <img alt={m.caption ?? ''} src={publicUrl(m.path)} style={{ borderRadius: 8, height: 90 }} />
            <figcaption>{m.caption}</figcaption>
            <button className="button button-secondary" onClick={() => void run(() => db().from('donation_case_media').delete().eq('id', m.id), ['media'])}>Remove</button>
          </figure>
        ))}
      </div>
      <div className="form-row">
        <input placeholder="Caption (optional)" maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (file) void upload(row.id, file).then((path) => run(() => db().from('donation_case_media').insert({ case_id: row.id, path, caption: caption || null }), ['media'], 'Photo added.')).then(() => setCaption('')).catch(fail);
        }} />
      </div>

      <h3>Fund collectors</h3>
      <p className="form-help">Create a single-use invitation link (valid 7 days). The collector signs in, opens the link and can then confirm receipts for this case only.</p>
      <div className="form-row">
        <input placeholder="Label, e.g. Fatima – family friend" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="button button-primary" onClick={() => void (async () => {
          try { const { data, error } = await db().rpc('admin_create_collector_invite', { p_case_id: row.id, p_label: label || null, p_days: 7 }); check(error); setInviteUrl(`${APP_URL.replace(/\/+$/, '')}/collect/accept?token=${encodeURIComponent((data as { token: string }).token)}`); setLabel(''); reload('members'); } catch (e) { fail(e); }
        })()}>Create invitation</button>
      </div>
      {inviteUrl && <div className="alert" role="status">Copy this link now; it is shown only once:<br /><code style={{ overflowWrap: 'anywhere' }}>{inviteUrl}</code> <button className="button button-secondary" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copy</button></div>}
      {members.data?.map((m) => (
        <div className="form-row" key={m.id}>
          <span>{m.kind === 'invite' ? `Pending invite · expires ${new Date(m.expires_at ?? '').toLocaleDateString()}` : `Collector · ${m.user_name}`}{m.label ? ` · ${m.label}` : ''}</span>
          <button className="button button-secondary" onClick={() => void run(() => db().rpc('admin_revoke_collector', { p_id: m.id }), ['members'], 'Revoked.')}>Revoke</button>
        </div>
      ))}

      <h3>Donations</h3>
      <div className="button-row">{[['receipt_submitted', 'Awaiting review'], ['pledged', 'Pending transfer'], ['confirmed', 'Confirmed'], ['rejected', 'Rejected'], ['expired', 'Expired']].map(([k, l]) => (
        <button key={k} className={`button ${tab === k ? 'button-primary' : 'button-secondary'}`} onClick={() => setTab(k)}>{l}</button>
      ))}</div>
      {pledges.data?.length === 0 && <p className="empty-state">Nothing here.</p>}
      <div className="table-wrap">
        <table>
          <tbody>
            {pledges.data?.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.reference}</strong><br />{mad(p.confirmed_amount_mad ?? p.amount_mad)}</td>
                <td>{p.is_anonymous ? 'Anonymous' : p.display_name}{p.donor_contact ? <><br />{p.donor_contact}</> : null}{p.comment ? <><br />“{p.comment}”</> : null}{p.review_note ? <><br />Note: {p.review_note}</> : null}</td>
                <td>{p.receipt_paths.map((path, i) => <button key={path} className="button button-secondary" onClick={() => void openReceipt(path)}>Receipt {i + 1}</button>)}</td>
                <td className="table-actions"><div className="button-row">
                  {['receipt_submitted', 'pledged', 'expired'].includes(p.status) && <><button className="button button-primary" onClick={() => void review(p, 'confirm')}>Confirm</button><button className="button button-secondary" onClick={() => void review(p, 'reject')}>Reject</button></>}
                  {p.status === 'confirmed' && <button className="button button-secondary" onClick={() => void review(p, 'reverse')}>Reverse</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
