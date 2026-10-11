import { Platform } from 'react-native';

import { supabaseClient } from '@/platform/supabase/client';
import { derivePushStatus, vapidKeyToBytes, type PushStatus } from './web-push-logic';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '');

let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (isWeb) {
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installEvent = event as InstallPromptEvent; notify(); });
  window.addEventListener('appinstalled', () => { installEvent = null; notify(); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined); });
}

export function onInstallStateChange(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const canPromptInstall = () => installEvent !== null;

export function isInstalledApp() {
  return isWeb && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export async function promptInstall() {
  if (!installEvent) return 'unavailable' as const;
  const event = installEvent;
  installEvent = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome;
}

export const webPushSupported = () => isWeb && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!vapidPublicKey && !!supabaseClient;

async function registration() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready);
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!webPushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  return derivePushStatus({ supported: true, permission: Notification.permission, subscribed: subscription !== null });
}

export async function enablePush(): Promise<PushStatus> {
  if (!webPushSupported() || !supabaseClient || !vapidPublicKey) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return derivePushStatus({ supported: true, permission, subscribed: false });
  const reg = await registration();
  const subscription = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToBytes(vapidPublicKey) });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('This browser did not return a valid push subscription.');
  const { error } = await supabaseClient.rpc('save_push_subscription', { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth, p_user_agent: navigator.userAgent });
  if (error) { await subscription.unsubscribe().catch(() => undefined); throw new Error('Could not save notifications for your account. Please sign in and try again.'); }
  return 'on';
}

export async function disablePush(): Promise<PushStatus> {
  if (!isWeb || !supabaseClient) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  if (subscription) {
    await supabaseClient.rpc('delete_push_subscription', { p_endpoint: subscription.endpoint });
    await subscription.unsubscribe().catch(() => undefined);
  }
  return derivePushStatus({ supported: true, permission: Notification.permission, subscribed: false });
}

export async function sendTestPush(): Promise<void> {
  if (!supabaseClient || !apiBaseUrl) throw new Error('Notifications are not available yet.');
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const response = await fetch(`${apiBaseUrl}/v1/push/test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not send a test notification.');
}
