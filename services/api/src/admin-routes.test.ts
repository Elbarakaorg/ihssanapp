import { describe, expect, it, vi } from 'vitest';

import { createApi } from './app.js';
import type { AdminMembership, DataAccess } from './data-access.js';

const ownerMembership: AdminMembership = {
  id: 'membership-owner',
  user_id: 'owner-id',
  role: 'platform_owner',
  permissions: [],
  granted_by: null,
  granted_at: '2026-09-27T00:00:00Z',
  revoked_at: null,
};

const supportMembership: AdminMembership = {
  ...ownerMembership,
  id: 'membership-support',
  user_id: 'support-id',
  role: 'support_admin',
  permissions: ['metrics.edit'],
  granted_by: 'owner-id',
};

function makeDataAccess(actorId: string, actorMembership: AdminMembership | null): DataAccess {
  return {
    verifyAccessToken: vi.fn(async (token) => token === aal2Token ? { id: actorId, email: null } : null),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    listMetricDefinitions: vi.fn(),
    listMeasurements: vi.fn(),
    createMeasurement: vi.fn(),
    getAdminMembership: vi.fn(async () => actorMembership),
    listAdminMemberships: vi.fn(async () => [supportMembership]),
    grantSupportAdmin: vi.fn(async () => 'new-membership-id'),
    updateSupportAdminPermissions: vi.fn(async () => undefined),
    revokeSupportAdmin: vi.fn(async () => undefined),
    acceptSupportAdminInvitation: vi.fn(async () => false),
    listSupportAdminInvitations: vi.fn(async () => []),
    inviteSupportAdminByEmail: vi.fn(async () => 'new-invitation-id'),
    revokeSupportAdminInvitation: vi.fn(async () => undefined),
  };
}

const aal2Token = `x.${Buffer.from(JSON.stringify({ aal: 'aal2' })).toString('base64url')}.y`;
describe('admin membership routes', () => {
  it('denies membership management to a support admin even when signed in', async () => {
    const dataAccess = makeDataAccess('support-id', supportMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/memberships', {
      headers: { Authorization: `Bearer ${aal2Token}` },
    });

    expect(response.status).toBe(403);
    expect(dataAccess.listAdminMemberships).not.toHaveBeenCalled();
  });

  it('denies membership management to ordinary signed-in users', async () => {
    const app = createApi(makeDataAccess('patient-id', null));
    const response = await app.request('/v1/admin/memberships', {
      headers: { Authorization: `Bearer ${aal2Token}` },
    });

    expect(response.status).toBe(403);
  });

  it('allows the platform owner to grant only the provided support permissions', async () => {
    const dataAccess = makeDataAccess('owner-id', ownerMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/memberships', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'f65ca080-93a5-46c0-a6c8-7d933e9f4f31', permissions: ['articles.edit'] }),
    });

    expect(response.status).toBe(201);
    expect(dataAccess.grantSupportAdmin).toHaveBeenCalledWith(aal2Token, 'f65ca080-93a5-46c0-a6c8-7d933e9f4f31', ['articles.edit']);
  });

  it('rejects the reserved membership-management permission in support grants', async () => {
    const dataAccess = makeDataAccess('owner-id', ownerMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/memberships', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'f65ca080-93a5-46c0-a6c8-7d933e9f4f31', permissions: ['admin.memberships.manage'] }),
    });

    expect(response.status).toBe(400);
    expect(dataAccess.grantSupportAdmin).not.toHaveBeenCalled();
  });
});

describe('email-based support invitations', () => {
  it('allows the owner to invite an email with a scoped permission set', async () => {
    const dataAccess = makeDataAccess('owner-id', ownerMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ' Support.Person@example.com ', permissions: ['support.requests.manage', 'articles.edit'] }),
    });

    expect(response.status).toBe(201);
    expect(dataAccess.inviteSupportAdminByEmail).toHaveBeenCalledWith(
      aal2Token,
      'support.person@example.com',
      ['support.requests.manage', 'articles.edit'],
    );
  });

  it('reports sent only after the configured invitation mailer accepts the email', async () => {
    const dataAccess = makeDataAccess('owner-id', ownerMembership);
    const send = vi.fn(async () => undefined);
    const app = createApi(dataAccess, [], { send });
    const response = await app.request('/v1/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new.person@example.com', permissions: ['articles.edit'] }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ delivery: 'sent' });
    expect(send).toHaveBeenCalledWith({ email: 'new.person@example.com' });
  });

  it('rejects invitation management for support admins', async () => {
    const dataAccess = makeDataAccess('support-id', supportMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new.person@example.com', permissions: ['articles.edit'] }),
    });

    expect(response.status).toBe(403);
    expect(dataAccess.inviteSupportAdminByEmail).not.toHaveBeenCalled();
  });

  it('rejects invalid email or permission input before calling the database', async () => {
    const dataAccess = makeDataAccess('owner-id', ownerMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', permissions: ['admin.memberships.manage'] }),
    });

    expect(response.status).toBe(400);
    expect(dataAccess.inviteSupportAdminByEmail).not.toHaveBeenCalled();
  });

  it('checks for a verified email invitation before resolving admin membership', async () => {
    const dataAccess = makeDataAccess('support-id', supportMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/me', {
      headers: { Authorization: `Bearer ${aal2Token}` },
    });

    expect(response.status).toBe(200);
    expect(dataAccess.acceptSupportAdminInvitation).toHaveBeenCalledWith(aal2Token);
    expect(dataAccess.getAdminMembership).toHaveBeenCalledWith(aal2Token, 'support-id');
  });
});

describe('email-first support invitations', () => {
  it('allows only the owner to create an email invitation with scoped permissions', async () => {
    const dataAccess = makeDataAccess('owner-id', ownerMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ' Support.Person@example.com ', permissions: ['support.requests.manage', 'articles.edit'] }),
    });

    expect(response.status).toBe(201);
    expect(dataAccess.inviteSupportAdminByEmail).toHaveBeenCalledWith(
      aal2Token,
      'support.person@example.com',
      ['support.requests.manage', 'articles.edit'],
    );
  });

  it('does not let a support admin create another invitation', async () => {
    const dataAccess = makeDataAccess('support-id', supportMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new.person@example.com', permissions: ['articles.edit'] }),
    });

    expect(response.status).toBe(403);
    expect(dataAccess.inviteSupportAdminByEmail).not.toHaveBeenCalled();
  });

  it('rejects invalid email and permission payloads before calling the database', async () => {
    const dataAccess = makeDataAccess('owner-id', ownerMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aal2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', permissions: ['admin.memberships.manage'] }),
    });

    expect(response.status).toBe(400);
    expect(dataAccess.inviteSupportAdminByEmail).not.toHaveBeenCalled();
  });

  it('checks for and accepts a confirmed email invitation before loading admin membership', async () => {
    const dataAccess = makeDataAccess('support-id', supportMembership);
    const app = createApi(dataAccess);
    const response = await app.request('/v1/admin/me', {
      headers: { Authorization: `Bearer ${aal2Token}` },
    });

    expect(response.status).toBe(200);
    expect(dataAccess.acceptSupportAdminInvitation).toHaveBeenCalledWith(aal2Token);
    expect(dataAccess.getAdminMembership).toHaveBeenCalledAfter(dataAccess.acceptSupportAdminInvitation as never);
  });
});
