import type { AdminMembership } from './data-access.js';

export const supportPermissions = [
  'admin.audit.read',
  'support.requests.manage',
  'metrics.edit',
  'metrics.review',
  'metrics.publish',
  'articles.edit',
  'articles.review',
  'articles.publish',
  'providers.verify',
  'donations.review',
] as const;

export type SupportPermission = typeof supportPermissions[number];

export function hasPermission(membership: AdminMembership | null, permission: SupportPermission): boolean {
  if (!membership || membership.revoked_at !== null) return false;
  if (membership.role === 'platform_owner') return true;
  return membership.permissions.includes(permission);
}

export function canManageMemberships(membership: AdminMembership | null): boolean {
  return membership?.role === 'platform_owner' && membership.revoked_at === null;
}

export function canAccessAdminPortal(membership: AdminMembership | null): boolean {
  return !!membership && membership.revoked_at === null;
}
