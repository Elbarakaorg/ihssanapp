import { describe, expect, it } from 'vitest';

import { canAccessAdminPortal, canManageMemberships, hasPermission } from './admin-permissions.js';
import type { AdminMembership } from './data-access.js';

const owner: AdminMembership = {
  id: 'membership-owner',
  user_id: 'owner-user',
  role: 'platform_owner',
  permissions: [],
  granted_by: null,
  granted_at: '2026-09-27T00:00:00Z',
  revoked_at: null,
};

const support: AdminMembership = {
  ...owner,
  id: 'membership-support',
  user_id: 'support-user',
  role: 'support_admin',
  permissions: ['support.requests.manage', 'articles.edit'],
  granted_by: 'owner-user',
};

describe('admin permission boundaries', () => {
  it('gives the platform owner all capabilities but only the owner can manage memberships', () => {
    expect(hasPermission(owner, 'articles.publish')).toBe(true);
    expect(canManageMemberships(owner)).toBe(true);
    expect(canManageMemberships(support)).toBe(false);
  });

  it('limits support members to explicitly granted capabilities', () => {
    expect(canAccessAdminPortal(support)).toBe(true);
    expect(hasPermission(support, 'support.requests.manage')).toBe(true);
    expect(hasPermission(support, 'articles.edit')).toBe(true);
    expect(hasPermission(support, 'articles.publish')).toBe(false);
    expect(hasPermission(support, 'admin.audit.read')).toBe(false);
  });

  it('denies access for absent or revoked memberships', () => {
    expect(canAccessAdminPortal(null)).toBe(false);
    expect(hasPermission({ ...support, revoked_at: '2026-09-27T01:00:00Z' }, 'articles.edit')).toBe(false);
  });
});
