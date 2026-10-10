# Ihssan Admin and Support Operating Model

## Account Separation

The system has two independent identity dimensions:

- **Product profile:** patient or clinician. Clinician verification is represented separately and must be approved before clinician-only capabilities or patient access become available.
- **Internal admin membership:** platform owner or support administrator, with explicit permissions and grant/revocation history.

A person may be a clinician and a support administrator at the same time. Neither status implies the other. Neither admin membership nor support work grants access to patient measurements. Patient access still requires the separate patient-approved care grant and its RLS policy.

## Permission Model

The platform owner is the only authority that may manage support-admin memberships. Support admins cannot grant, change, or revoke anyone's admin access, cannot promote themselves, and cannot become owners through the app.

Support capabilities are assigned independently and should follow least privilege:

| Permission | Capability | Extra requirement |
| --- | --- | --- |
| `support.requests.manage` | View/assign/reply to support requests | Only support requests and their own thread metadata |
| `metrics.edit` | Create/update owned metric drafts | Cannot approve or publish their own draft |
| `metrics.review` | Review metric content and ranges | Must also be an active, verified clinician; cannot review own work |
| `metrics.publish` | Publish a reviewed metric version | Version must already be approved by another verified clinician |
| `articles.edit` | Create/update owned article drafts | Cannot approve or publish own draft |
| `articles.review` | Review health education article content | Must also be an active, verified clinician; cannot review own work |
| `articles.publish` | Publish a reviewed article version | Version must already be approved by another verified clinician |
| `providers.verify` | Review provider verification queues | Does not grant access to patient health records |
| `donations.review` | Review cases and their moderation evidence | Does not grant payment-secret or bank credential access |
| `admin.audit.read` | Read permitted admin audit records | Read-only and itself audited |

`admin.memberships.manage` is reserved to the platform-owner role and must never be assignable in the support permission array.

## Owner Bootstrap

The first platform owner is bootstrapped once by a trusted project owner through the Supabase SQL Editor after creating and signing into their account. Replace the placeholder with the owner's Supabase Auth user UUID. Never use a service-role key in the app or share one in chat.

```sql
insert into public.admin_memberships (user_id, role, permissions, granted_by)
values (
  'YOUR_AUTH_USER_UUID'::uuid,
  'platform_owner',
  '{}'::text[],
  'YOUR_AUTH_USER_UUID'::uuid
);
```

Find the UUID in Supabase Authentication → Users; do not select or copy password/hash fields. The SQL editor operation is the one-time bootstrap boundary. Thereafter, use the owner-only `grant_support_admin`, `update_support_admin_permissions`, and `revoke_support_admin` functions from the authenticated owner session.

## Admin Portal Pages

The admin portal is a separate web app and has a separate sign-in entry from the patient mobile app and doctor portal. MFA is required for all admin members. Each route must check its permission before rendering and the database/API must independently enforce it.

| Route | Audience | Page behavior |
| --- | --- | --- |
| `/sign-in` | Owner and support admins | Admin authentication, MFA, clear unavailable/locked account state |
| `/owner` | Platform owner | Overview of pending support, content, provider, and donation queues |
| `/team` | Platform owner only | Invite by email before signup, assign support permissions, review pending invitations and active memberships |
| `/team/:membershipId` | Platform owner only | Membership detail, granted permissions, grant/revoke history |
| `/support` | `support.requests.manage` | List/filter requests within support scope; assign only to active support members |
| `/support/:requestId` | Requester or permitted support member | Conversation, status/priority, assignment, audit trail; no general health-record panel |
| `/metrics` | Metric editor/reviewer/publisher | Metric catalog, drafts, review-due and publication queues |
| `/metrics/:metricId` | Metric permission | Definition, sources, versions, review notes, active content |
| `/articles` | Article editor/reviewer/publisher | Separate editorial queue for Home-feed articles |
| `/articles/:articleId` | Article permission | Draft, source citations, review and publication history |
| `/providers/:providerId/review` | `providers.verify` | Verify provider details and record decision/reason |
| `/donations`, `/donations/cases`, `/donations/cases/:id`, `/donations/comments` | `donations.review` | Giving analytics, case management, receipt review, donor comment approval. Bank accounts are platform-owner only. See `docs/donations.md` |
| `/moderation` | `support.requests.manage` | Doctor comment reports |
| `/locations` | `providers.verify` | Map locations, CSV import, duty pharmacies |
| `/audit` | `admin.audit.read` | Purpose-limited, read-only admin audit search |

