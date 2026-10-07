import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Share } from 'react-native';

import { supabaseClient } from '@/platform/supabase/client';
import type { SocialLink } from '@/features/doctor/doctor-api';
import { RECEIPT_LIMIT, caseShareUrl } from './donations-logic';

export const CASE_BUCKET = 'case-media';
const RECEIPT_BUCKET = 'donation-receipts';

function client() {
  if (!supabaseClient) throw new Error('The app is not configured.');
  return supabaseClient;
}

function fail(error: { message: string } | null, fallback: string): never {
  const message = error?.message ?? '';
  throw new Error(message && message.length < 140 && !/violates|constraint|function public|row-level|permission denied/i.test(message) ? message : fallback);
}

async function rpc<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

export type Category = { slug: string; label_en: string; label_ar: string; label_fr: string };
export type CaseSort = 'newest' | 'urgent' | 'nearly_funded' | 'least_funded' | 'most_funded';
export type CaseStatusFilter = 'active' | 'funded' | 'all';
export type CaseFilters = { category: string; city: string; status: CaseStatusFilter; search: string; urgent: boolean; sort: CaseSort };
export type CaseSummary = {
  id: string; title: string; summary: string; city: string | null; category: string | null; category_label: string | null; beneficiary_name: string | null; age: number | null;
  goal_mad: number; raised_mad: number; donor_count: number; percent: number; status: string; is_urgent: boolean; photo_path: string | null; published_at: string | null;
};
export type CaseDetail = Omit<CaseSummary, 'percent'> & {
  bio: string | null; min_donation_mad: number; social_links: SocialLink[]; contact: { phone: string | null; email: string | null } | null;
  media: { id: string; path: string; caption: string | null }[];
};
export type WallEntry = { display_name: string; amount_mad: number; comment: string | null; confirmed_at: string };
export type BankAccount = { id: string; bank_name: string; account_holder: string; account_number: string; note: string | null };
export type PledgeView = {
  id: string; reference: string; status: string; amount_mad: number; confirmed_amount_mad: number | null; display_name: string | null; is_anonymous: boolean; comment: string | null;
  expires_at: string; created_at: string; receipt_count: number; review_note: string | null; case_id: string; case_title: string; banks: BankAccount[]; can_upload: boolean;
};
export type MyPledge = { id: string; reference: string; case_id: string; case_title: string; amount_mad: number; status: string; created_at: string; expires_at: string };
export type CollectorCase = { id: string; title: string; status: string; goal_mad: number; raised_mad: number; donor_count: number; awaiting_review: number; role: 'admin' | 'collector' };
export type ReviewPledge = {
  id: string; reference: string; case_id: string; case_title: string; amount_mad: number; display_name: string | null; is_anonymous: boolean; comment: string | null; comment_visible: boolean;
  status: string; created_at: string; expires_at: string; receipt_paths: string[]; receipt_note: string | null; receipt_uploaded_at: string | null;
  confirmed_amount_mad: number | null; review_note: string | null; reviewed_at: string | null; donor_contact: string | null;
};

export const defaultFilters: CaseFilters = { category: '', city: '', status: 'active', search: '', urgent: false, sort: 'newest' };

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await client().from('donation_categories').select('slug,label_en,label_ar,label_fr').order('sort_order');
  if (error) fail(error, 'Could not load categories.');
  return (data ?? []) as Category[];
}

export const listCities = () => rpc<{ city: string; total: number }[]>('list_donation_case_cities', undefined, 'Could not load cities.').then((rows) => rows ?? []);

export const listCases = (filters: CaseFilters, offset: number, limit = 20) =>
  rpc<CaseSummary[]>('list_donation_cases', {
    p_category: filters.category || null, p_city: filters.city || null, p_status: filters.status, p_search: filters.search.trim() || null,
    p_urgent: filters.urgent, p_sort: filters.sort, p_limit: limit, p_offset: offset,
  }, 'Could not load cases.').then((rows) => rows ?? []);

export const getCase = (id: string) => rpc<CaseDetail | null>('get_donation_case', { p_id: id }, 'Could not load this case.');
export const listWall = (id: string) => rpc<WallEntry[]>('list_case_donations', { p_case_id: id, p_limit: 30 }, 'Could not load donations.').then((rows) => rows ?? []);

// Donation orders -----------------------------------------------------------------------------------------------------
type StoredPledge = { id: string; token: string; reference: string; caseId: string; caseTitle: string; amount: number; createdAt: string };
const STORE_KEY = 'ihssan.pledges.v1';

async function readStore(): Promise<StoredPledge[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? '[]');
    return Array.isArray(parsed) ? (parsed as StoredPledge[]).filter((item) => item && typeof item.id === 'string' && typeof item.token === 'string') : [];
  } catch {
    return [];
  }
}

