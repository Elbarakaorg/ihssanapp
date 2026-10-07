import { lazy, Suspense, useState, type FormEvent } from 'react';
import { CircleAlert, LoaderCircle, Plus, RefreshCw, Upload } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';
import { CSV_HEADER, csvToLocations } from './csv';

const LocationPicker = lazy(() => import('./LocationPicker'));

const KINDS = ['pharmacy', 'clinic', 'hospital', 'laboratory'] as const;
const STATUSES = ['draft', 'verified', 'retired'] as const;
const DUTIES = [['none', 'No duty'], ['day', 'Day duty'], ['night', 'Night duty'], ['24h', 'Open 24/7']] as const;

type Row = {
  id: string; kind: string; name: string; city: string; address: string | null; phone: string | null; latitude: number | null; longitude: number | null;
  opening_hours: string | null; website: string | null; notes: string | null; is_emergency: boolean; duty: string; duty_until: string | null; status: string;
};

type Form = {
  id: string | null; kind: string; name: string; city: string; address: string; phone: string; latitude: number | null; longitude: number | null;
  opening_hours: string; website: string; notes: string; is_emergency: boolean; duty: string; duty_until: string; status: string;
};

const blank: Form = {
  id: null, kind: 'pharmacy', name: '', city: '', address: '', phone: '', latitude: null, longitude: null, opening_hours: '', website: '', notes: '',
  is_emergency: false, duty: 'none', duty_until: '', status: 'draft',
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function fromRow(row: Row): Form {
  return {
    id: row.id, kind: row.kind, name: row.name, city: row.city, address: row.address ?? '', phone: row.phone ?? '', latitude: row.latitude, longitude: row.longitude,
    opening_hours: row.opening_hours ?? '', website: row.website ?? '', notes: row.notes ?? '', is_emergency: row.is_emergency, duty: row.duty,
    duty_until: toLocalInput(row.duty_until), status: row.status,
  };
}

const coordinate = (value: string) => (value.trim() === '' || Number.isNaN(Number(value)) ? null : Number(value));

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState('');

  const query = useQuery({
    queryKey: ['locations', search, kind, status],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      let request = supabase.from('care_providers').select('id,kind,name,city,address,phone,latitude,longitude,opening_hours,website,notes,is_emergency,duty,duty_until,status')
        .neq('kind', 'doctor').order('updated_at', { ascending: false }).limit(200);
      if (search.trim()) request = request.ilike('name', `%${search.trim().replace(/[%_,()]/g, ' ')}%`);
      if (kind) request = request.eq('kind', kind);
      if (status) request = request.eq('status', status);
      const { data, error: selectError } = await request;
      if (selectError) throw selectError;
      return (data ?? []) as Row[];
    },
  });

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    if (busy) return false;
    setBusy(true);
    setError('');
    setMessage('');
    const { error: rpcError } = await action();
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return false; }
    setMessage(done);
    await queryClient.invalidateQueries({ queryKey: ['locations'] });
    return true;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || !supabase) return;
    const data = { ...form, duty_until: form.duty_until ? new Date(form.duty_until).toISOString() : '' };
    if (await run(() => supabase!.rpc('admin_save_care_location', { p_id: form.id, p_data: data }), 'Saved.')) setForm(null);
  }

  async function importCsv() {
    if (!supabase) return;
    const rows = csvToLocations(csv).map((item) => ({ ...item, latitude: coordinate(item.latitude ?? ''), longitude: coordinate(item.longitude ?? '') }));
    if (!rows.length) { setError('Paste the header row and at least one location.'); return; }
    setBusy(true); setError(''); setMessage('');
    const { data, error: rpcError } = await supabase.rpc('admin_import_care_locations', { p_rows: rows });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    const result = data as { inserted: number; skipped: number; problems: { row: number; message: string }[] };
    const problems = result.problems.slice(0, 5).map((item) => `row ${item.row}: ${item.message}`).join('; ');
    setMessage(`${result.inserted} added as drafts, ${result.skipped} already existed.${problems ? ` Problems: ${problems}` : ''}`);
    if (!result.problems.length) setCsv('');
    await queryClient.invalidateQueries({ queryKey: ['locations'] });
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));
  const loadError = query.error as { message?: string } | null;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">CARE MAP</p>
          <h1>Map locations</h1>
          <p>Pharmacies, clinics, hospitals and laboratories shown on the patient map. Only published locations are visible. Doctors appear from their verified practice locations.</p>
        </div>
        <div className="button-row">
          <button className="button button-secondary" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={16} /> Refresh</button>
          <button className="button button-secondary" onClick={() => setImporting((value) => !value)}><Upload size={16} /> Import CSV</button>
          <button className="button button-primary" onClick={() => { setForm(blank); setMessage(''); }}><Plus size={16} /> Add location</button>
        </div>
      </header>

      {(error || loadError) && <div className="alert alert-error" role="alert"><CircleAlert size={16} /> {error || loadError?.message}</div>}
      {message && <div className="alert" role="status">{message}</div>}

      {importing && (
        <section className="panel">
          <h2>Import from CSV</h2>
          <p className="form-help">Columns: <code>{CSV_HEADER}</code>. Type is pharmacy, clinic, hospital or laboratory. Rows are added as drafts so you can check each one before publishing. Duplicates (same name and city) are skipped.</p>
          <textarea aria-label="CSV" onChange={(event) => setCsv(event.target.value)} placeholder={`${CSV_HEADER}\nPharmacie Atlas,pharmacy,Casablanca,12 Rue X,+212522000000,33.5731,-7.5898,8h-22h`} rows={7} value={csv} />
          <div className="button-row"><button className="button button-primary" disabled={busy} onClick={() => void importCsv()}>Import</button></div>
        </section>
      )}

      {form && (
        <form className="panel" onSubmit={(event) => void save(event)}>
          <h2>{form.id ? 'Edit location' : 'New location'}</h2>
          <div className="form-grid">
            <label>Name<input maxLength={160} onChange={(event) => set('name', event.target.value)} required value={form.name} /></label>
            <label>Type<select onChange={(event) => set('kind', event.target.value)} value={form.kind}>{KINDS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>City<input maxLength={80} onChange={(event) => set('city', event.target.value)} required value={form.city} /></label>
            <label>Address<input maxLength={300} onChange={(event) => set('address', event.target.value)} value={form.address} /></label>
            <label>Phone<input inputMode="tel" onChange={(event) => set('phone', event.target.value)} placeholder="+212 5 22 00 00 00" value={form.phone} /></label>
            <label>Opening hours<input maxLength={200} onChange={(event) => set('opening_hours', event.target.value)} value={form.opening_hours} /></label>
            <label>Website (https)<input onChange={(event) => set('website', event.target.value)} type="url" value={form.website} /></label>
            <label>Status<select onChange={(event) => set('status', event.target.value)} value={form.status}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Duty<select onChange={(event) => set('duty', event.target.value)} value={form.duty}>{DUTIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {(form.duty === 'day' || form.duty === 'night') && <label>Duty ends<input onChange={(event) => set('duty_until', event.target.value)} required type="datetime-local" value={form.duty_until} /></label>}
            <label className="check"><input checked={form.is_emergency} onChange={(event) => set('is_emergency', event.target.checked)} type="checkbox" /> Emergency services</label>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>Notes (internal, max 300)<textarea maxLength={300} onChange={(event) => set('notes', event.target.value)} rows={2} value={form.notes} /></label>
          <div className="form-grid">
            <label>Latitude<input inputMode="decimal" onChange={(event) => set('latitude', coordinate(event.target.value))} value={form.latitude ?? ''} /></label>
            <label>Longitude<input inputMode="decimal" onChange={(event) => set('longitude', coordinate(event.target.value))} value={form.longitude ?? ''} /></label>
          </div>
          <Suspense fallback={<p><LoaderCircle className="spin" size={16} /> Loading map…</p>}>
            <LocationPicker latitude={form.latitude} longitude={form.longitude} onChange={(latitude, longitude) => setForm((current) => (current ? { ...current, latitude, longitude } : current))} />
          </Suspense>
          <div className="button-row">
            <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save'}</button>
            <button className="button button-secondary" onClick={() => setForm(null)} type="button">Cancel</button>
          </div>
        </form>
      )}

      <section className="panel">
        <div className="form-row">
          <input aria-label="Search by name" onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" value={search} />
          <select aria-label="Type" onChange={(event) => setKind(event.target.value)} value={kind}><option value="">All types</option>{KINDS.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Status" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">All statuses</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        {query.isLoading && <p className="loading-state"><LoaderCircle className="spin" size={16} /> Loading…</p>}
        {query.data?.length === 0 && <p className="empty-state">No locations yet. Add one or import a CSV.</p>}
        <div className="table-wrap">
          <table>
            <tbody>
              {query.data?.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.name}</strong><br /><small>{row.kind} · {row.city}{row.is_emergency ? ' · emergency' : ''}</small></td>
                  <td>{row.status}{row.duty !== 'none' ? ` · ${row.duty}` : ''}{row.status === 'verified' && row.latitude === null ? ' · no coordinates' : ''}</td>
                  <td className="table-actions">
                    <div className="button-row">
                      <button className="button button-secondary" onClick={() => { setForm(fromRow(row)); setMessage(''); }}>Edit</button>
                      {row.status !== 'verified'
                        ? <button className="button button-primary" disabled={busy} onClick={() => void run(() => supabase!.rpc('admin_set_care_location_status', { p_id: row.id, p_status: 'verified' }), 'Published.')}>Publish</button>
                        : <button className="button button-secondary" disabled={busy} onClick={() => void run(() => supabase!.rpc('admin_set_care_location_status', { p_id: row.id, p_status: 'retired' }), 'Retired.')}>Retire</button>}
                      {row.status !== 'verified' && <button className="button button-secondary" disabled={busy} onClick={() => { if (window.confirm(`Delete ${row.name}?`)) void run(() => supabase!.rpc('admin_delete_care_location', { p_id: row.id }), 'Deleted.'); }}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
