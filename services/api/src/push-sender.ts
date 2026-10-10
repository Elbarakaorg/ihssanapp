import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export type PushPayload = { title: string; body: string; url?: string; tag?: string; lang?: 'ar' | 'fr' | 'en' };
export type PushResult = { sent: number; removed: number };

export type PushSender = {
  /** Sends to the caller's own subscribed devices; RLS limits the lookup to rows owned by the access token's user. */
  sendToSelf(accessToken: string, userId: string, payload: PushPayload): Promise<PushResult>;
};

type Options = { supabaseUrl: string; publishableKey: string; vapidPublicKey?: string; vapidPrivateKey?: string; subject?: string };

export function createWebPushSender(options: Options): PushSender | null {
  const { vapidPublicKey, vapidPrivateKey } = options;
  if (!vapidPublicKey || !vapidPrivateKey) return null;
  const vapidDetails = { subject: options.subject ?? 'mailto:support@ihssanapp.com', publicKey: vapidPublicKey, privateKey: vapidPrivateKey };

  return {
    async sendToSelf(accessToken, userId, payload) {
      const client = createClient(options.supabaseUrl, options.publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
      const { data, error } = await client.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', userId).limit(10);
      if (error) throw new Error('Could not load notification subscriptions.');

      let sent = 0;
      let removed = 0;
      for (const row of data ?? []) {
        try {
          await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload), { TTL: 3600, vapidDetails });
          sent += 1;
        } catch (failure) {
          const status = (failure as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await client.rpc('delete_push_subscription', { p_endpoint: row.endpoint });
            removed += 1;
          }
        }
      }
      return { sent, removed };
    },
  };
}
