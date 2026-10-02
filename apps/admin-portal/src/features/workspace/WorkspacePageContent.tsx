import { useMemo } from 'react';
import { ArrowUpRight, BookOpenText, ClipboardList, FileText, HeartHandshake, LayoutDashboard, MapPinned, ShieldCheck, UsersRound } from 'lucide-react';

import { hasPermission, type AdminMembership } from '../../lib/permission';

type Props = { membership: AdminMembership; onNavigate(path: string): void };

const capabilityItems = [
  { permission: 'support.requests.manage', title: 'Support inbox', detail: 'Requests, assignment, replies, and resolution.', path: '/support', icon: ClipboardList },
  { permission: 'metrics.edit', title: 'Metric Catalog', detail: 'Definitions, units, evidence, and education.', path: '/metrics', icon: LayoutDashboard },
  { permission: 'articles.edit', title: 'Articles', detail: 'Home-feed health and lifestyle articles.', path: '/articles', icon: BookOpenText },
  { permission: 'providers.verify', title: 'Provider verification', detail: 'Clinician credentials and directory records.', path: '/providers', icon: MapPinned },
  { permission: 'donations.review', title: 'Donation review', detail: 'Foundation cases and distribution evidence.', path: '/donations', icon: HeartHandshake },
  { permission: 'admin.audit.read', title: 'Audit history', detail: 'Purpose-limited administrative activity.', path: '/audit', icon: FileText },
];

export default function WorkspacePageContent({ membership, onNavigate }: Props) {
  const cards = useMemo(() => capabilityItems.filter((item) => hasPermission(membership, item.permission)), [membership]);
  const owner = membership.role === 'platform_owner';

  return (
    <div className="page-stack">
      <header className="page-header"><div><p className="eyebrow">IHSSAN OPERATIONS</p><h1>{owner ? 'Owner overview' : 'Support workspace'}</h1><p className="page-lede">{owner ? 'Manage the team and oversee the work queues.' : 'Your workspace is limited to permissions assigned by the platform owner.'}</p></div></header>
      <section className="summary-strip">
        <div><span className="summary-label">CURRENT ROLE</span><strong>{owner ? 'Platform owner' : 'Support administrator'}</strong></div>
        <div><span className="summary-label">ACCESS MODE</span><strong>{owner ? 'Owner authority' : 'Scoped permissions'}</strong></div>
        <div><span className="summary-label">ASSIGNED WORK</span><strong>{owner ? 'All operational queues' : `${membership.permissions.length} capabilities`}</strong></div>
      </section>
      <div className="section-heading"><div><h2>Available workspaces</h2><p>Only work permitted for your membership is shown.</p></div></div>
      {cards.length ? <div className="workspace-grid">{cards.map((item) => { const Icon = item.icon; return <button className="workspace-item" key={item.permission} onClick={() => onNavigate(item.path)}><span className="workspace-icon"><Icon size={19} /></span><span className="workspace-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowUpRight size={17} /></button>; })}</div> : <div className="empty-state">No support permissions are assigned. Contact the platform owner.</div>}
      {owner ? <button className="owner-shortcut" onClick={() => onNavigate('/team')}><UsersRound size={17} /><span>Manage support access</span><ArrowUpRight size={15} /></button> : null}
      {membership.role === 'support_admin' && membership.permissions.includes('metrics.review') && !membership.permissions.includes('articles.review') ? <p className="owner-note"><ShieldCheck size={15} /> Metric review is enabled. Health-content review also requires a separately verified clinician profile.</p> : null}
    </div>
  );
}
