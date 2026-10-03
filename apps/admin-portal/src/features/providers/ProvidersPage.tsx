import { useState } from 'react';
import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';

type Status = 'pending' | 'verified' | 'rejected' | 'suspended';
type Clinician = {
  user_id: string;
  public_name: string;
  email: string;
  verification_status: Status;
  created_at: string;
  license_number: string | null;
  issuing_body: string | null;
  specialty: string | null;
  city: string | null;
  submitted_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
};
type PendingLocation = {
  id: string;
  clinician_id: string;
  doctor_name: string;
  clinician_status: Status;
  venue_kind: string;
  venue_name: string;
  city: string;
  address: string | null;
  specialty: string | null;
  phone: string | null;
  google_place_id: string | null;
};

const statuses: Status[] = ['pending', 'verified', 'rejected', 'suspended'];
const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function ProvidersPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'clinicians' | 'locations'>('clinicians');
  const [status, setStatus] = useState<Status>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const cliniciansQuery = useQuery({
    queryKey: ['providers', 'clinicians', status],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error: rpcError } = await supabase.rpc('list_clinician_verifications', { p_status: status });
      if (rpcError) throw rpcError;
      return (data ?? []) as Clinician[];
    },
  });
  const locationsQuery = useQuery({
    queryKey: ['providers', 'locations'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error: rpcError } = await supabase.rpc('list_pending_practice_locations');
      if (rpcError) throw rpcError;
      return (data ?? []) as PendingLocation[];
    },
  });

  async function run(id: string, action: () => PromiseLike<{ error: { message: string } | null }>) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    const { error: rpcError } = await action();
    setBusyId('');
    if (rpcError) setError(rpcError.message);
    await queryClient.invalidateQueries({ queryKey: ['providers'] });
  }

  const decide = (c: Clinician, decision: 'verified' | 'rejected' | 'suspended') => {
    const note = (notes[c.user_id] ?? '').trim();
    if (decision !== 'verified' && note.length < 5) {
      setError('Write a reason of at least 5 characters. The clinician will see it.');
      return;
    }
    const client = supabase;
    if (!client) return;
    void run(c.user_id, () =>
      client.rpc('review_clinician_verification', { p_user_id: c.user_id, p_decision: decision, p_note: note || null }),
    );
  };
  const decideLocation = (id: string, decision: 'verified' | 'rejected') => {
    const client = supabase;
    if (!client) return;
    void run(id, () => client.rpc('review_practice_location', { p_location_id: id, p_decision: decision }));
  };

  const refresh = () => {
    setError('');
    void cliniciansQuery.refetch();
    void locationsQuery.refetch();
  };
  const loadError = (tab === 'clinicians' ? cliniciansQuery.error : locationsQuery.error) as { message?: string } | null;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">DIRECTORY</p>
          <h1>Provider verification</h1>
          <p>Check each license against the national medical council register before approving. Every decision is audited.</p>
        </div>
        <button className="button button-secondary" onClick={refresh} disabled={cliniciansQuery.isFetching || locationsQuery.isFetching}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <div className="button-row" role="tablist">
        <button role="tab" aria-selected={tab === 'clinicians'} className={`button ${tab === 'clinicians' ? 'button-primary' : 'button-secondary'}`} onClick={() => setTab('clinicians')}>
          Clinicians
        </button>
        <button role="tab" aria-selected={tab === 'locations'} className={`button ${tab === 'locations' ? 'button-primary' : 'button-secondary'}`} onClick={() => setTab('locations')}>
          Practice locations{locationsQuery.data?.length ? ` (${locationsQuery.data.length})` : ''}
        </button>
      </div>

      {(error || loadError) && (
        <div className="alert alert-error" role="alert"><CircleAlert size={16} /> {error || loadError?.message}</div>
      )}

      {tab === 'clinicians' && (
        <section className="panel">
          <div className="button-row">
            {statuses.map((s) => (
              <button key={s} className={`button ${status === s ? 'button-primary' : 'button-secondary'}`} onClick={() => setStatus(s)}>
                {s}
              </button>
            ))}
          </div>
          {cliniciansQuery.isLoading && <p><LoaderCircle size={16} className="spin" /> Loading…</p>}
          {cliniciansQuery.data?.length === 0 && <p>No clinicians with status “{status}”.</p>}
          {cliniciansQuery.data?.map((c) => (
            <article key={c.user_id} className="panel">
              <h3>{c.public_name}</h3>
              <p>{c.email}</p>
              <dl>
                <dt>License number</dt><dd>{c.license_number ?? 'Not submitted'}</dd>
                <dt>Issuing body</dt><dd>{c.issuing_body ?? '—'}</dd>
                <dt>Specialty</dt><dd>{c.specialty ?? '—'}</dd>
                <dt>City</dt><dd>{c.city ?? '—'}</dd>
                <dt>Submitted</dt><dd>{formatDate(c.submitted_at ?? c.created_at)}</dd>
                {c.review_note && (<><dt>Last note</dt><dd>{c.review_note}</dd></>)}
              </dl>
              {(status === 'pending' || status === 'verified') && (
                <>
                  <textarea
                    aria-label={`Reason for ${c.public_name}`}
                    placeholder={status === 'pending' ? 'Reason (required to reject)' : 'Reason (required to suspend)'}
                    value={notes[c.user_id] ?? ''}
                    maxLength={500}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [c.user_id]: event.target.value }))}
                  />
                  <div className="button-row">
                    {status === 'pending' && (
                      <>
                        <button className="button button-primary" disabled={!!busyId || !c.license_number} onClick={() => decide(c, 'verified')}>
                          {busyId === c.user_id ? 'Saving…' : 'Verify'}
                        </button>
                        <button className="button button-secondary" disabled={!!busyId} onClick={() => decide(c, 'rejected')}>Reject</button>
                      </>
                    )}
                    {status === 'verified' && (
                      <button className="button button-secondary" disabled={!!busyId} onClick={() => decide(c, 'suspended')}>Suspend</button>
                    )}
                  </div>
                  {status === 'pending' && !c.license_number && <p>Waiting for the clinician to submit credentials.</p>}
                </>
              )}
            </article>
          ))}
        </section>
      )}

      {tab === 'locations' && (
        <section className="panel">
          {locationsQuery.isLoading && <p><LoaderCircle size={16} className="spin" /> Loading…</p>}
          {locationsQuery.data?.length === 0 && <p>No practice locations are waiting for review.</p>}
          {locationsQuery.data?.map((l) => (
            <article key={l.id} className="panel">
              <h3>{l.venue_name}</h3>
              <p>{l.venue_kind} · {l.city}{l.address ? ` · ${l.address}` : ''}</p>
              <p>Doctor: {l.doctor_name} ({l.clinician_status}){l.specialty ? ` · ${l.specialty}` : ''}{l.phone ? ` · ${l.phone}` : ''}</p>
              {l.google_place_id && (
                <a href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(l.google_place_id)}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
              )}
              <div className="button-row">
                <button className="button button-primary" disabled={!!busyId || l.clinician_status !== 'verified'} onClick={() => decideLocation(l.id, 'verified')}>Approve</button>
                <button className="button button-secondary" disabled={!!busyId} onClick={() => decideLocation(l.id, 'rejected')}>Reject</button>
              </div>
              {l.clinician_status !== 'verified' && <p>Verify the doctor first.</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
