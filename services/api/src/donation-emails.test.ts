import { describe, expect, it, vi } from 'vitest';

import { createApi } from './app.js';
import type { DataAccess } from './data-access.js';
import { createDonationEmail, renderDonationEmail, signOptOut, verifyOptOut, type EmailJob } from './donation-emails.js';

const job: EmailJob = {
  id: 'job-1', kind: 'order_reminder', pledge_id: '3f2b1c4e-5a6d-4e7f-8a9b-0c1d2e3f4a5b', email: 'donor@example.com', locale: 'en',
  reference: 'IH-ABC2345', amount_mad: 1500, expires_at: '2026-10-12T10:00:00Z', case_title: 'Support <Youssef> & family', case_slug: 'youssef', attempt: 1,
};
const links = { caseUrl: 'https://ihssanapp.com/cases/youssef', optOutUrl: 'https://api.ihssanapp.com/email/optout?p=x&s=y' };

describe('donation email configuration', () => {
  it('does not fall back to the main-domain sender when the donation sender is missing', () => {
    const required = { supabaseUrl: 'https://example.supabase.co', publishableKey: 'public', workerSecret: 'worker', resendApiKey: 'resend' };
    expect(createDonationEmail(required)).toBeNull();
    expect(createDonationEmail({ ...required, fromEmail: 'Ihssan <donations@updates.ihssanapp.com>' })).not.toBeNull();
  });
});

describe('donation email templates', () => {
  it('renders the reminder with reference, amount and an opt-out link, and escapes case text', () => {
    const mail = renderDonationEmail(job, links);
    expect(mail.subject).toContain('still open');
    expect(mail.text).toContain('IH-ABC2345');
    expect(mail.text).toContain('1,500 MAD');
    expect(mail.text).toContain(links.optOutUrl);
    expect(mail.html).toContain('&lt;Youssef&gt; &amp; family');
    expect(mail.html).not.toContain('<Youssef>');
  });

  it('renders the confirmation only as a thank-you, in French and Arabic too', () => {
    const confirmed = { ...job, kind: 'donation_confirmed' as const };
    expect(renderDonationEmail(confirmed, links).subject).toBe('Your donation is confirmed');
    expect(renderDonationEmail({ ...confirmed, locale: 'fr' }, links).subject).toBe('Votre don est confirmé');
    const ar = renderDonationEmail({ ...confirmed, locale: 'ar' }, links);
    expect(ar.subject).toBe('تم تأكيد تبرعك');
    expect(ar.html).toContain('dir="rtl"');
  });

  it('never includes bank details, receipts or order keys', () => {
    for (const kind of ['order_reminder', 'donation_confirmed'] as const) {
      const mail = renderDonationEmail({ ...job, kind }, links);
      expect(`${mail.text}${mail.html}`).not.toMatch(/RIB|account number|receipt\.|token|\/pledge\//i);
    }
  });
});

describe('opt-out signatures', () => {
  it('accepts only the signature made with the worker secret', () => {
    const signature = signOptOut('secret', job.pledge_id);
    expect(verifyOptOut('secret', job.pledge_id, signature)).toBe(true);
    expect(verifyOptOut('other', job.pledge_id, signature)).toBe(false);
    expect(verifyOptOut('secret', 'another-id', signature)).toBe(false);
    expect(verifyOptOut('secret', job.pledge_id, 'short')).toBe(false);
  });
});

describe('opt-out routes', () => {
  const signature = signOptOut('secret', job.pledge_id);
  const query = `p=${job.pledge_id}&s=${signature}&l=fr`;
  const make = () => {
    const service = { verify: vi.fn((p: string, s: string) => verifyOptOut('secret', p, s)), optOut: vi.fn(async () => undefined) };
    return { service, app: createApi({} as DataAccess, [], null, null, null, null, service) };
  };

  it('shows a confirmation page on GET without opting anyone out', async () => {
    const { app, service } = make();
    const response = await app.request(`/email/optout?${query}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Ne plus recevoir');
    expect(service.optOut).not.toHaveBeenCalled();
  });

  it('opts out on POST, with no sign-in', async () => {
    const { app, service } = make();
    const response = await app.request(`/email/optout?${query}`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(service.optOut).toHaveBeenCalledWith(job.pledge_id);
  });

  it('rejects a forged or malformed link', async () => {
    const { app, service } = make();
    expect((await app.request(`/email/optout?p=${job.pledge_id}&s=${'0'.repeat(64)}`, { method: 'POST' })).status).toBe(400);
    expect((await app.request('/email/optout?p=nope&s=bad', { method: 'POST' })).status).toBe(400);
    expect(service.optOut).not.toHaveBeenCalled();
  });
});
