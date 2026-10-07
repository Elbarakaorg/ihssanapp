import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BookOpenText, ClipboardList, FileText, HeartHandshake, LayoutDashboard, LogOut, MapPinned, Shield, UsersRound } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

import { adminApi } from '../../lib/admin-api';
import { useAdminAuth } from '../../lib/auth-store';
import { hasPermission, type AdminMembership } from '../../lib/permission';
import { supabase } from '../../lib/supabase';
import TeamPage from '../team/TeamPage';
import MetricCatalogPage from '../metrics/MetricCatalogPage';
import LocationsPage from '../locations/LocationsPage';
import ModerationPage from '../moderation/ModerationPage';
import ProvidersPage from '../providers/ProvidersPage';
import RestrictedPage from '../workspace/RestrictedPage';
import WorkspacePageContent from '../workspace/WorkspacePageContent';

type MembershipResponse = { membership: AdminMembership | null };

type NavigationItem = {
  path: string;
  label: string;
  permission?: string;
  anyPermissions?: string[];
  ownerOnly?: boolean;
  icon: typeof LayoutDashboard;
};

const navigation: NavigationItem[] = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/support', label: 'Support inbox', permission: 'support.requests.manage', icon: ClipboardList },
  { path: '/metrics', label: 'Metric Catalog', anyPermissions: ['metrics.edit', 'metrics.review', 'metrics.publish'], icon: Activity },
  { path: '/articles', label: 'Articles', permission: 'articles.edit', icon: BookOpenText },
  { path: '/moderation', label: 'Comment reports', permission: 'support.requests.manage', icon: ClipboardList },
  { path: '/locations', label: 'Map locations', permission: 'providers.verify', icon: MapPinned },
  { path: '/providers', label: 'Provider verification', permission: 'providers.verify', icon: Shield },
  { path: '/donations', label: 'Donation cases', permission: 'donations.review', icon: HeartHandshake },
  { path: '/audit', label: 'Audit log', permission: 'admin.audit.read', icon: FileText },
  { path: '/team', label: 'Team access', ownerOnly: true, icon: UsersRound },
];

export default function AdminConsole() {
  const { session, ready, error } = useAdminAuth();

  if (!supabase) return <ConfigurationError />;
  if (!ready) return <LoadingScreen label="Checking admin session" />;
  if (!session) return <SignInScreen initialError={error} />;

  return <AdminAccess session={session} />;
}