export const listStoredPledges = readStore;
export async function getPledgeToken(id: string) {
  return (await readStore()).find((item) => item.id === id)?.token ?? null;
}

export async function createPledge(input: { caseId: string; caseTitle: string; amount: number; displayName: string; anonymous: boolean; comment: string; contact: string }) {
  const result = await rpc<{ id: string; reference: string; token: string; expires_at: string }>('create_donation_pledge', {
    p_case_id: input.caseId, p_amount: input.amount, p_display_name: input.anonymous ? null : input.displayName.trim() || null,
    p_is_anonymous: input.anonymous || !input.displayName.trim(), p_comment: input.comment.trim() || null, p_contact: input.contact.trim() || null,
  }, 'Could not start your donation order. Please try again.');
  const stored = await readStore();
  const next: StoredPledge = { id: result.id, token: result.token, reference: result.reference, caseId: input.caseId, caseTitle: input.caseTitle, amount: input.amount, createdAt: new Date().toISOString() };
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify([next, ...stored.filter((item) => item.id !== next.id)].slice(0, 30)));
  return result;
}

export async function getPledge(id: string): Promise<PledgeView | null> {
  return rpc<PledgeView | null>('get_pledge', { p_id: id, p_token: await getPledgeToken(id) }, 'Could not load your donation order.');
}

export async function cancelPledge(id: string) {
  await rpc('cancel_pledge', { p_id: id, p_token: await getPledgeToken(id) }, 'Could not cancel this order.');
}

export const listMyPledges = () => rpc<MyPledge[]>('list_my_pledges', undefined, 'Could not load your donations.').then((rows) => rows ?? []);

const randomId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Lets the donor pick up to the remaining number of receipt photos or screenshots, uploads them and attaches them to the order. */
export async function pickAndSubmitReceipt(pledgeId: string, remaining: number, note: string): Promise<number> {
  if (remaining <= 0) throw new Error(`You can attach up to ${RECEIPT_LIMIT} files.`);
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission is needed to choose your receipt.');
  const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, base64: true, mediaTypes: ['images'], quality: 0.8, selectionLimit: remaining });
  if (result.canceled) return 0;
  const paths: string[] = [];
  for (const asset of result.assets.slice(0, remaining)) {
    const mime = asset.mimeType ?? 'image/jpeg';
    if (!asset.base64 || !IMAGE_TYPES.includes(mime)) throw new Error('Choose a JPG, PNG, or WebP image.');
    if (asset.base64.length * 0.75 > 5.5 * 1024 * 1024) throw new Error('A file is too large. Choose images under 5 MB.');
    const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const path = `${pledgeId}/${randomId()}.${extension}`;
    const bytes = Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0));
    const { error } = await client().storage.from(RECEIPT_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error('Could not upload your receipt. Check your connection and try again.');
    paths.push(path);
  }
  if (!paths.length) return 0;
  await rpc('submit_pledge_receipt', { p_id: pledgeId, p_token: await getPledgeToken(pledgeId), p_paths: paths, p_note: note.trim() || null }, 'Could not attach your receipt.');
  return paths.length;
}

// Collectors ----------------------------------------------------------------------------------------------------------
export const listCollectorCases = () => rpc<CollectorCase[]>('list_my_collector_cases', undefined, 'Could not load your cases.').then((rows) => rows ?? []);
export const listCasePledges = (caseId: string, status?: string) =>
  rpc<ReviewPledge[]>('list_case_pledges', { p_case_id: caseId, p_status: status ?? null, p_limit: 100 }, 'Could not load donations.').then((rows) => rows ?? []);
export const reviewPledge = (input: { id: string; decision: 'confirm' | 'reject' | 'hide_comment'; amount?: number; note?: string; showComment?: boolean }) =>
  rpc('review_pledge', { p_id: input.id, p_decision: input.decision, p_amount: input.amount ?? null, p_note: input.note?.trim() || null, p_show_comment: input.showComment ?? true }, 'Could not save your decision.');
export const acceptCollectorInvite = (token: string) => rpc<{ case_id: string; case_title: string }>('accept_collector_invite', { p_token: token }, 'This invitation is invalid or has expired.');

export async function receiptUrl(path: string): Promise<string | null> {
  const { data } = await client().storage.from(RECEIPT_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// Sharing ---------------------------------------------------------------------------------------------------------------
export function caseLink(id: string) {
  const webBase = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_WEB_URL;
  return webBase ? caseShareUrl(webBase, id) : ExpoLinking.createURL(`/cases/${id}`);
}

export async function shareCase(id: string, title: string): Promise<'shared' | 'copied'> {
  const url = caseLink(id);
  const message = `${title} — help on Ihssan`;
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title: message, url }); return 'shared'; } catch { /* fall through to copy */ }
    }
    await Clipboard.setStringAsync(url);
    return 'copied';
  }
  await Share.share({ message: `${message}\n${url}`, url });
  return 'shared';
}
