import { useState } from 'react';
import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';

type Report = {
  report_id: string;
  comment_id: string;
  doctor_name: string;
  author_name: string;
  body: string;
  moderation: string;
  reason: string;
  details: string | null;
  reports_on_comment: number;
  created_at: string;
};

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const query = useQuery({
    queryKey: ['moderation', 'reports'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error: rpcError } = await supabase.rpc('admin_list_comment_reports', { p_status: 'open' });
      if (rpcError) throw rpcError;
      return (data ?? []) as Report[];
    },
  });

  async function resolve(id: string, action: 'remove' | 'keep') {
    if (busyId || !supabase) return;
    setBusyId(id);
    setError('');
    const { error: rpcError } = await supabase.rpc('admin_resolve_comment_report', { p_report_id: id, p_action: action });
    setBusyId('');
    if (rpcError) setError(rpcError.message);
    await queryClient.invalidateQueries({ queryKey: ['moderation'] });
  }

  const loadError = query.error as { message?: string } | null;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">COMMUNITY</p>
          <h1>Comment reports</h1>
          <p>Comments with three open reports are hidden automatically until you decide. Removing a comment closes every report on it.</p>
        </div>
        <button className="button button-secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      {(error || loadError) && <div className="alert alert-error" role="alert"><CircleAlert size={16} /> {error || loadError?.message}</div>}
      <section className="panel">
        {query.isLoading && <p><LoaderCircle size={16} className="spin" /> Loading…</p>}
        {query.data?.length === 0 && <p>No open reports.</p>}
        {query.data?.map((r) => (
          <article key={r.report_id} className="panel">
            <h3>{r.author_name} on {r.doctor_name}</h3>
            <p>{r.body}</p>
            <p>Reason: {r.reason.replace('_', ' ')} · {r.reports_on_comment} report{r.reports_on_comment === 1 ? '' : 's'} · {r.moderation.replace('_', ' ')} · {new Date(r.created_at).toLocaleString()}</p>
            {r.details && <p>“{r.details}”</p>}
            <div className="button-row">
              <button className="button button-primary" disabled={Boolean(busyId)} onClick={() => void resolve(r.report_id, 'remove')}>Remove comment</button>
              <button className="button button-secondary" disabled={Boolean(busyId)} onClick={() => void resolve(r.report_id, 'keep')}>Keep comment</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