function SignInScreen({ initialError }: { initialError: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState(initialError);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setSubmitting(false);
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setGoogleSubmitting(true);
    setError('');
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (googleError) {
      setError(googleError.message);
      setGoogleSubmitting(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <div className="brand-lockup"><span className="brand-mark">ih</span><span>ihssan</span><span className="brand-divider" /><span className="brand-section">Administration</span></div>
        <p className="eyebrow">SECURE STAFF ACCESS</p>
        <h1>Sign in to the admin portal</h1>
        <p className="auth-lede">Use your authorized staff account. If you signed up with Google, choose Continue with Google; no separate password is needed. Patient or clinician sign-in alone does not grant admin access.</p>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="admin-email">Email</label>
          <input id="admin-email" autoComplete="username" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
          <button className="button button-primary button-full" disabled={submitting} type="submit">{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="auth-divider"><span />OR<span /></div>
        <button className="button button-google button-full" disabled={googleSubmitting} onClick={() => void signInWithGoogle()} type="button">
          <span className="google-g">G</span>{googleSubmitting ? 'Connecting to Google…' : 'Continue with Google'}
        </button>
        <p className="fine-print">Admin membership is assigned by the platform owner and enforced by the API and database.</p>
      </section>
      <aside className="auth-aside"><div className="aside-rule" /><p>IHSSAN · OPERATIONS</p><h2>People, content, and care—managed with clear boundaries.</h2><span>Morocco · Arabic · Français · English</span></aside>
    </main>
  );
}

function AdminAccess({ session }: { session: Session }) {
  const [membership, setMembership] = useState<AdminMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void adminApi<MembershipResponse>('/v1/admin/me', session.access_token)
      .then((response) => {
        if (active) setMembership(response.membership);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Admin access could not be verified.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [session.access_token]);

  if (loading) return <LoadingScreen label="Verifying admin permissions" />;
  if (!membership) return <NoAdminAccess error={error} />;

  return <AdminShell membership={membership} session={session} />;
}

function AdminShell({ membership, session }: { membership: AdminMembership; session: Session }) {
  const location = useLocation();
  const items = useMemo(() => navigation.filter((item) => {
    if (item.ownerOnly) return membership.role === 'platform_owner';
    if (item.anyPermissions) return item.anyPermissions.some((permission) => hasPermission(membership, permission));
    return !item.permission || hasPermission(membership, item.permission);
  }), [membership]);
  const roleLabel = membership.role === 'platform_owner' ? 'Platform owner' : 'Support administrator';
  const currentPage = items.find((item) => item.path === location.pathname)?.label ?? 'Admin workspace';

  const signOut = async () => {
    await supabase?.auth.signOut({ scope: 'local' });
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-mark">ih</span><span>ihssan</span></div>
        <p className="sidebar-caption">ADMINISTRATION</p>
        <nav className="side-nav">
          {items.map((item) => {
            const Icon = item.icon;
            return <NavLink end={item.path === '/'} key={item.path} to={item.path} className={({ isActive }) => `nav-item${isActive ? ' nav-item-active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.ownerOnly ? <span className="owner-mark">OWNER</span> : null}</NavLink>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <span className="role-pill">{roleLabel}</span>
          <span className="sidebar-email">{session.user.email}</span>
          <button className="signout-button" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar"><div><span className="breadcrumb">Ihssan</span><span className="breadcrumb-sep">/</span><strong>{currentPage}</strong></div><span className="environment-badge">DEVELOPMENT</span></header>
        <main className="content-area">
          <Routes>
            <Route path="/" element={<WorkspacePage membership={membership} />} />
            <Route path="/team" element={membership.role === 'platform_owner' ? <TeamPage session={session} /> : <Navigate to="/" replace />} />
            <Route path="/support" element={<RestrictedPage title="Support inbox" eyebrow="CUSTOMER OPERATIONS" description="Requests are visible only to their requester and support members with the support.requests.manage capability." detail="The support data contract is defined in Supabase. The API inbox endpoints are the next delivery slice; this route is permission-gated and ready to connect." />} />
            <Route path="/metrics" element={<MetricCatalogPage membership={membership} session={session} />} />
            <Route path="/articles" element={<RestrictedPage title="Articles" eyebrow="EDITORIAL" description="Home-feed articles are managed separately from structured metric explanations and ranges." detail="Localized article schema, permissions, review, and publication flow are defined. The article editor and feed API are the next feature slice." />} />
            <Route path="/moderation" element={<ModerationPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/providers" element={<ProvidersPage />} />
            <Route path="/donations" element={<RestrictedPage title="Donation review" eyebrow="FOUNDATION" description="Review cases and distribution evidence before publication." detail="Case moderation and fund-distribution workflows will connect to the foundation operations module." />} />
            <Route path="/audit" element={<RestrictedPage title="Audit log" eyebrow="SECURITY" description="Review administrative changes for which you have audit permission." detail="Audit access is read-only and purpose-limited. Audit export and filters will be added with the operations API." />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function WorkspacePage({ membership }: { membership: AdminMembership }) {
  const navigate = useNavigate();
  return <WorkspacePageContent membership={membership} onNavigate={navigate} />;
}

function LoadingScreen({ label }: { label: string }) {
  return <main className="center-state"><span className="loading-mark" /><p>{label}</p></main>;
}

function NoAdminAccess({ error }: { error: string }) {
  return <main className="center-state"><div className="denied-symbol">!</div><p className="eyebrow">{error ? 'ACCESS CHECK FAILED' : 'ACCESS NOT ASSIGNED'}</p><h1>{error ? 'Admin access could not be verified' : 'This account has no admin permissions'}</h1><p>{error || 'Ask the platform owner to grant a support-admin membership.'}</p><button className="button button-secondary" onClick={() => void supabase?.auth.signOut({ scope: 'local' })}>Sign out</button></main>;
}

function ConfigurationError() {
  return <main className="center-state"><p className="eyebrow">ADMIN SETUP</p><h1>Supabase is not configured</h1><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in this app’s local environment.</p></main>;
}
