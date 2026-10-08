import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { type Analytics, db, check, errorText, mad, percent, when } from './shared';
import { BarChart, Badge, Chips, ProgressBar, Stat, statusTone } from './ui';

export default function OverviewPage() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const q = useQuery({
    queryKey: ['donation-analytics', 'all', days],
    queryFn: async () => { const { data, error } = await db().rpc('donation_analytics', { p_case_id: null, p_days: Number(days) }); check(error); return data as Analytics; },
  });
  const a = q.data;
  const periodTotal = a?.daily.reduce((s, d) => s + d.amount_mad, 0) ?? 0;
  const periodCount = a?.daily.reduce((s, d) => s + d.count, 0) ?? 0;
  const maxCat = Math.max(1, ...(a?.by_category.map((c) => c.raised_mad) ?? [1]));
  const attention = (a?.pledges.awaiting_review ?? 0) + (a?.pledges.pending_comments ?? 0);

  return (
    <div className="dn-page">
      <header className="page-header">
        <div><p className="eyebrow">GIVING & COMMUNITY</p><h1>Giving overview</h1><p className="page-lede">Progress, donations waiting for review and what needs your attention across every case.</p></div>
        <div className="button-row">
          <button className="button button-secondary" disabled={q.isFetching} onClick={() => void q.refetch()} type="button"><RefreshCw size={15} /> Refresh</button>
          <Link className="button button-primary" to="/donations/cases/new"><Plus size={15} /> New case</Link>
        </div>
      </header>
      {q.error ? <div className="alert alert-error" role="alert">{errorText(q.error)}</div> : null}
      {q.isLoading ? <p><LoaderCircle className="spin" size={16} /> Loading analytics…</p> : null}
      {a ? (
        <>
          <section className="dn-stats">
            <Stat label="Total raised" value={mad(a.totals.raised_mad)} note={`${percent(a.totals.raised_mad, a.totals.goal_mad)}% of ${mad(a.totals.goal_mad)} goals`} />
            <Stat label="Raised through Ihssan" value={mad(a.pledges.confirmed_mad)} note={`${a.pledges.confirmed} confirmed donation${a.pledges.confirmed === 1 ? '' : 's'}`} />
            <Stat alert={a.pledges.awaiting_review > 0} label="Awaiting review" value={a.pledges.awaiting_review} note={a.pledges.oldest_awaiting ? `Oldest receipt ${when(a.pledges.oldest_awaiting)}` : 'Nothing waiting'} />
            <Stat alert={a.pledges.pending_comments > 0} label="Comments to approve" value={a.pledges.pending_comments} note="Hidden from the public until approved" />
            <Stat label="Pending transfer" value={a.pledges.pending_transfer} note="Orders without a receipt yet" />
            <Stat label="Average donation" value={mad(a.pledges.average_mad)} note={`Largest ${mad(a.pledges.largest_mad)}`} />
            <Stat label="Active cases" value={a.totals.published} note={`${a.totals.funded} funded · ${a.totals.draft} draft · ${a.totals.closed} closed`} />
            <Stat label="Anonymous donors" value={a.pledges.confirmed ? `${Math.round((a.pledges.anonymous / a.pledges.confirmed) * 100)}%` : '—'} note={`${a.pledges.rejected} rejected · ${a.pledges.expired} expired`} />
          </section>

          {attention > 0 ? (
            <section className="panel">
              <h2 className="dn-h">Needs your attention</h2>
              <div className="dn-actions">
                {a.pledges.awaiting_review > 0 ? <Link className="button button-primary" to="/donations/cases?needs=review">Review {a.pledges.awaiting_review} receipt{a.pledges.awaiting_review === 1 ? '' : 's'}</Link> : null}
                {a.pledges.pending_comments > 0 ? <Link className="button button-secondary" to="/donations/comments">Approve {a.pledges.pending_comments} comment{a.pledges.pending_comments === 1 ? '' : 's'}</Link> : null}
              </div>
            </section>
          ) : null}

          <div className="dn-two">
            <section className="panel">
              <div className="panel-heading panel-heading-spread">
                <div><h2 className="dn-h">Confirmed donations</h2><p className="dn-sub" style={{ margin: 0 }}>{mad(periodTotal)} from {periodCount} donation{periodCount === 1 ? '' : 's'} in the last {days} days</p></div>
                <Chips onChange={setDays} options={[{ id: '7', label: '7d' }, { id: '30', label: '30d' }, { id: '90', label: '90d' }]} value={days} />
              </div>
              <BarChart data={a.daily} />
            </section>
            <section className="panel">
              <h2 className="dn-h">By category</h2>
              <p className="dn-sub">Amount raised per illness or situation.</p>
              <div className="dn-list">
                {a.by_category.length === 0 ? <p className="dn-empty">No cases yet.</p> : null}
                {a.by_category.map((c) => (
                  <div key={c.category}>
                    <div className="dn-progress-meta" style={{ marginTop: 0, marginBottom: 4 }}><strong>{c.label}</strong><span>{mad(c.raised_mad)} · {c.cases} case{c.cases === 1 ? '' : 's'}</span></div>
                    <div className="dn-progress"><span style={{ width: `${(c.raised_mad / maxCat) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-heading panel-heading-spread"><div><h2 className="dn-h">Top cases</h2><p className="dn-sub" style={{ margin: 0 }}>By amount raised.</p></div><Link className="button button-secondary" to="/donations/cases">All cases</Link></div>
            <div className="dn-list">
              {a.top_cases.length === 0 ? <p className="dn-empty">No cases yet. Create the first one.</p> : null}
              {a.top_cases.map((c) => (
                <Link className="dn-item" key={c.id} style={{ color: 'inherit', textDecoration: 'none' }} to={`/donations/cases/${c.id}`}>
                  <div className="dn-item-row"><span className="dn-item-title">{c.title}</span><div className="dn-badges">{c.awaiting > 0 ? <Badge tone="warn">{c.awaiting} to review</Badge> : null}<Badge tone={statusTone(c.status)}>{c.status}</Badge></div></div>
                  <ProgressBar donors={c.donor_count} goal={c.goal_mad} raised={c.raised_mad} />
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
