import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { type CaseForm as Form, type Category, SOCIAL, blankForm, check, db, publicUrl, saveCase, upload } from './shared';
import { Field } from './ui';

type Bank = { bank_name: string; account_holder: string; account_number: string; note: string };
const emptyBank: Bank = { bank_name: '', account_holder: '', account_number: '', note: '' };

export default function CaseForm({ initial, onSaved, onFail, onCancel }: { initial?: Form; onSaved: (id: string, message: string) => void; onFail: (e: unknown) => void; onCancel?: () => void }) {
  const [form, setForm] = useState<Form>(initial ?? blankForm);
  const [bank, setBank] = useState<Bank>(emptyBank);
  const [busy, setBusy] = useState(false);
  const isNew = !form.id;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const categories = useQuery({
    queryKey: ['donation-categories'],
    queryFn: async () => { const { data, error } = await db().from('donation_categories').select('slug,label_en').order('sort_order'); check(error); return (data ?? []) as Category[]; },
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const wantsBank = isNew && bank.account_number.trim() !== '';
      // A case can only be published once it has an active bank account, so create it as a draft first.
      const id = await saveCase(wantsBank && form.status !== 'draft' ? { ...form, status: 'draft' } : form);
      if (wantsBank) {
        check((await db().from('donation_bank_accounts').insert({ case_id: id, ...bank, note: bank.note || null }).select('id').single()).error);
        if (form.status !== 'draft') await saveCase({ ...form, id });
      }
      onSaved(id, isNew ? 'Case created.' : 'Changes saved.');
    } catch (e) { onFail(e); } finally { setBusy(false); }
  };

  return (
    <form className="dn-form" onSubmit={(e) => void submit(e)}>
      <section className="panel dn-section">
        <header><h2>Who is this for?</h2><p>Shown at the top of the public case page.</p></header>
        <div className="dn-grid">
          <Field hint="A short, clear headline donors will see." label="Case title" wide><input maxLength={160} minLength={4} onChange={(e) => set('title', e.target.value)} required value={form.title} /></Field>
          <Field label="Beneficiary name"><input maxLength={80} onChange={(e) => set('beneficiary_name', e.target.value)} value={form.beneficiary_name} /></Field>
          <Field label="Age"><input max={120} min={0} onChange={(e) => set('age', e.target.value)} type="number" value={form.age} /></Field>
          <Field label="City"><input maxLength={80} onChange={(e) => set('city', e.target.value)} value={form.city} /></Field>
          <Field hint="Used for filters on the Give page." label="Category"><select onChange={(e) => set('category', e.target.value)} value={form.category}><option value="">Choose…</option>{categories.data?.map((c) => <option key={c.slug} value={c.slug}>{c.label_en}</option>)}</select></Field>
          <Field hint="20–1000 characters. Shown on cards and in search." label="Short summary" wide><textarea maxLength={1000} minLength={20} onChange={(e) => set('summary', e.target.value)} required rows={3} value={form.summary} /></Field>
          <Field hint="Up to 5000 characters. The full story and what the money is for." label="Full story" wide><textarea maxLength={5000} onChange={(e) => set('bio', e.target.value)} rows={7} value={form.bio} /></Field>
          <label className="dn-toggle dn-wide"><input checked={form.is_urgent} onChange={(e) => set('is_urgent', e.target.checked)} type="checkbox" /><span>Mark as urgent<small>Urgent cases are highlighted and sorted first.</small></span></label>
        </div>
      </section>

      <section className="panel dn-section">
        <header><h2>Funding</h2><p>Donations go straight to the family&apos;s bank account. Ihssan only records and confirms them.</p></header>
        <div className="dn-grid">
          <Field label="Goal"><span className="dn-suffix"><input max={100000000} min={1} onChange={(e) => set('goal_mad', e.target.value)} required type="number" value={form.goal_mad} /></span></Field>
          <Field hint="Already collected before the case joined Ihssan. Counts toward the progress bar." label="Already gathered"><span className="dn-suffix"><input min={0} onChange={(e) => set('initial_raised_mad', e.target.value)} type="number" value={form.initial_raised_mad} /></span></Field>
          <Field label="Minimum donation"><span className="dn-suffix"><input min={1} onChange={(e) => set('min_donation_mad', e.target.value)} type="number" value={form.min_donation_mad} /></span></Field>
          <Field hint="Published needs an active bank account." label="Status"><select onChange={(e) => set('status', e.target.value)} value={form.status}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="closed">Closed</option></select></Field>
        </div>
      </section>

      {isNew ? (
        <section className="panel dn-section">
          <header><h2>Bank account</h2><p>Only the platform owner can add or see bank details. You can also add them later from the case&apos;s Bank tab.</p></header>
          <div className="dn-grid">
            <Field label="Bank"><input maxLength={80} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} placeholder="e.g. CIH, Attijariwafa" value={bank.bank_name} /></Field>
            <Field label="Account holder"><input maxLength={80} onChange={(e) => setBank({ ...bank, account_holder: e.target.value })} value={bank.account_holder} /></Field>
            <Field hint="24-digit RIB or IBAN." label="RIB / account number"><input autoComplete="off" inputMode="numeric" maxLength={40} minLength={bank.account_number ? 8 : undefined} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} required={Boolean(bank.bank_name || bank.account_holder)} value={bank.account_number} /></Field>
            <Field label="Note for donors"><input maxLength={200} onChange={(e) => setBank({ ...bank, note: e.target.value })} placeholder="Optional, e.g. include the order reference" value={bank.note} /></Field>
          </div>
        </section>
      ) : null}

      <section className="panel dn-section">
        <header><h2>Contact and links</h2><p>Optional. Contact details are only shown if you switch them on.</p></header>
        <div className="dn-grid">
          <Field label="Phone"><input maxLength={20} onChange={(e) => set('contact_phone', e.target.value)} type="tel" value={form.contact_phone} /></Field>
          <Field label="Email"><input maxLength={120} onChange={(e) => set('contact_email', e.target.value)} type="email" value={form.contact_email} /></Field>
          <label className="dn-toggle dn-wide"><input checked={form.show_contact} onChange={(e) => set('show_contact', e.target.checked)} type="checkbox" /><span>Show contact details publicly<small>Leave off to keep the family&apos;s phone and email private.</small></span></label>
        </div>
        <div className="dn-links">
          {form.social_links.map((link, i) => (
            <div className="dn-link-row" key={i}>
              <select aria-label="Network" onChange={(e) => set('social_links', form.social_links.map((l, j) => (j === i ? { ...l, kind: e.target.value } : l)))} value={link.kind}>{SOCIAL.map((s) => <option key={s}>{s}</option>)}</select>
              <input aria-label="Link" onChange={(e) => set('social_links', form.social_links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))} placeholder="https://" type="url" value={link.url} />
              <button aria-label="Remove link" className="button button-secondary" onClick={() => set('social_links', form.social_links.filter((_, j) => j !== i))} type="button"><Trash2 size={15} /></button>
            </div>
          ))}
          {form.social_links.length < 8 ? <div><button className="button button-secondary" onClick={() => set('social_links', [...form.social_links, { kind: 'facebook', url: '' }])} type="button"><Plus size={15} /> Add link</button></div> : null}
        </div>
      </section>

      <section className="panel dn-section">
        <header><h2>Verification and photo</h2><p>Internal note about how you verified this family. Never shown publicly.</p></header>
        <div className="dn-grid">
          <Field label="Verification note" wide><textarea maxLength={1000} onChange={(e) => set('verification_note', e.target.value)} rows={3} value={form.verification_note} /></Field>
          {form.id ? (
            <Field hint="JPG, PNG or WebP under 5 MB. Saved with the case." label="Profile photo" wide>
              <div className="dn-actions">
                {form.photo_path ? <img alt="" className="dn-avatar" src={publicUrl(form.photo_path)} /> : null}
                <input accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(form.id!, file).then((p) => set('photo_path', p)).catch(onFail); }} type="file" />
              </div>
            </Field>
          ) : <p className="form-help dn-wide" style={{ margin: 0 }}>You can add the profile photo and gallery right after creating the case.</p>}
        </div>
      </section>

      <div className="dn-sticky">
        <span className="form-help" style={{ margin: 0, alignSelf: 'center' }}>{isNew ? 'Next you can add photos, invite the family and collectors.' : 'Changes appear in the app right after saving.'}</span>
        <div className="button-row">
          {onCancel ? <button className="button button-secondary" onClick={onCancel} type="button">Cancel</button> : null}
          <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Saving…' : isNew ? 'Create case' : 'Save changes'}</button>
        </div>
      </div>
    </form>
  );
}
