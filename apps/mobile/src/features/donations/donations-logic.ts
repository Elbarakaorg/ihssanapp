export const MAX_DONATION_MAD = 1_000_000;
export const RECEIPT_LIMIT = 3;

export type PledgeStatus = 'pledged' | 'receipt_submitted' | 'confirmed' | 'rejected' | 'expired' | 'cancelled' | 'reversed';

export function formatMad(value: number) {
  return `${Math.round(value).toLocaleString('en-US')} MAD`;
}

export function percentFunded(raised: number, goal: number) {
  if (!(goal > 0)) return 0;
  return Math.max(0, Math.min(100, Math.floor((raised / goal) * 100)));
}

export function suggestedAmounts(minimum: number, remaining: number) {
  const base = [50, 100, 200, 500, 1000].filter((value) => value >= minimum);
  const capped = remaining > 0 ? base.filter((value) => value <= Math.max(remaining, minimum)) : base;
  return (capped.length ? capped : [minimum]).slice(0, 5);
}

/** Parses a typed donation amount; accepts Arabic-Indic digits and thousands separators. Returns null if not a whole positive number. */
export function parseAmount(text: string) {
  const western = text.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[\s,.'’٬]/g, '');
  if (!/^\d{1,8}$/.test(western)) return null;
  const value = Number(western);
  return value > 0 ? value : null;
}

export const isValidEmail = (value: string) => value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function validateAmount(value: number | null, minimum: number) {
  if (value === null) return 'Enter the amount in MAD.';
  if (value < minimum) return `The minimum donation is ${minimum} MAD.`;
  if (value > MAX_DONATION_MAD) return 'Please contact us for donations above 1,000,000 MAD.';
  return '';
}

export function timeLeft(expiresAt: string, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (!(ms > 0)) return { expired: true, label: 'Expired' };
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { expired: false, label: hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m left` : `${Math.max(minutes, 1)} min left` };
}

const STATUS: Record<PledgeStatus, { label: string; tone: 'wait' | 'ok' | 'bad' | 'info'; hint: string }> = {
  pledged: { label: 'Waiting for your transfer', tone: 'wait', hint: 'Send the transfer, then come back and upload your receipt.' },
  receipt_submitted: { label: 'Receipt under review', tone: 'info', hint: 'The fund collector will confirm once the money is received.' },
  confirmed: { label: 'Confirmed — jazakum Allah khayran', tone: 'ok', hint: 'Your donation now counts toward the goal.' },
  rejected: { label: 'Could not be confirmed', tone: 'bad', hint: 'See the note below. You can start a new order.' },
  expired: { label: 'Order expired', tone: 'bad', hint: 'If you already sent the money, upload your receipt within 7 days.' },
  cancelled: { label: 'Cancelled', tone: 'bad', hint: 'This order was cancelled.' },
  reversed: { label: 'Reversed', tone: 'bad', hint: 'This donation was reversed by the foundation. See the note below.' },
};

export function pledgeStatus(status: string) {
  return STATUS[status as PledgeStatus] ?? { label: status, tone: 'info' as const, hint: '' };
}

export function safeHttpsUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** `key` is the case id or its readable link name (the beneficiary's name). */
export const caseShareUrl = (webBase: string, key: string) => `${webBase.replace(/\/+$/, '')}/cases/${encodeURIComponent(key)}`;
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Returns the embeddable Instagram URL for a public reel, post or tv link, or null for anything else. */
export function instagramEmbedUrl(value: string | null | undefined) {
  if (!value) return null;
  const match = /^https:\/\/(?:www\.)?instagram\.com\/(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,30})\/?(?:[?#].*)?$/.exec(value.trim());
  if (!match) return null;
  return `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/embed`;
}

export const ACCOUNT_RECEIPT_NOTICE = 'Please upload your transfer receipt. If you forget it, you will need to write the name of the account you paid from so we can confirm the transfer is yours.';
export const collectorInviteUrl = (webBase: string, token: string) => `${webBase.replace(/\/+$/, '')}/collect/accept?token=${encodeURIComponent(token)}`;

/** Groups an account number in fours so it can be read and checked against the bank app. */
export function groupAccountNumber(value: string) {
  const compact = value.replace(/\s+/g, '');
  return /^[A-Za-z0-9]+$/.test(compact) ? compact.replace(/(.{4})/g, '$1 ').trim() : value;
}