Support admins see only routes and records allowed by their assigned permissions. The owner console can inspect membership history; support users cannot. The platform owner can manage content and support requests by owner authority, but still receives no blanket access to patient measurements.

## Support Staff Lifecycle

1. The platform owner opens `/team`, enters the support person's email before they create an account, and selects only the required permissions. Invitations expire after 30 days and may be revoked before acceptance.
2. The API sends the invitation through Resend when its server configuration is present. If email is not configured or sending fails, the owner shares account-registration instructions manually; the current UI has no resend action.
3. The person creates or signs into a normal Ihssan account with the invited email and completes Supabase email confirmation. On the next admin-portal sign-in, the API matches the confirmed email to the pending invitation and activates the support membership.
4. The support user sees only routes and records allowed by their granted permissions. If they are a clinician, they complete clinician credential verification separately before clinical review actions are available.
5. The owner may change permissions or revoke access. Grants, acceptance, changes, and revocation are audited; revoked memberships remain history and cannot be reactivated. Clinician patient access remains independently controlled by patient-approved grants.

## Content Workflows

### Metric Catalog

1. An authorized metric editor drafts a definition or localized content version and attaches sources, units, population/context, limitations, and effective-date intent.
2. The draft enters review. A different verified clinician reviews ranges and safety-critical alerts and approves or returns it with notes.
3. An authorized publisher publishes only an approved version. The prior published version is end-dated, never overwritten in place.
4. The patient app reads only active definitions and currently published content. Historical observations retain the metric-definition version used when recorded.

No numeric clinical ranges are seeded by this access migration. Content must be entered and reviewed by Ihssan's clinical team before publication.

### Blog and Education Articles

Articles are a separate editorial collection, not metric definitions. Authors create localized drafts with categories (nutrition, fitness, sleep, vitamins, general health), summaries, body copy, and citations. A different verified clinician reviews health claims before publication. Published versions feed the patient Home articles list; they do not affect measurement classification or targets.

### Support

Users create a support request with a non-clinical category, subject, and message. The owner/support permission queue can assign and reply. Patient requests and messages are visible only to the requester and appropriately permissioned support staff. Support staff should direct health interpretation and medical decisions to verified clinicians rather than request unnecessary patient measurements.

## Current Boundaries

- No administrator role grants blanket patient-profile or measurement access.
- No support member may manage memberships or create another administrator.
- Clinician status alone grants no administration rights.
- Clinical review requires both the relevant support permission and an active verified clinician record.
- No service-role, Google, OpenAI, CMI, or other provider secret belongs in mobile public environment variables.

## Required Authorization Tests

- A normal patient cannot read or modify `admin_memberships` for another user.
- A support admin cannot grant, change, or revoke any admin membership, even if the client calls the RPC directly.
- Only the platform owner can grant support access; the permission check rejects `admin.memberships.manage` in a support permission set.
- Revoking a support membership immediately removes its access; revoked membership rows cannot be reactivated.
- A support user can only update fields allowed by the specific capability, and cannot reassign support tickets to an inactive or unauthorized user.
- Metric/article authors cannot approve their own content. Review requires a different, active verified clinician. Publishing requires an approved immutable version.
- Neither admin membership nor clinician profile type alone grants access to patient health records; the patient-care access grant remains mandatory.
