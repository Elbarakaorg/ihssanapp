import { createHmac, timingSafeEqual } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

export type EmailLocale = 'en' | 'fr' | 'ar';
export type EmailJob = {
  id: string;
  kind: 'order_reminder' | 'donation_confirmed';
  pledge_id: string;
  email: string;
  locale: EmailLocale;
  reference: string;
  amount_mad: number;
  expires_at: string;
  case_title: string;
  case_slug: string;
  attempt: number;
};
export type RenderedEmail = { subject: string; text: string; html: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
const localeTag: Record<EmailLocale, string> = { en: 'en-GB', fr: 'fr-MA', ar: 'ar-MA' };
const money = (amount: number, locale: EmailLocale) => `${new Intl.NumberFormat(localeTag[locale], { maximumFractionDigits: 0 }).format(amount)} MAD`;
const when = (iso: string, locale: EmailLocale) => new Intl.DateTimeFormat(localeTag[locale], { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Casablanca' }).format(new Date(iso));

type Copy = {
  reminderSubject: (caseTitle: string) => string;
  reminderLines: (v: { amount: string; caseTitle: string; reference: string; until: string }) => string[];
  reminderHow: string;
  confirmedSubject: string;
  confirmedLines: (v: { amount: string; caseTitle: string; reference: string }) => string[];
  open: string;
  why: string;
  optOut: string;
  signoff: string;
};

const copy: Record<EmailLocale, Copy> = {
  en: {
    reminderSubject: (c) => `Your donation to ${c} is still open`,
    reminderLines: (v) => [`You started a donation of ${v.amount} for “${v.caseTitle}” (reference ${v.reference}).`, `Your order stays open until ${v.until}.`],
    reminderHow: 'If you have already sent the transfer, open the order in Ihssan and upload your receipt so a fund collector can confirm it. If not, you can still finish, or simply ignore this message. To find your order again, open the case and enter this email address.',
    confirmedSubject: 'Your donation is confirmed',
    confirmedLines: (v) => [`Thank you. Your donation of ${v.amount} to “${v.caseTitle}” has been confirmed and now counts toward the goal.`, `Reference: ${v.reference}.`],
    open: 'Open the case',
    why: 'You are receiving this because you chose to get updates about this donation on Ihssan.',
    optOut: 'Stop these emails',
    signoff: 'Jazakum Allah khayran, the Ihssan team',
  },
  fr: {
    reminderSubject: (c) => `Votre don pour « ${c} » est toujours en attente`,
    reminderLines: (v) => [`Vous avez commencé un don de ${v.amount} pour « ${v.caseTitle} » (référence ${v.reference}).`, `Votre ordre reste ouvert jusqu’au ${v.until}.`],
    reminderHow: 'Si vous avez déjà effectué le virement, ouvrez l’ordre dans Ihssan et envoyez votre reçu afin qu’un responsable de collecte le confirme. Sinon, vous pouvez encore terminer, ou ignorer ce message. Pour retrouver votre ordre, ouvrez la collecte et saisissez cette adresse e-mail.',
    confirmedSubject: 'Votre don est confirmé',
    confirmedLines: (v) => [`Merci. Votre don de ${v.amount} pour « ${v.caseTitle} » est confirmé et compte désormais dans l’objectif.`, `Référence : ${v.reference}.`],
    open: 'Ouvrir la collecte',
    why: 'Vous recevez ce message car vous avez choisi d’être informé de ce don sur Ihssan.',
    optOut: 'Ne plus recevoir ces e-mails',
    signoff: 'Jazakum Allah khayran, l’équipe Ihssan',
  },
  ar: {
    reminderSubject: (c) => `تبرعك للحالة «${c}» ما زال مفتوحاً`,
    reminderLines: (v) => [`بدأت تبرعاً بقيمة ${v.amount} للحالة «${v.caseTitle}» (الرقم المرجعي ${v.reference}).`, `يبقى طلبك مفتوحاً حتى ${v.until}.`],
    reminderHow: 'إذا كنت قد أرسلت التحويل فعلاً، فافتح الطلب في إحسان وارفع الإيصال ليؤكده مسؤول التحصيل. وإلا يمكنك إكماله الآن، أو تجاهل هذه الرسالة. للعثور على طلبك مجدداً افتح الحالة وأدخل هذا البريد الإلكتروني.',
    confirmedSubject: 'تم تأكيد تبرعك',
    confirmedLines: (v) => [`شكراً لك. تم تأكيد تبرعك بقيمة ${v.amount} للحالة «${v.caseTitle}» وأصبح محتسباً ضمن الهدف.`, `الرقم المرجعي: ${v.reference}.`],
    open: 'فتح الحالة',
    why: 'تصلك هذه الرسالة لأنك اخترت تلقي تحديثات هذا التبرع في إحسان.',
    optOut: 'إيقاف هذه الرسائل',
    signoff: 'جزاكم الله خيراً، فريق إحسان',
  },
};

/** Bank details, receipts and order keys never go into email; the link only opens the public case page. */
export function renderDonationEmail(job: EmailJob, links: { caseUrl: string; optOutUrl: string }): RenderedEmail {
  const c = copy[job.locale] ?? copy.en;
  const amount = money(job.amount_mad, job.locale);
  const reminder = job.kind === 'order_reminder';
  const lines = reminder
    ? [...c.reminderLines({ amount, caseTitle: job.case_title, reference: job.reference, until: when(job.expires_at, job.locale) }), c.reminderHow]
    : c.confirmedLines({ amount, caseTitle: job.case_title, reference: job.reference });
  const subject = reminder ? c.reminderSubject(job.case_title) : c.confirmedSubject;
  const text = [...lines, `${c.open}: ${links.caseUrl}`, c.signoff, '', c.why, `${c.optOut}: ${links.optOutUrl}`].join('\n\n');
  const rtl = job.locale === 'ar';
  const html = `<!doctype html><html lang="${job.locale}" dir="${rtl ? 'rtl' : 'ltr'}"><body style="margin:0;background:#F7F7F2;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#2B2B26">`
    + `<div style="max-width:520px;margin:0 auto;padding:24px"><p style="font-size:20px;font-weight:600;margin:0 0 16px">Ihssan</p>`
    + lines.map((line) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${escapeHtml(line)}</p>`).join('')
    + `<p style="margin:20px 0"><a href="${escapeHtml(links.caseUrl)}" style="background:#2f6f4f;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;display:inline-block;font-weight:600">${escapeHtml(c.open)}</a></p>`
    + `<p style="font-size:15px;margin:0 0 24px">${escapeHtml(c.signoff)}</p>`
    + `<p style="font-size:12px;color:#6B6B60;line-height:1.5;margin:0">${escapeHtml(c.why)} <a href="${escapeHtml(links.optOutUrl)}" style="color:#6B6B60">${escapeHtml(c.optOut)}</a></p></div></body></html>`;
  return { subject, text, html };
}

export function signOptOut(secret: string, pledgeId: string) {
  return createHmac('sha256', secret).update(`optout:${pledgeId}`).digest('hex');
}

export function verifyOptOut(secret: string, pledgeId: string, signature: string) {
  const expected = Buffer.from(signOptOut(secret, pledgeId));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type DonationEmailService = {
  verify(pledgeId: string, signature: string): boolean;
  optOut(pledgeId: string): Promise<void>;
};

type Options = {
  supabaseUrl: string;
  publishableKey: string;
  workerSecret?: string;
  resendApiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  webUrl?: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
};

/** Returns null unless every credential is present, so the API still starts without email configured. */
export function createDonationEmail(options: Options) {
  const { workerSecret, resendApiKey, fromEmail } = options;
  if (!workerSecret || !resendApiKey || !fromEmail) return null;
  const webUrl = (options.webUrl ?? 'https://ihssanapp.com').replace(/\/+$/, '');
  const apiUrl = (options.apiUrl ?? 'https://api.ihssanapp.com').replace(/\/+$/, '');
  const send = options.fetchImpl ?? fetch;
  const db = createClient(options.supabaseUrl, options.publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const optOutUrl = (job: EmailJob) => `${apiUrl}/email/optout?p=${job.pledge_id}&s=${signOptOut(workerSecret, job.pledge_id)}&l=${job.locale}`;

  async function deliver(job: EmailJob) {
    const unsubscribe = optOutUrl(job);
    const message = renderDonationEmail(job, { caseUrl: `${webUrl}/cases/${encodeURIComponent(job.case_slug)}`, optOutUrl: unsubscribe });
    const response = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `donation-email-${job.id}` },
      body: JSON.stringify({
        from: fromEmail, to: [job.email], subject: message.subject, text: message.text, html: message.html,
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
        headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);
    return ((await response.json().catch(() => null)) as { id?: string } | null)?.id ?? null;
  }

  let running = false;
  /** One pass: claim due jobs, send each, report the result. Returns how many were sent. */
  async function tick(): Promise<number> {
    if (running) return 0;
    running = true;
    let sent = 0;
    try {
      const { data, error } = await db.rpc('email_worker_claim', { p_secret: workerSecret, p_limit: 10 });
      if (error) throw new Error('claim failed');
      for (const job of (data ?? []) as EmailJob[]) {
        try {
          const resendId = await deliver(job);
          await db.rpc('email_worker_complete', { p_secret: workerSecret, p_id: job.id, p_ok: true, p_resend_id: resendId });
          sent += 1;
        } catch (failure) {
          await db.rpc('email_worker_complete', { p_secret: workerSecret, p_id: job.id, p_ok: false, p_error: failure instanceof Error ? failure.message : 'send failed' });
        }
      }
    } catch (failure) {
      console.error('donation email worker:', failure instanceof Error ? failure.message : 'failed');
    } finally {
      running = false;
    }
    return sent;
  }

  const service: DonationEmailService = {
    verify: (pledgeId, signature) => verifyOptOut(workerSecret, pledgeId, signature),
    async optOut(pledgeId) {
      const { error } = await db.rpc('email_worker_optout', { p_secret: workerSecret, p_pledge_id: pledgeId });
      if (error) throw new Error('opt-out failed');
    },
  };

  return { service, tick, start: (everyMs = 60_000) => { const timer = setInterval(() => void tick(), everyMs); timer.unref(); return () => clearInterval(timer); } };
}
