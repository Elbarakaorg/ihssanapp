import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { type CaseRow, type Category, type Pledge, db, check, errorText, publicUrl } from './shared';
import { Badge, Chips, ProgressBar, statusTone } from './ui';

type Filter = 'all' | 'draft' | 'published' | 'funded' | 'closed';

export default function CasesList() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [needsReview, setNeedsReview] = useState(params.get('needs') === 'review');

  const cases = useQuery({
    queryKey: ['donation-cases'],
    queryFn: async () => { const { data, error } = await db().from('donation_cases').select('*').order('created_at', { ascending: false }).limit(300); check(error); return (data ?? []) as CaseRow[]; },
  });
  const categories = useQuery({
    queryKey: ['donation-categories'],
    queryFn: async () => { const { data, error } = await db().from('donation_categories').select('slug,label_en').order('sort_order'); check(error); return (data ?? []) as Category[]; },
  });
  const awaiting = useQuery({
    queryKey: ['donation-awaiting'],
    queryFn: async () => {
      const { data, error } = await db().rpc('list_case_pledges', { p_case_id: null, p_status: 'receipt_submitted', p_limit: 200 });
      check(error);
      const map = new Map<string, number>();
      for (const p of (data ?? []) as Pledge[]) map.set(p.case_id, (map.get(p.case_id) ?? 0) + 1);
      return map;
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (cases.data ?? []).filter((c) => {
      const status = c.status;
      if (filter !== 'all' && status !== filter) return false;
      if (category && c.category !== category) return false;
      if (needsReview && !awaiting.data?.get(c.id)) return false;
      if (term && ![c.title, c.beneficiary_name, c.city].some((v) => v?.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [cases.data, filter, search, category, needsReview, awaiting.data]);

  const count = (f: Filter) => (f === 'all' ? cases.data?.length : cases.data?.filter((c) => c.status === f).length) ?? 0;
  const label = (slug: string | null) => categories.data?.find((c) => c.slug === slug)?.label_en;

  return (
    <div className="dn-page">
      <header className="page-header">
        <div><p className="eyebrow">GIVING & COMMUNITY</p><h1>Cases</h1><p className="page-lede">Open a case to edit its profile, add bank details, invite the family or a collector, review donations and approve comments.</p></div>
        <div className="button-row">
          <button className="button button-secondary" disabled={cases.isFetching} onClick={() => { void cases.refetch(); void awaiting.refetch(); }} type="button"><RefreshCw size={15} /> Refresh</button>
          <Link className="button button-primary" to="/donations/cases/new"><Plus size={15} /> New case</Link>
        </div>
      </header>
      {cases.error ? <div className="alert alert-error" role="alert">{errorText(cases.error)}</div> : null}
      <div className="dn-toolbar">
        <input aria-label="Search cases" onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, name or city" type="search" value={search} />
        <select aria-label="Category" onChange={(e) => setCategory(e.target.value)} value={category}><option value="">All categories</option>{categories.data?.map((c) => <option key={c.slug} value={c.slug}>{c.label_en}</option>)}</select>
        <label className="dn-toggle" style={{ minHeight: 42, padding: '0 12px' }}><input checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} type="checkbox" /> Has receipts to review</label>
      </div>
      <Chips onChange={setFilter} options={(['all', 'published', 'funded', 'draft', 'closed'] as Filter[]).map((f) => ({ id: f, label: f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1), count: count(f) }))} value={filter} />
      {cases.isLoading ? <p><LoaderCircle className="spin" size={16} /> Loading…</p> : null}
      {cases.data && rows.length === 0 ? <p className="dn-empty">{cases.data.length === 0 ? 'No cases yet. Create the first one.' : 'No case matches these filters.'}</p> : null}
      <div className="dn-cases">
        {rows.map((c) => {
          const waiting = awaiting.data?.get(c.id) ?? 0;
          return (
            <Link className="dn-case" key={c.id} to={`/donations/cases/${c.id}`}>
              <div className="dn-case-head">
                {c.photo_path ? <img alt="" className="dn-avatar" src={publicUrl(c.photo_path)} /> : <span className="dn-avatar dn-avatar-empty">{(c.beneficiary_name ?? c.title).slice(0, 1).toUpperCase()}</span>}
                <div style={{ minWidth: 0 }}>
                  <h3>{c.title}</h3>
                  <div className="dn-case-meta">{[c.beneficiary_name, c.age ? `${c.age} y/o` : null, c.city, label(c.category)].filter(Boolean).join(' · ') || 'No details yet'}</div>
                </div>
              </div>
              <ProgressBar donors={c.donor_count} goal={c.goal_mad} raised={c.raised_mad} />
              <div className="dn-badges">
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                {c.is_urgent ? <Badge tone="warn">Urgent</Badge> : null}
                {waiting > 0 ? <Badge tone="warn">{waiting} to review</Badge> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
