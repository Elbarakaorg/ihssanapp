# Donations: how it works

Last updated 2026-10-08. Migrations: `202610110001_donation_cases_workflow.sql`, then `202610120001_donation_comments_beneficiaries_analytics.sql`, then `202610130001_donation_media_wishes_external.sql`. Needs Moroccan legal review before launch.

## Model

Donors send money **directly to the patient's bank account**. Ihssan does not hold funds. The app tracks intent, evidence and confirmation so the public progress bar is trustworthy.

1. **Case** (admin-managed): title, summary, bio, beneficiary, age, city, category, goal, initial amount already gathered, minimum donation, urgent flag, contact (optionally public), social links, photo and gallery. Publishing requires an active bank account.
2. **Order:** a donor (signed in or anonymous, secret token kept in AsyncStorage `ihssan.pledges.v1`) starts a donation and gets reference `IH-XXXXXXX`, valid 48 hours, with the bank details.
3. **Receipt:** after transferring, the donor uploads a receipt (private `donation-receipts` bucket) and may add a comment and display name, or stay anonymous.
4. **Confirmation:** an admin or a fund collector for that case checks the receipt against the bank statement and confirms the amount actually received. Only then does `raised = initial + confirmed` update.
5. **Comment:** a donor comment is public only after it is approved (see roles).

## Roles

| Role | Can do |
| --- | --- |
| Platform owner | Everything, plus the only role that can read or edit bank accounts |
| Admin (`donations.review`) | Manage cases, confirm/reject/reverse donations, approve comments |
| Fund collector (per case) | Open receipts, confirm/reject donations, approve comments, for that case only |
| Patient / family (`beneficiary`, per case) | See progress, approve or hide comments. Cannot open receipts or confirm donations |

Collectors and beneficiaries join through a single-use invite link (`/collect/accept?token=…`, 7 days) created in the case's Team tab. The case then appears in the mobile app under "My giving cases" (`/collect`).

## Admin portal

Sidebar group "Giving & community": Giving overview (analytics), Cases, Donor comments, Doctor comment reports. A case workspace has tabs Overview, Donations, Comments, Profile, Bank, Gallery, Team & invites, Preview.

## Mobile

`/give` (filters, case cards), `/cases/[id]`, `/pledge/[id]` (order and receipt upload), `/collect` and `/collect/[caseId]` (collector and beneficiary view), `/collect/accept`.

## Database

Tables: `donation_cases`, `donation_categories`, `donation_case_media`, `donation_bank_accounts` (owner-only RLS), `donation_pledges`, `donation_case_collectors`, `donation_collector_invites`. Key RPCs: `create_donation_pledge`, `submit_pledge_receipt`, `review_pledge`, `list_case_pledges`, `list_case_comments`, `bulk_review_comments`, `admin_save_donation_case`, `admin_create_collector_invite`, `accept_collector_invite`, `list_my_collector_cases`, `donation_analytics`, `recompute_case_total`.

## Not built

Case updates timeline, donor notifications, card payments, refunds, payouts, ledger reconciliation.

## Media, well-wishes and outside donations (migration 202610130001)

- **Link name:** each case has a unique `slug` made from the beneficiary name (`/cases/amina-el-fassi`); UUID links still work. Admin can override it in the case form. Search matches slug and name.
- **One story:** `bio` (20–4000 chars) replaces summary plus full story; `summary` is derived from its first 300 characters.
- **Bank:** separate RIB (24 digits) and account number; the account number is derived from the RIB (digits 7–22) when left empty.
- **Reels and video:** `donation_case_videos` (max 12). Instagram links are validated and embedded (public accounts with embedding only); otherwise upload to the `case-videos` bucket (50 MB).
- **Audio:** `donation_case_audio` (max 5, `case-audio` bucket, 10 MB). Collectors record in the mobile app; the player shows only when a clip exists.
- **Profile management:** admin, collectors and beneficiaries can edit story, photos, reels and audio (`update_case_profile`, `add_case_*`, `delete_case_*`; mobile route `/collect/manage/[caseId]`). Edits are public immediately.
- **Well-wishes:** anyone can leave a message on a case (named or anonymous, rate limited); it is public once approved, in the same moderation queue as donor comments.
- **Forgotten receipts:** donors can use "I paid but have no receipt" (`mark_pledge_paid`) and must give the name of the paying account; the order moves to review and the collector sees the name. The order screens warn about this up front.
- **Outside donations:** admin and collectors record cash or direct transfers (`add_external_donation`, reference `EX-…`, shown as External); they count toward the progress bar and can be reversed.
- **Receipts:** collectors and admins open each receipt full size from the donations list.
- **Not verified:** Instagram embed rendering, native audio recording and video upload on a real device, backfill on production data, storage policies on real Supabase.
