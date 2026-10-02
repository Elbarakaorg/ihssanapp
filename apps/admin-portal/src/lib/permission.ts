export const adminPermissionLabels: Record<string, string> = {
  'admin.audit.read': 'Audit log',
  'support.requests.manage': 'Support requests',
  'metrics.edit': 'Metric editing',
  'metrics.review': 'Metric review',
  'metrics.publish': 'Metric publishing',
  'articles.edit': 'Article editing',
  'articles.review': 'Article review',
  'articles.publish': 'Article publishing',
  'providers.verify': 'Provider verification',
  'donations.review': 'Donation review',
};

export type AdminMembership = {
  id: string;
  user_id: string;
  role: 'platform_owner' | 'support_admin';
  permissions: string[];
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
};

export function hasPermission(membership: AdminMembership, permission: string) {
  return membership.role === 'platform_owner' || membership.permissions.includes(permission);
}
