# Email Implementation Plan

Last updated 2026-10-09. This plan covers transactional email for account welcome and donation updates. It does not authorize marketing email.

## Current State

- Supabase Auth owns signup confirmation and password recovery. Configure it to deliver through Resend SMTP and keep its OTP/link templates in Supabase. These messages are distinct from a post-signup welcome.
- `services/api/src/invitation-mailer.ts` sends support-admin invitation email through Resend's HTTP API when configured. The email is informational; access is granted only after the invited person signs in with the matching confirmed email.
- Donation orders currently store one free-form `donor_contact` value for “phone or email.” Receipt submission and collector confirmation are Supabase RPCs called by the app. There is no durable email queue, donor email preference, collector email notification, or delivery webhook.
- The mobile app also has local treatment reminders. Those stay local notifications and are not part of this email system.

## Message Policy

| Message | Trigger | Recipient | Rules |
| --- | --- | --- | --- |
| Account welcome | A verified account completes its initial profile setup | The confirmed Auth email | Send once per account, regardless of email, Google, or Apple signup. Do not combine with the confirmation OTP or include health details. |
| Donation review alert | A pledge first transitions to `receipt_submitted`, whether by receipt upload or “I paid but have no receipt” | Active collectors assigned to that case | Include a case label, pledge reference, and authenticated review link. Do not attach the receipt, expose donor email, or include bank details. Repeated uploads on the same pending review must not create duplicate alerts. |
| Donor thank-you | A collector/admin changes the pledge to `confirmed` | The donor email, only if explicitly provided for donation updates | Say the received amount and case, and that the gift is confirmed. Do not send at order creation or receipt submission; those states do not prove funds arrived. |

If no active collector has a deliverable address, route the review alert to a configured donations-review mailbox and keep the pledge visible in the admin queue. Rejected/reversed-donation emails are a later decision; the app remains the source for those statuses until that policy is approved.

## Data And Consent

- Add a dedicated optional `donor_email` field and an explicit “Email me updates about this donation” choice. Record consent time and the scope/version shown to the donor. Keep `donor_contact` for existing phone/contact use; never infer an email address from it or send to existing historical values.
- Normalize and validate the email on the server. If the donor has not opted in, do not enqueue a thank-you. Anonymous donors may still provide an email, but it must not make their name or gift public.
- Do not return donor email through public case RPCs, the public donor wall, or general admin analytics. Limit it to the notification worker and authorized donation reviewers where operationally necessary.
- Resolve collector recipients from active case assignments and confirmed account emails on the server. Never accept recipient addresses supplied by the mobile client. Do not email receipt files, bank details, health data, or share/access tokens.
- Welcome messages are account-service messages only. Do not add promotions or fundraising campaigns to them; marketing would need separate consent and unsubscribe handling.

## Delivery Architecture

1. Keep Supabase Auth emails on Supabase's Resend SMTP configuration. Keep domain verification, SPF, DKIM, DMARC, templates, and redirect allow-lists in the existing [Resend setup guide](resend-email-setup.md).
2. Reuse the server-side Resend adapter in `services/api`; evolve the invitation-specific mailer into a small email port with typed message templates. No Resend API key belongs in mobile/admin builds or SQL.
3. Add a private email outbox. Enqueue events in the same database transaction as the account-setup completion, pledge submission, and pledge confirmation RPCs. Store an event type and minimal record identifiers, not rendered email bodies or copied sensitive payloads. Add unique event keys for idempotency.
4. Run an isolated server-side worker to claim outbox events, resolve permitted recipients, render templates, and call Resend. The normal Hono request process currently uses caller-scoped Supabase access; do not quietly give it a general service-role key. Before implementation, choose a narrowly privileged worker identity/RPC or an isolated Supabase Edge Function with only the credentials it needs.
5. Track `pending`, `processing`, `accepted`, `retry`, and terminal failure states, attempt count, next-attempt time, and Resend message ID. Use bounded exponential backoff, a claim lease, and dedupe/idempotency keys. A timeout after provider acceptance must not cause duplicate emails.
6. Treat a successful Resend API response as provider acceptance, not inbox delivery. Add a signed, idempotent Resend webhook for delivered, bounced, and complained events before displaying delivery as confirmed. Suppress hard-bounced addresses and surface unresolved failures to operators without logging email bodies or tokens.

The existing invitation route should use the same delivery status and retry model. The invitation record remains authoritative even when sending fails; owners need an explicit resend/reissue action rather than waiting for expiry or manually recreating it.

## Delivery Phases

1. **Provider and policy setup:** verify the sending domain; configure separate sending-only credentials for development/staging/production and keep Auth SMTP separate from the application worker credential. Decide the isolated worker identity, sender address, welcome copy, donor consent copy, collector fallback mailbox, and retention period.
2. **Outbox foundation:** add the outbox schema, restricted claim/complete operations, retry policy, worker health metrics, and Resend webhook verification. Add unit tests for template rendering, provider responses, retries, duplicate events, bounce handling, and secret/configuration failure.
3. **Welcome email:** enqueue once when an account first reaches verified, completed setup. Cover email/password, Google, and Apple paths. Keep confirmation/recovery in Supabase Auth; test that retries and repeated setup attempts do not send duplicate welcomes.
4. **Collector alerts:** trigger on the transition into `receipt_submitted`; resolve active case collectors and fallback mailbox server-side. Test receipt uploads, “paid without receipt,” extra files on an already-pending pledge, revoked collectors, and missing recipient addresses.
5. **Donor thank-you:** add the separate email/consent input and persist it safely. Enqueue only after successful `review_pledge(..., 'confirm', ...)`; send the actual confirmed amount. Test missing/invalid email, no consent, anonymous donor, rejected/expired pledge, partial confirmation, retry, and reversal behavior.
6. **Operational rollout:** verify templates and links in staging with Resend test recipients, inspect Resend logs/webhooks, exercise bounce and retry runbooks, then enable production gradually. Monitor queue age, failures, bounce/complaint rates, and duplicate suppression.

## Acceptance Criteria

- No client bundle, SQL function, log, or email contains a Resend secret, receipt URL, private bank data, or health information.
- A welcome sends at most once after account setup and uses the confirmed account email.
- Every newly reviewable pledge alerts its currently assigned collector(s) once, whether a receipt was uploaded or payment was reported without one. Pledges that remain in `pledged` do not trigger collector alerts, and retries do not duplicate alerts.
- A donor receives a thank-you only with explicit donation-email consent and only after confirmation; no email means no send, while the donation still completes normally.
- Provider outages never roll back a pledge or account setup. Events remain retryable and failures are visible to operations.
- Supabase Auth confirmation and recovery continue to work independently of the application-email worker.