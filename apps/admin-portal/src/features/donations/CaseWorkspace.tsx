import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, LoaderCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { BankTab, GalleryTab } from './BankGalleryTabs';
import CaseForm from './CaseForm';
import CommentsPanel from './CommentsPanel';
import DonationsTab from './DonationsTab';
import TeamTab from './TeamTab';
import { type Analytics, type CaseRow, type Media, SOCIAL, caseUrl, check, db, errorText, formFromRow, mad, percent, publicUrl, when } from './shared';
import { BarChart, Badge, ProgressBar, Stat, Tabs, statusTone, useNotice } from './ui';

type Tab = 'overview' | 'donations' | 'comments' | 'profile' | 'bank' | 'gallery' | 'team' | 'preview';

export default function CaseWorkspace() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const notice = useNotice();
  const [tab, setTab] = useState<Tab>('overview');

  const row = useQuery({
    queryKey: ['case', id],
    queryFn: async () => { const { data, error } = await db().from('donation_cases').select('*').eq('id', id).single(); check(error); return data as CaseRow; },
  });
  const stats = useQuery({
    queryKey: ['donation-analytics', id],
    queryFn: async () => { const { data, error } = await db().rpc('donation_analytics', { p_case_id: id, p_days: 30 }); check(error); return data as Analytics; },
  });
  const media = useQuery({
    queryKey: ['case-media', id],
    queryFn: async () => { const { data, error } = await db().from('donation_case_media').select('id,path,caption').eq('case_id', id).order('created_at'); check(error); return (data ?? []) as Media[]; },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['case', id] }); void qc.invalidateQueries({ queryKey: ['donation-analytics'] }); void qc.invalidateQueries({ queryKey: ['donation-cases'] }); };

  if (row.isLoading) return <p><LoaderCircle className="spin" size={16} /> Loading case…</p>;
  if (row.error || !row.data) return <div className="alert alert-error" role="alert">{errorText(row.error)}</div>;
  const c = row.data;
  const p = stats.data?.pledges;

  return (
    <div className="dn-page">
      <Link className="dn-back" to="/donations/cases">← All cases</Link>
      <header className="dn-head">
        <div>
          <div className="dn-badges"><Badge tone={statusTone(c.status)}>{c.status}</Badge>{c.is_urgent ? <Badge tone="danger">Urgent</Badge> : null}</div>
          <h1>{c.title}</h1>
          <p className="dn-sub">{[c.beneficiary_name, c.city, c.category].filter(Boolean).join(' · ')}</p>
        </div>
        <a className="button button-secondary" href={caseUrl(c)} rel="noopener noreferrer" target="_blank"><ExternalLink size={15} /> View in app</a>
      </header>
      <ProgressBar donors={c.donor_count} goal={c.goal_mad} raised={c.raised_mad} />
      {notice.view}
      <Tabs
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'donations', label: 'Donations', count: p?.awaiting_review },
          { id: 'comments', label: 'Comments', count: p?.pending_comments },
          { id: 'profile', label: 'Profile' },
          { id: 'bank', label: 'Bank' },
          { id: 'gallery', label: 'Photos & media' },
          { id: 'team', label: 'Team & invites' },
          { id: 'preview', label: 'Preview' },
        ]}
        value={tab}
      />

      {tab === 'overview' ? (
        <>
          <section className="dn-stats">
            <Stat label="Raised" value={mad(c.raised_mad)} note={`${percent(c.raised_mad, c.goal_mad)}% of ${mad(c.goal_mad)}`} />
            <Stat label="Initial amount" value={mad(c.initial_raised_mad)} note="Gathered before Ihssan" />
            <Stat label="Confirmed donations" value={p?.confirmed ?? '—'} note={p ? `Average ${mad(p.average_mad)}` : undefined} />
            <Stat alert={(p?.awaiting_review ?? 0) > 0} label="Awaiting review" value={p?.awaiting_review ?? '—'} note={p?.oldest_awaiting ? `Oldest ${when(p.oldest_awaiting)}` : 'Nothing waiting'} />
            <Stat alert={(p?.pending_comments ?? 0) > 0} label="Comments to approve" value={p?.pending_comments ?? '—'} />
            <Stat label="Pending transfer" value={p?.pending_transfer ?? '—'} />
          </section>
          <section className="panel"><h2 className="dn-h">Last 30 days</h2>{stats.data ? <BarChart data={stats.data.daily} /> : <LoaderCircle className="spin" size={16} />}</section>
        </>
      ) : null}
      {tab === 'donations' ? <DonationsTab caseId={id} onChanged={refresh} /> : null}
      {tab === 'comments' ? <CommentsPanel caseId={id} onChanged={refresh} /> : null}
      {tab === 'profile' ? <section className="panel"><CaseForm initial={formFromRow(c)} onFail={notice.fail} onSaved={(_, m) => { notice.ok(m); refresh(); }} /></section> : null}
      {tab === 'bank' ? <BankTab caseId={id} /> : null}
      {tab === 'gallery' ? <GalleryTab caseId={id} /> : null}
      {tab === 'team' ? <TeamTab caseId={id} /> : null}
      {tab === 'preview' ? (
        <div className="dn-preview">
          {c.photo_path ? <img alt="" className="dn-preview-photo" src={publicUrl(c.photo_path)} /> : <div className="dn-preview-photo" />}
          <h2>{c.title}</h2>
          <ProgressBar donors={c.donor_count} goal={c.goal_mad} raised={c.raised_mad} />
          {c.bio ? <p>{c.bio}</p> : null}
          {c.show_contact && (c.contact_phone || c.contact_email) ? <p>Contact: {[c.contact_phone, c.contact_email].filter(Boolean).join(' · ')}</p> : null}
          {(c.social_links ?? []).filter((s) => (SOCIAL as readonly string[]).includes(s.kind)).map((s) => <p key={s.url}>{s.kind}: {s.url}</p>)}
          {media.data && media.data.length > 0 ? <div className="dn-gallery">{media.data.map((m) => <figure key={m.id}><img alt={m.caption ?? ''} src={publicUrl(m.path)} /><figcaption>{m.caption}</figcaption></figure>)}</div> : null}
          <p>Bank details are shown to donors only after they start a donation order.</p>
        </div>
      ) : null}
    </div>
  );
}
