import { supabase } from '../../lib/supabase';

export const SOCIAL = ['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'website', 'whatsapp'] as const;
export const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? 'https://ihssanapp.com';

export type Category = { slug: string; label_en: string };
export type CaseRow = {
  id: string; slug: string; title: string; summary: string; city: string | null; goal_mad: number; raised_mad: number; initial_raised_mad: number; donor_count: number; status: string;
  category: string | null; beneficiary_name: string | null; age: number | null; bio: string | null; photo_path: string | null; min_donation_mad: number; is_urgent: boolean;
  social_links: { kind: string; url: string }[] | null; contact_phone: string | null; contact_email: string | null; show_contact: boolean; verification_note: string | null;
  created_at: string; updated_at: string;
};
export type CaseForm = {
  id: string | null; slug: string; title: string; city: string; goal_mad: string; initial_raised_mad: string; min_donation_mad: string; status: string; category: string;
  beneficiary_name: string; age: string; bio: string; photo_path: string; is_urgent: boolean; social_links: { kind: string; url: string }[];
  contact_phone: string; contact_email: string; show_contact: boolean; verification_note: string;
};
export type Pledge = {
  id: string; reference: string; case_id: string; case_title: string; amount_mad: number; display_name: string | null; is_anonymous: boolean; comment: string | null; comment_visible: boolean;
  status: string; created_at: string; expires_at: string; receipt_paths: string[]; receipt_note: string | null; receipt_uploaded_at: string | null;
  confirmed_amount_mad: number | null; review_note: string | null; reviewed_at: string | null; donor_contact: string | null;
  payer_name: string | null; paid_marked_at: string | null; source: 'platform' | 'external'; received_on: string | null;
};
export type CommentRow = {
  id: string; reference: string; case_id: string; case_title: string; display_name: string | null; is_anonymous: boolean; comment: string; comment_status: 'pending' | 'approved' | 'hidden';
  amount_mad: number | null; confirmed_at: string; kind: 'donation' | 'wish';
};
export type Member = { id: string; kind: 'collector' | 'invite'; label: string | null; user_name: string | null; created_at: string; expires_at: string | null; role: 'collector' | 'beneficiary' };
export type Bank = { id: string; bank_name: string; account_holder: string; account_number: string | null; rib: string | null; note: string | null; is_active: boolean };
export type Media = { id: string; path: string; caption: string | null };
export type Video = { id: string; kind: 'instagram' | 'upload'; url: string | null; path: string | null; caption: string | null };
export type Audio = { id: string; path: string; title: string | null; duration_seconds: number | null };
export type Analytics = {
  totals: { cases: number; published: number; funded: number; draft: number; closed: number; goal_mad: number; raised_mad: number; initial_mad: number };
  pledges: {
    confirmed: number; awaiting_review: number; pending_transfer: number; rejected: number; expired: number; reversed: number; confirmed_mad: number; average_mad: number;
    largest_mad: number; anonymous: number; pending_comments: number; oldest_awaiting: string | null; external_mad: number; external_count: number;
  };
  daily: { day: string; amount_mad: number; count: number }[];
  by_category: { category: string; label: string; cases: number; goal_mad: number; raised_mad: number }[];
  top_cases: { id: string; title: string; status: string; goal_mad: number; raised_mad: number; donor_count: number; awaiting: number }[];
};

export const blankForm: CaseForm = {
  id: null, slug: '', title: '', city: '', goal_mad: '', initial_raised_mad: '0', min_donation_mad: '20', status: 'draft', category: '', beneficiary_name: '', age: '', bio: '',
  photo_path: '', is_urgent: false, social_links: [], contact_phone: '', contact_email: '', show_contact: false, verification_note: '',
};

export const formFromRow = (r: CaseRow): CaseForm => ({
  id: r.id, slug: r.slug, title: r.title, city: r.city ?? '', goal_mad: String(r.goal_mad), initial_raised_mad: String(r.initial_raised_mad), min_donation_mad: String(r.min_donation_mad),
  status: r.status === 'funded' ? 'published' : r.status, category: r.category ?? '', beneficiary_name: r.beneficiary_name ?? '', age: r.age === null ? '' : String(r.age), bio: r.bio ?? '',
  photo_path: r.photo_path ?? '', is_urgent: r.is_urgent, social_links: r.social_links ?? [], contact_phone: r.contact_phone ?? '', contact_email: r.contact_email ?? '',
  show_contact: r.show_contact, verification_note: r.verification_note ?? '',
});

export const db = () => { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; };
export const mad = (n: number) => `${new Intl.NumberFormat('en-US').format(n)} MAD`;
export const percent = (raised: number, goal: number) => (goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0);
export const check = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
export const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Something went wrong.');
export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export async function upload(caseId: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${caseId}/${crypto.randomUUID()}.${ext}`;
  check((await db().storage.from('case-media').upload(path, file, { contentType: file.type })).error);
  return path;
}
export const publicUrl = (path: string) => db().storage.from('case-media').getPublicUrl(path).data.publicUrl;

const MEDIA = {
  video: { bucket: 'case-videos', types: { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }, max: 50 },
  audio: { bucket: 'case-audio', types: { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/aac': 'aac' }, max: 10 },
} as const;
export async function uploadMedia(kind: keyof typeof MEDIA, caseId: string, file: File) {
  const cfg = MEDIA[kind];
  const ext = (cfg.types as Record<string, string>)[file.type];
  if (!ext) throw new Error(`Unsupported ${kind} format.`);
  if (file.size > cfg.max * 1024 * 1024) throw new Error(`The ${kind} must be under ${cfg.max} MB.`);
  const path = `${caseId}/${crypto.randomUUID()}.${ext}`;
  check((await db().storage.from(cfg.bucket).upload(path, file, { contentType: file.type })).error);
  return path;
}
export const mediaUrl = (bucket: 'case-videos' | 'case-audio', path: string) => db().storage.from(bucket).getPublicUrl(path).data.publicUrl;
export const caseUrl = (c: { id: string; slug?: string | null }) => `${APP_URL}/cases/${c.slug || c.id}`;

export async function openReceipt(path: string) {
  const { data, error } = await db().storage.from('donation-receipts').createSignedUrl(path, 300);
  if (error || !data) throw new Error('Could not open the receipt.');
  return data.signedUrl;
}

export async function saveCase(form: CaseForm) {
  const { data, error } = await db().rpc('admin_save_donation_case', {
    p: { ...form, goal_mad: Number(form.goal_mad), initial_raised_mad: Number(form.initial_raised_mad || 0), min_donation_mad: Number(form.min_donation_mad || 20), age: form.age === '' ? null : Number(form.age) },
  });
  check(error);
  return data as string;
}

export const STATUS_LABEL: Record<string, string> = {
  receipt_submitted: 'Awaiting review', pledged: 'Pending transfer', confirmed: 'Confirmed', rejected: 'Rejected', expired: 'Expired', reversed: 'Reversed', cancelled: 'Cancelled',
};
