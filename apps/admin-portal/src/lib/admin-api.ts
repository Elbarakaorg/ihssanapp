export type AdminMembership = {
  id: string;
  user_id: string;
  role: 'platform_owner' | 'support_admin';
  permissions: string[];
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
};

export type AdminPermission =
  | 'admin.audit.read'
  | 'support.requests.manage'
  | 'metrics.edit'
  | 'metrics.review'
  | 'metrics.publish'
  | 'articles.edit'
  | 'articles.review'
  | 'articles.publish'
  | 'providers.verify'
  | 'donations.review';

export const permissionOptions: Array<{ id: AdminPermission; label: string; description: string }> = [
  { id: 'support.requests.manage', label: 'Support requests', description: 'Read, assign, reply, and resolve support requests.' },
  { id: 'metrics.edit', label: 'Metric editing', description: 'Create metric definition and content drafts.' },
  { id: 'metrics.review', label: 'Metric review', description: 'Review metric content; requires verified clinician status.' },
  { id: 'metrics.publish', label: 'Metric publishing', description: 'Publish clinician-approved metric versions.' },
  { id: 'articles.edit', label: 'Article editing', description: 'Create and edit educational article drafts.' },
  { id: 'articles.review', label: 'Article review', description: 'Review health articles; requires verified clinician status.' },
  { id: 'articles.publish', label: 'Article publishing', description: 'Publish clinician-approved article versions.' },
  { id: 'providers.verify', label: 'Provider verification', description: 'Review clinician/provider verification requests.' },
  { id: 'donations.review', label: 'Donation review', description: 'Review donation cases and moderation decisions.' },
  { id: 'admin.audit.read', label: 'Audit read access', description: 'Read purpose-limited administrative audit events.' },
];

function resolveApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredUrl && configuredUrl !== 'http://localhost:4000') return configuredUrl;

  const codespacesHost = window.location.hostname.match(/^(.+)-5173\.app\.github\.dev$/);
  if (codespacesHost) return '/api';

  return configuredUrl ?? 'http://localhost:4000';
}

const apiBaseUrl = resolveApiBaseUrl();

export async function adminApi<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const requestUrl = apiBaseUrl.startsWith('/')
    ? `${apiBaseUrl}${path}`
    : new URL(path, apiBaseUrl).toString();
  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status}).`);
  return body as T;
}
