# Resend email setup

Ihssan uses Resend in two places:

1. **Supabase Auth emails** (signup confirmation, password reset, magic links) via Resend SMTP. Supabase's built-in mailer is heavily rate limited and cannot be customised without custom SMTP.
2. **The API** (`services/api`) for admin invitation emails, using the Resend HTTP API.

Planned account welcome and donation emails are covered by the [email implementation plan](email-implementation-plan.md). Signup confirmation remains a Supabase Auth message; application notifications must be sent server-side.

## 1. Verify your sending domain (required)

Resend only sends from a domain you own (the `onboarding@resend.dev` sender can only email your own account address).

1. Resend dashboard > **Domains** > Add Domain (use a subdomain such as `mail.yourdomain.com`).
2. Add the SPF, DKIM and (recommended) DMARC DNS records Resend shows, then click Verify.
3. Pick a sender, e.g. `Ihssan <no-reply@mail.yourdomain.com>`.

## 2. Supabase SMTP (dashboard)

Supabase > **Authentication > Emails > SMTP Settings** > enable custom SMTP:

| Field | Value |
| --- | --- |
| Sender email | `no-reply@mail.yourdomain.com` |
| Sender name | `Ihssan` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_...`) |

Then:
- **Authentication > Rate Limits**: raise the email limit (default is very low).
- **Authentication > Emails > Templates**: customise subjects and bodies now that SMTP is on.
- Make sure **Site URL** and **Redirect URLs** list your Vercel domain.

Use a Resend API key with **Sending access** only, and a different key per environment.

## 3. API invitation emails

In `services/api/.env.local` (git-ignored; never put this key in `apps/mobile`, and never prefix it with `EXPO_PUBLIC_`):

```
RESEND_API_KEY=re_...
MAILER_FROM_EMAIL=Ihssan <no-reply@mail.yourdomain.com>
SUPPORT_INVITATION_SIGNUP_URL=https://your-app-domain
```

The mailer is already integrated (`src/invitation-mailer.ts`); it stays disabled until all three are set. Set the same variables on your API host.

## 4. Test

- Sign up with a fresh address in the app and check the confirmation email arrives.
- Check **Resend > Emails** for delivery status and bounces.
- Invite a team member from the admin portal.
