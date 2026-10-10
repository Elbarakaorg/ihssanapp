import { describe, expect, it, vi } from 'vitest';

import { createApi } from './app.js';
import type { DataAccess } from './data-access.js';
import type { PushSender } from './push-sender.js';

function dataAccess(): DataAccess {
  return {
    verifyAccessToken: vi.fn(async (token) => token === 'good' ? { id: 'user-1', email: null } : null),
    getProfile: vi.fn(async () => ({ id: 'user-1', display_name: 'Test', preferred_locale: 'fr' })),
  } as unknown as DataAccess;
}

const request = (app: ReturnType<typeof createApi>, token?: string) =>
  app.request('/v1/push/test', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe('POST /v1/push/test', () => {
  it('requires sign-in', async () => {
    const sender: PushSender = { sendToSelf: vi.fn() };
    expect((await request(createApi(dataAccess(), [], null, null, null, sender))).status).toBe(401);
    expect(sender.sendToSelf).not.toHaveBeenCalled();
  });

  it('is unavailable until VAPID keys are configured', async () => {
    expect((await request(createApi(dataAccess()), 'good')).status).toBe(503);
  });

  it('sends in the user language to the caller only', async () => {
    const sender: PushSender = { sendToSelf: vi.fn(async () => ({ sent: 1, removed: 0 })) };
    const response = await request(createApi(dataAccess(), [], null, null, null, sender), 'good');
    expect(response.status).toBe(200);
    expect(sender.sendToSelf).toHaveBeenCalledWith('good', 'user-1', expect.objectContaining({ lang: 'fr', url: '/' }));
  });

  it('reports when no device is subscribed', async () => {
    const sender: PushSender = { sendToSelf: vi.fn(async () => ({ sent: 0, removed: 1 })) };
    expect((await request(createApi(dataAccess(), [], null, null, null, sender), 'good')).status).toBe(404);
  });

  it('limits repeated tests', async () => {
    const sender: PushSender = { sendToSelf: vi.fn(async () => ({ sent: 1, removed: 0 })) };
    const app = createApi(dataAccess(), [], null, null, null, sender);
    for (let i = 0; i < 3; i++) await request(app, 'good');
    expect((await request(app, 'good')).status).toBe(429);
  });
});
