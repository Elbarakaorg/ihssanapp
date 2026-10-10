export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on';

/** Converts the base64url VAPID public key into the bytes `pushManager.subscribe` expects. */
export function vapidKeyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = key.trim().replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.trim().length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function derivePushStatus(input: { supported: boolean; permission: NotificationPermission | 'default'; subscribed: boolean }): PushStatus {
  if (!input.supported) return 'unsupported';
  if (input.permission === 'denied') return 'denied';
  return input.subscribed && input.permission === 'granted' ? 'on' : 'off';
}
