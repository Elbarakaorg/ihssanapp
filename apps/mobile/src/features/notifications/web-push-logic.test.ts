import { describe, expect, it } from 'vitest';

import { derivePushStatus, vapidKeyToBytes } from './web-push-logic';

describe('web push helpers', () => {
  it('decodes a base64url VAPID key into bytes', () => {
    // 65-byte uncompressed P-256 point encodes to 87 base64url chars (no padding); '-' and '_' must be handled.
    const key = 'BEl62iUYgUivxIkv69yViEuiBIa-Zv3_Sd4TUBz3MKaQhJNr7qLkYBMYxYrLWJxRkNL0Um1xNXUYQwMEJMWVRTE';
    const bytes = vapidKeyToBytes(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });

  it('derives the notification state', () => {
    expect(derivePushStatus({ supported: false, permission: 'default', subscribed: false })).toBe('unsupported');
    expect(derivePushStatus({ supported: true, permission: 'denied', subscribed: false })).toBe('denied');
    expect(derivePushStatus({ supported: true, permission: 'default', subscribed: false })).toBe('off');
    expect(derivePushStatus({ supported: true, permission: 'granted', subscribed: false })).toBe('off');
    expect(derivePushStatus({ supported: true, permission: 'granted', subscribed: true })).toBe('on');
  });
});
