# Ihssan: Architecture and Delivery Plan

## Purpose

Ihssan is a Morocco-first mobile platform for patient-entered health tracking, doctor and pharmacy discovery, clinician review of patient-shared records, and donations to cases supported by Ihssan's foundation. It handles sensitive health information and financial workflows, so privacy, correctness, and operational readiness are product requirements, not later hardening tasks.

This plan is an implementation baseline, not a claim that any architecture is perfect or that a particular legal regime applies. Morocco is the intended market; local requirements for health data, privacy, clinical decision support, pharmacy services, fundraising, payments, and cross-border data transfers must be reviewed by qualified Moroccan counsel and relevant professionals before launch.

## Decisions to Carry Forward

- Build a **modular monolith** first. Keep clear domain and infrastructure boundaries, but do not start with microservices, event streaming, or multiple databases. Split a module only when measured scale, independent ownership, or regulatory isolation justifies the operational cost.
- Use **Expo React Native and strict TypeScript** for the mobile client. Keep Expo Router route files thin and do not treat route groups as authorization.
- Put a **server-side API** between mobile clients and private application data. The app must not use a privileged database key or directly perform sensitive writes through a vendor SDK.
- Use **PostgreSQL** as the transactional system of record, with reviewed, ordered SQL migrations. A managed provider such as Supabase may be evaluated, but the application should depend on domain ports and documented APIs rather than provider-specific client calls.
- Treat the identity provider, database host, maps provider, and payment processor as replaceable infrastructure adapters where the cost of doing so is reasonable. Portability is a design goal, not a guarantee of zero migration work.
- Model permissions as **capabilities and relationships**, not one exclusive `role` column. A person may be a patient and donor, while doctor and pharmacy access is associated with verified organizations and scoped memberships.
- Include a doctor portal for verified clinicians and a separate internal admin portal. There is no pharmacy operations dashboard in the initial scope.
- Keep the first release narrow: patient-entered measurements, patient-approved doctor access, and provider discovery/navigation. Add ordering, advanced analytics, and other workflows only after their product and safety requirements are proven.

## Current Implementation Status

_Last updated 2026-10-08. The sections below are the original baseline; where the built system differs, this section and the "Status" notes in the roadmap win._

### What exists

| Area | State | Where |
| --- | --- | --- |
| Patient app (Expo, iOS/Android/web) | Built: health tracking, discovery map, doctors, sharing, treatments, give, verses, account deletion, Sign in with Apple (needs a dev client) | `apps/mobile` |
| Admin portal (Vite/React) | Built, TOTP MFA required (aal2): metrics/articles, support, team, provider verification, map locations, doctor comment moderation, giving & community | `apps/admin-portal` |
| API (Hono) | Deployed on Fly.io at `https://api.ihssanapp.com`; `/v1/admin/*` requires an aal2 token; 32 tests | `services/api` |
| Database | Supabase Postgres, ordered migrations, latest `202610130001` | `supabase/migrations` |
| Web hosting | Vercel (mobile web; admin at `alhamdulilah.ihssanapp.com`) | `docs/vercel-deployment.md` |
| Medicine and treatments | Static generic-name directory (no doses), schedules, dose logging, local reminders, stock/refill, adherence reports, doctor prescribing. Not clinician-reviewed | `features/medicine` |
| Care directory | Mapbox GL map (WebView/iframe), `care_providers` locations, admin picker, CSV import, duty pharmacies; verified doctor practice locations appear automatically | `features/discovery`, migration `202610100001` |
| Donations | Direct bank-transfer model with receipt confirmation; see `docs/donations.md` | `features/donations` |
| Content | Built-in articles/blogs merged with DB `blog_articles` (not clinician-reviewed); Verses of healing | `features/content`, `features/spirit` |
| Visual language | Wabi-sabi paper palette, EB Garamond headings, frosted-glass cards, bento layout on home and the admin overview | `ui/palette.ts`, `ui/patient-ui.tsx` |

### Deliberate deviations from the baseline

- **Donations do not go through the foundation or CMI.** Donors transfer directly to the patient's own bank account using an order (reference `IH-XXXXXXX`, 48 h), then upload a receipt. An admin or a per-case fund collector confirms receipt; only confirmed amounts move the progress bar. There is no card checkout, ledger, refund or payout flow. This needs Moroccan legal review before launch.
- **Maps:** Mapbox, not Google Maps. Hirassa and Google Places are optional API adapters.
- **API scope:** the API serves admin, AI, email and directory adapters; much patient data still goes through Supabase RPCs and row-level security. Direct Supabase admin RPCs are not yet aal2-gated at the database level.
- **Localization:** the UI is English only; Arabic appears only in verses.

### Not built yet

Arabic/French localization, appointment booking, paid consultations, pharmacy orders, dependent profiles, case updates timeline, donor notifications, CMI payments, clinician review of medicine and article content, device testing of native screens, a production pilot.

## Product and Risk Boundaries

Before implementation, agree on:

- The initial release is for adults only; do not allow a minor to create a standalone account. A later parent-managed dependent profile is a separate, explicitly designed feature requiring guardian verification, authority/consent rules, child-safe privacy, and transition handling when the child reaches adulthood.
- Which measurements and approved user-facing alerts are in the first release. The app records user-entered results; it has no connected-device integration in the current scope.
- Patient report sharing supports a scoped link/QR, PDF, or text export; a separate patient-profile QR can establish a persistent doctor grant after patient confirmation. The doctor grant has no automatic expiry but is revocable, so lifecycle and access-history protections are mandatory.
- Which pharmacy-hours source is authoritative enough to label a pharmacy "open now" and how stale or unverified hours are communicated.
- How the foundation receives, allocates, disburses, refunds, and reports donations through bank transfer and CMI card payments; how fees, disputes, and failed payouts work.
- Retention, export, correction, deletion, and account closure rules. Legal retention requirements may limit immediate deletion of some records or financial evidence.

Maintain a lightweight data inventory, threat model, and risk register. Have qualified privacy, security, clinical, and payments reviewers evaluate the actual launch jurisdictions and business model before production release.

### Morocco-first product considerations

- Have Moroccan counsel assess applicable personal-data and health-data rules, required approvals/notifications, hosting and international transfer constraints, medical software/telemedicine boundaries, pharmacy/medicine sales rules, charitable fundraising, and payment-provider requirements. Do not infer compliance from the database or hosting vendor.
- Design localization from the start for Arabic (including right-to-left layouts), French, and English. Clinical labels, alerts, and education content must be clinician-reviewed and professionally translation-managed rather than embedded in code.
- Use `Africa/Casablanca` for local display and clinic schedules, while storing timestamps as UTC instants. Test Morocco's daylight-saving and Ramadan-related operational edge cases rather than assuming a fixed UTC offset.
- Use MAD with integer minor units for money and validate Moroccan phone/address formats without making them database identity keys.
- Support nationwide search and discovery. Ask for device location only when a user invokes nearby search; location permission must be optional, with city/address search available. Donation cases and campaigns should be discoverable nationwide, independent of device location.
- Evaluate Google Maps Platform for maps/navigation and the team's proposed Hirassa API for day/night pharmacy availability. Confirm the exact provider/API, nationwide coverage, data freshness, commercial rights, outage behavior, and permitted caching before relying on its "open" status.
- A map pin or third-party business-hours result is not a verified medical provider or a guarantee a pharmacy is open. Show data source/freshness and provide direct contact/navigation actions; obtain an explicit verification/update process for promoted providers.

## Target Architecture

```text
Patient mobile app    Doctor portal     Internal admin portal
     |                   |                     |
     +--------- HTTPS / versioned API ---------+
                  |
          Authentication and policy checks
                  |
      Modular application API (TypeScript monolith)
      |         |          |          |          |
    Identity   Health    Directory   Sharing   Donations
      |         |          |          |          |
      +---------+----------+----------+----------+
                  |
       PostgreSQL, private object storage, jobs
           |             |              |
         audit         reports       outbox/jobs
                              |
                     maps/payment/notification adapters
```

The doctor portal and admin portal are separate web surfaces with separate deployment/access policies, even if they share design primitives and the API. Neither is a role toggle inside the patient app. Both use server-side authorization. Pharmacy management and medication fulfillment are future modules, not part of initial delivery. External providers are called from trusted server code when credentials, policy enforcement, or webhooks require it.

### Application layers

- **Presentation:** Expo screens, reusable design system, accessibility, and local interaction state. Screens do not contain authorization policy, SQL, payment logic, or clinical calculations.
- **Application:** use cases and request orchestration, such as recording a measurement or booking an appointment. These coordinate domain rules and ports.
- **Domain:** plain TypeScript types and deterministic rules for metric validation, consent, booking, and donation state transitions. No framework or provider SDK imports.
- **Ports:** narrow interfaces for persistence, identity, clock, notifications, maps, and payments. Keep interfaces aligned to use cases rather than creating a generic repository for every table.
- **Adapters:** API handlers, PostgreSQL queries, identity-provider integration, storage, and third-party integrations.

TanStack Query is suitable for client-side server state. Use it for caching, retries, and invalidation, not as the authorization layer or source of truth. Avoid persisting sensitive health responses by default. Clear in-memory and persisted caches on logout or account switch.

## Feature-Based Structure and Routing

Use one shallow, feature-first source layout. Expo Router owns mobile URLs and layouts; its route files only load the corresponding feature screen. Doctor/admin web apps keep one explicit route table each. Actual behavior lives once in its feature, not in copied `screens`, `services`, `repositories`, or `utils` trees in every layer.

```text
apps/
  mobile/
    app/                            # Expo Router only: layouts and route entry files
      (auth)/                       # sign-in, create-account, recovery
      (patient)/                    # authenticated patient route group
        (tabs)/                     # Home, Health, Discover, Give, Profile
        health/                     # add result and metric detail routes
        share/                      # profile QR and report export routes
        give/                       # case detail and checkout routes
    src/
      features/                     # auth, health, discovery, sharing, donations, profile
      ui/                           # genuinely cross-feature mobile primitives
      platform/                     # secure storage, notifications, location, camera
  doctor-portal/
    src/routes.tsx                  # one route table; protected layouts are presentation guards
    src/features/                   # overview, patients, scan, document capture
  admin-portal/
    src/routes.tsx                  # one route table; protected layouts are presentation guards
    src/features/                   # owner, support, verification, metric catalog, articles, donations, audit
  api/                              # server-side modular monolith
    src/modules/                    # identity, health, sharing, directory, donations
packages/
  api-client/                       # generated from the API contract; no hand-copied DTOs
  config/                           # shared lint and TypeScript configuration only
database/migrations/                # ordered schema, constraints, policies, audit functions
docs/                               # plan, decisions, security, operations, feature specifications
```

Mobile route entry files map to feature screens and must not contain query logic or business rules. Web routes follow the same rule. Keep a feature flat while it is small; add a local subfolder only when that feature has enough code to benefit from it. Do not pre-create empty future features or impose `domain/application/infrastructure/http` folder layers on every module. Within the API, each feature owns its request validation, use cases, persistence adapter, and tests; extract a shared abstraction only when real duplication appears.

The API is the source of truth for authorization and business decisions. Keep domain types/rules in their owning API feature unless multiple consumers truly need a pure shared function; use the generated API client for contracts rather than duplicating model definitions. Never import database, payment, maps, or identity SDKs into app features. Enforce these boundaries with lint/package rules. Do not share web and native UI just to maximize reuse; share only stable contracts and primitives that behave well on both platforms.

### Mobile route map

Parentheses are Expo Router groups and do not appear in public URLs. The patient tab layout is the only primary navigation; detail and task flows are pushed routes or modals, not additional tabs.

```text
app/
  _layout.tsx
  (auth)/sign-in.tsx
  (auth)/create-account.tsx
  (auth)/recover-account.tsx
  (patient)/_layout.tsx
  (patient)/(tabs)/_layout.tsx
  (patient)/(tabs)/index.tsx                 # Home
  (patient)/(tabs)/health/index.tsx          # metric catalogue/history overview
  (patient)/(tabs)/health/add/[metricId].tsx # metric-specific entry form
  (patient)/(tabs)/health/[metricId].tsx     # metric details and history
  (patient)/(tabs)/discover/index.tsx        # provider map/list/search
  (patient)/(tabs)/discover/[providerId].tsx # doctor/pharmacy details
  (patient)/(tabs)/give/index.tsx            # nationwide donation cases
  (patient)/(tabs)/give/[caseId]/index.tsx   # case details
  (patient)/(tabs)/give/[caseId]/checkout.tsx # CMI or bank-transfer path
  (patient)/(tabs)/profile/index.tsx         # account and privacy
  (patient)/(tabs)/profile/shares.tsx        # active grants and revocation
  (patient)/(tabs)/profile/settings.tsx      # language, accessibility, security
  (patient)/share/profile.tsx                # patient-approved doctor QR
  (patient)/share/report.tsx                 # preview and link/QR/PDF/text export
```

Use modal presentation only for bounded tasks such as add-result review or share confirmation. A modal must have a direct close/cancel path and preserve the user's draft when safe. Do not encode authorization in route names or assume a hidden tab protects data; every API request is independently authorized.

Use one route configuration per web portal and shared layouts for sign-in, MFA, navigation, and role-protected sections; UI guards improve navigation but never replace API authorization.

```text
Doctor portal (React Router)
  /sign-in                         # authentication and MFA
  /overview                        # work queue and recently accessed authorized patients
  /patients                        # saved list and scan history; no global patient search
  /patients/:patientId             # patient-approved profile and metric overview
  /scan                            # choose patient QR or medical-document capture
  /documents/:captureId/review     # OCR candidate correction and save/store/discard
  /schedule                        # future: working hours and availability
  /bookings                        # future: accept, decline, reschedule
  /appointments/:appointmentId     # future: appointment details and status

Admin portal (React Router)
  /sign-in                         # staff authentication and MFA
  /owner                            # platform owner: oversight and pending queues
  /team                             # platform owner only: add, permission changes, revoke support access
  /team/:membershipId               # platform owner only: support member details and access history
  /support                          # support.requests.manage: assigned/open requests only
  /support/:requestId               # support thread and status actions
  /queue                            # permission-scoped work queues
  /providers/:providerId/review    # clinician verification; pharmacy onboarding later
  /metrics                         # Metric Catalog and review-due queue
  /metrics/:metricId               # metric versions, sources, and content
  /metrics/:metricId/edit          # draft editor; never directly publishes
  /articles                        # editorial list and review queue
  /articles/new                    # article draft editor
  /articles/:articleId             # article versions, source citations, review state
  /articles/:articleId/edit        # author-owned draft editor
  /donations                       # giving overview and analytics
  /donations/cases                 # case list
  /donations/cases/:id             # workspace: overview, donations, comments, profile, bank, gallery, team, preview
  /donations/comments              # bulk donor comment approval
  /moderation                      # doctor comment reports
  /audit                           # purpose-limited, audited read-only review

Future patient routes (add only in their delivery phase)
  /appointments                    # upcoming/past appointment list
  /appointments/new/:providerId    # type, slot, policy review, booking request
  /appointments/:appointmentId     # confirmation, reschedule, cancellation
  /consultations/:appointmentId    # consent, waiting room, call, receipt
  /pharmacies/:pharmacyId/catalog  # eligible products and branch availability
  /orders/:orderId                 # pharmacist decision through fulfillment/refund

Future pharmacy portal routes
  /orders                          # branch order queue and status actions
  /inventory                       # catalog, stock, freshness, and feed health
  /branches                        # locations, hours, and fulfillment coverage
```

Do not build the future routes or empty feature folders early. Add each route together with its feature, API contract, authorization rules, UX states, and tests.

## Product UX and Core Journeys

The following is the recommended information architecture, to validate with Moroccan patients and clinicians before visual design is finalized. It makes the requested capabilities discoverable without implying that Ihssan diagnoses, continuously monitors, verifies every map listing, or guarantees pharmacy stock.

### Patient mobile app

**Primary navigation:** Home, Health, Discover, Give, Profile. Keep Reports/Share reachable from Health and Profile rather than adding another crowded tab. Arabic uses true right-to-left layout and mirrored navigation where appropriate; charts, numeric values, units, dates, and phone numbers retain correct direction and locale formatting.

- **Onboarding and account:** language selection; adult-only eligibility check; sign-up/sign-in and recovery; clear privacy/health-data consent; minimal profile setup. If the user is not eligible, stop account creation without collecting unnecessary health data. Explain permissions when needed, not as a blanket onboarding request.
- **Home:** concise shortcuts to add a result, continue to Health, find a doctor/pharmacy, and view donation cases. Show the latest user-entered measurements with their recorded dates and links to detail, not a single app-generated diagnosis or red/green overall health score. Use reminder/alert summaries only where the patient has entered results and the message has approved clinical content.
- **Health overview:** searchable metric list grouped by category, with last-entry date and an understandable missing-data state. `Add result` starts a metric-specific form. Each form explains the test, required fields, accepted units, optional lab/source/date/context, and how to review the entry. Composite metrics (for example, systolic/diastolic pressure) get a dedicated form rather than ambiguous free text. Review before save; afterward show the saved values, unit, date, source, applicable context, and correction path.
- **Metric detail/history:** plain-language test information and source; chart and chronological list; visible units and range provenance; filters by date; edit/correction as a new auditable version. Explain when a range is lab-specific or context-dependent, and never show a confident interpretation when essential context is missing. Empty, implausible, and out-of-range states use clinician-approved language and a clear next step.
- **Discover:** map and equivalent list view; nationwide city/address search; optional nearby search after a user action and permission; doctor/pharmacy filters; pharmacy open/day/night status with its source and last-updated time; provider detail with call, directions, and report/share-independent contact actions. If location is denied or unavailable, manual search remains fully usable. If hours are stale or the API fails, say so and encourage calling; do not display stale status as live certainty.
- **Give:** nationwide case list and filters; case detail with verification status, need, goal/progress, foundation recipient/distribution explanation, and campaign updates. Checkout offers CMI card payment or bank-transfer instructions. Show pending versus confirmed state, fee/receipt details as applicable, and a durable donation history/receipt. Do not imply that a bank transfer is received until reconciled.
- **Profile, privacy, and sharing:** language/accessibility preferences, account and security, data export/deletion requests, active doctor shares with last-access information and revoke action. `Share my profile` opens the QR grant flow; `Share a report` lets the patient select date range/content, preview it, and choose secure link/QR, PDF, or text. Explain that PDF/text can be forwarded outside Ihssan. These actions must not be conflated.
- **Cross-cutting states:** every data screen specifies loading, first-use empty, populated, stale, offline, permission-denied, session-expired, access-revoked, and recoverable-error behavior. Health writes must never appear successful until the server confirms them. Do not expose measurements in push previews, analytics, or crash logs.

### Doctor portal

- **Sign-in and landing:** verified clinician identity, MFA, organization/clinic context, and a clear list of patients the clinician is currently authorized to view. No global patient search or access based only on being a doctor.
- **Patient QR:** `Scan patient QR` starts the authenticated scanning flow. Show the patient's identity and requested scope; the patient confirms the grant on their own session/device. After confirmation, show the profile overview and create a named, saved-list/history reference. Every revisit revalidates the grant and makes last access visible; revoked/suspended access displays a clear unavailable state without cached data.
- **Patient profile:** summary and shared metric list/history with units, dates, source, range provenance, and data gaps. Clearly distinguish patient-entered measurements from clinician-entered material. Clinician notes or target ranges, if later added, require a separate feature, authorship, consent, and audit model.
- **Scan document:** choose/confirm the authorized patient before capture; preview the image; show OCR candidates and confidence/uncertain fields; let the doctor correct them; then explicitly choose `Add results to health history`, `Store document only`, or `Discard`. Confirm before permanent storage. Never silently add an OCR result or associate a document with a patient inferred only from its contents.
- **Future appointments:** schedule editor and booking queue with pending/confirmed/cancelled states, patient contact/report access only when authorized, conflict warnings, and calendar sync status. Provide clear actions for accept, decline, propose another time, block availability, and resolve failed integrations.

### Internal admin portal

- **Platform owner workspace:** the owner has the only `admin.memberships.manage` authority. The `/team` area adds an existing account as a support administrator, assigns an explicit least-privilege permission set, displays active/revoked membership history, and allows immediate revocation or permission changes. Support admins cannot delegate access, manage memberships, or promote another owner. Bootstrap the first owner once through the documented privileged database procedure.
- **Support workspace:** `/support` and `/queue` show only work allowed by the support member's permissions: customer requests, metric/article drafts, provider verification, or donation review. The UI hides inaccessible routes, but the API/RLS checks enforce every action. Support administrators never receive broad health-record browsing by virtue of admin membership.
- **Doctor plus support:** one person may be both a verified clinician and a support administrator because clinician status and admin membership are separate records. Metric/article editing is a support permission; clinical review also requires an active verified clinician identity and a different author. A doctor profile alone grants no admin access, and support membership alone grants no clinician or patient access.
- **Support inbox:** customer requests are private to their requester and permitted support staff. Staff may assign, reply, change status, and close requests with audit history. Ticket identity and requester ownership are immutable, and assignments must target an active support member.
- **Metric Catalog UX:** search/select metric; edit a draft definition/content; attach evidence and applicability; preview Arabic/French/English; submit for clinical review; show reviewer comments and required fields; publish only an approved immutable version with effective date; inspect change history and roll back. Provide a visible review-due/withdrawn-source queue.
- **Articles are separate from metrics:** editors create localized blog/article versions, sources, category, and summaries. Articles publish through their own draft/review/publish workflow and Home feed; they do not become metric definitions or change test ranges.
- **Support inbox:** customer requests are private to their requester and permitted support staff. Staff assign, respond, change status, and close requests with audit history. Do not collect medical records in general support messages; direct users to secure clinician/report-sharing flows instead.
- **Moderation and audit:** case verification shows evidence and decision history; access/audit views are read-only, purpose-limited, and themselves audited. High-impact actions require confirmation and an attributable reason.

### Future booking, consultation, and pharmacy UX

- **Booking:** patient selects a provider and appointment type, sees location/mode, duration, price if any, timezone, available slots, confirmation mode, and cancellation policy; chooses a slot; reviews details; and receives a pending or confirmed receipt. A hold countdown is explicit when used. Doctor acceptance, rejection, and reschedule proposals notify the patient without exposing health details. Sync failures never masquerade as a confirmed booking.
- **Paid video consultation:** before checkout, show clinician credentials, consultation scope, price, payment timing, cancellation/refund terms, and consent. After confirmed booking/payment, show a pre-call checklist, secure waiting room, connection status, rejoin/recovery path, and post-call receipt/follow-up. Do not record by default; clearly indicate when the clinician is not yet connected.
- **Medication order:** patient selects an eligible pharmacy and branch, sees stock/price freshness and fulfillment choices, attaches a prescription only when needed, reviews and submits. The order is pending until pharmacist review. The patient sees accepted/rejected status, final price, approved substitution choices, stock reservation, payment/refund state, pickup/delivery progress, and support contact. No substitution or payment capture should be hidden in a status transition.
- **Pharmacy portal (future):** verified staff see branch-specific order queues and stock freshness; accept/reject with reasons, request a permitted substitution, reserve/release stock, update preparation and fulfillment states, and see payment/refund reconciliation. Actions are attributed to individual staff and audited.

### UX acceptance criteria

- Complete task-based usability reviews in Arabic RTL, French, and English with patients and clinicians before release; include users with limited digital literacy and accessibility needs.
- Use accessible labels, scalable text, non-color-only status, keyboard/focus support on web, screen-reader semantics on native, and clear confirmation for destructive/high-impact actions.
- Every key journey has tested success, cancellation, denial, stale data, provider outage, retry, and recovery paths. Permission prompts are contextual; location is optional; health-share and payment consent are explicit.
- The visual design and final screen content remain to be prototyped and validated. This plan defines UX behavior and information architecture, not pixel-perfect layouts or final clinical copy.

## Domain and Data Design

### Identity and authorization

- Keep authentication identity separate from application profile and authorization records.
- Represent organization memberships with explicit status, verification state, and scoped permissions. Organizations may represent clinics, pharmacies, or other approved operators.
- Represent patient-care relationships separately, with patient-granted consent, scope, start/end state, and revocation history. A clinician's organization membership alone must not grant access to a patient's record.
- Separate **profile access** from **report export**. For profile access, the patient opens the share-QR screen and a short-lived, high-entropy, single-use challenge is displayed. A verified, authenticated doctor scans it; the patient confirms the doctor's identity and the profile/metric overview being shared. Only then does the API create the no-automatic-expiry doctor grant. The QR contains no health data, permanent patient identifier, or reusable access token, and scanning alone never grants access.
- The profile grant remains active until the patient revokes it or the doctor's verification/account/access is suspended. Show active doctors and last-access history to the patient, notify on grant creation, and record grant, revocation, and sensitive access events. The doctor may name the patient entry and reopen the patient in a saved list or scan history, but each view re-checks the live grant; those entries are references, not copied records or alternate authorization. Do not store unrestricted local copies. Do not create an emergency/break-glass bypass without explicit clinical, legal, and audit design.
- For **report export**, the patient previews and selects the report content and shares it as a secure link/QR, PDF, or text. Link/QR access should be scoped to that report snapshot, high-entropy, revocable, and short-lived by default; never make a public, guessable URL. PDFs and text can leave Ihssan's access controls, so show the recipient/content preview and a clear privacy warning before export/share. Avoid hidden metadata and include only selected fields. This export does not silently create a persistent doctor profile grant.
- In the doctor portal, scanning a patient profile QR follows the explicit profile-grant flow above and creates a scan-history/list reference after consent. Scanning a **paper medical document** is a different workflow: OCR may extract candidate fields into a review screen, but must not write results automatically. The doctor chooses to add verified fields to the currently selected and authorized patient's health history, archive the source document in that patient's record, or discard it. Require patient context and authorization before durable storage; quarantine temporary uploads, restrict access, and delete them after discard or a short processing timeout. Preserve the source and extraction provenance if a result is saved, and let the doctor correct OCR mistakes before committing.
- Derive roles and permissions on the server from trusted records. Never accept client-supplied role, verification, owner, or tenant identifiers as proof of access.
- Apply authorization on every API operation and every object lookup; return non-enumerating errors where appropriate.

### Health measurements

- Version metric definitions. Each definition specifies stable identifier, display metadata, data shape, unit/UCUM code where applicable, validation bounds, and whether the metric is active.
- Store observations with subject, metric-definition version, measured time, recorded time, source, author, and correction/supersession relationship.
- Use a typed representation for scalar and composite values. A normalized observation-value table or rigorously validated JSON shape is preferable to forcing every metric into one numeric column. Choose based on the initially supported metric set and query needs.
- Preserve original input and normalized value/unit when conversions are performed. Do not silently reinterpret historical observations when a definition changes.
- Store target ranges and their provenance separately from observations. A clinician-specific target must be linked to an authorized care relationship and have an effective period.
- Store test/lab reference ranges and Ihssan's approved guidance as distinct concepts. Ranges can depend on units, age, sex, pregnancy, clinical context, lab method, and clinician intent; never apply one universal threshold where that context matters. Version definitions and approved ranges with author, evidence/source, effective dates, and review date.
- Maintain an **admin Metric Catalog** for metric definitions, supported units, data-entry shapes, test explanations, cited sources, contextual reference ranges, and alert/help content. The admin dashboard can draft, edit, preview translations, submit for clinical review, schedule publication, inspect history, and roll back to a prior approved version. It must not permit unreviewed clinical thresholds or alert copy to go live.
- Use a clinical-content governance workflow: a designated clinician/editor gathers authoritative test-specific evidence (for example, the performing laboratory's own interval, recognized clinical guidance, or a documented specialist source) and records citation, population/context, method, unit, effective date, and limitations. A second qualified clinician reviews reference ranges and safety-critical alerts before release. A designated publisher activates the approved immutable version; separate author/reviewer/publisher duties where staffing allows, and audit every action. Re-review on a defined cadence and when evidence changes. Generic web values are not sufficient evidence, and not every test has one universally correct range.
- Keep old metric/content versions attached to historical results. New approved versions apply prospectively from an effective date; do not silently reinterpret old results or retroactively issue alerts. Require explicit reviewed migration/recalculation if that is ever clinically justified. If content is overdue for review or a source is withdrawn, flag it for admins and suppress unsafe interpretation rather than inventing a replacement threshold.
- Make calculations deterministic, unit-aware, tested, and explicit about missing, implausible, or stale data. A red/green flag must not imply diagnosis or falsely reassure. Each metric can have clinician-reviewed educational content explaining what the test measures and common interpretation factors; content must not present a universal range as a diagnosis. Every user-facing alert/advice message needs clinical review, appropriate localization, and a clear action path. Alerts only evaluate results a user has entered; Ihssan is not continuously monitoring the patient, and push delivery must never be represented as guaranteed emergency notification or care.
- The proposed AI feature uses the OpenAI API only as a server-side adapter to explain entered measurements from clinician-approved, versioned material, then may suggest finding/consulting a doctor. It does not diagnose, prescribe, recommend treatment, or replace clinical judgment. Ground responses in approved content and structured measurement/context; show uncertainty and direct users to a doctor when context is insufficient or results may be concerning. Do not place API keys in the apps. Before sending any health measurement to OpenAI, review current contractual privacy, retention/training, security, and cross-border processing terms for the selected API/service; obtain required approvals and consent, minimize payloads, omit direct identifiers, and provide a non-AI fallback. Do not assume that omitting a name makes health data anonymous. Evaluate hallucination, unsafe reassurance, prompt injection, multilingual quality, and clinical safety. A disclaimer alone is not a safety control.
- Begin with transparent rules and curated explanations. Keep trend analysis/advanced clinician decision support separate from patient education. Before any predictive or clinician-decision-support deployment, establish intended use, representative Moroccan validation data, performance and subgroup evaluation, explainability, versioning, monitoring/drift criteria, clinician override, and rollback. Obtain a valid legal basis and governance approval before using health data for model development; de-identification alone is not a blanket permission.

Avoid adopting the full FHIR model unless interoperability requirements justify it. Use stable terminology and plan an explicit mapping/export boundary if interoperability becomes a requirement.

### Appointments, pharmacy commerce, and donations

#### Appointment booking

- Treat appointment booking as a planned product capability after the initial directory release. A clinician or clinic must first be verified and have an operational booking method: the Ihssan doctor portal or a deliberately supported calendar/CRM integration.
- Give the doctor portal a schedule-management workflow for recurring weekly hours, clinic locations, appointment types/durations, breaks, buffers, holidays, one-off exceptions, booking lead time, and cancellation/reschedule rules. Store local schedules with the provider's IANA time zone (`Africa/Casablanca` for Morocco); store actual appointment instants in UTC and render them in the user's locale.
- Generate availability on the server from schedule rules, exceptions, existing confirmed bookings, temporary holds, and integration busy-times. The client availability list is advisory; the booking command must atomically claim a slot and prevent double booking under concurrency. Use short-lived holds while checkout or doctor approval is pending and expire/release abandoned holds.
- Define explicit states such as requested, held, awaiting doctor confirmation, awaiting payment, confirmed, reschedule requested, cancelled, completed, no-show, and refund pending/completed. Which transitions apply depends on appointment type. Make commands idempotent and audit changes; notify both parties without including sensitive health details in lock-screen messages.
- Support two operating modes: immediate confirmation for a doctor's published availability, or doctor acceptance for providers who need to review requests. The patient sees the confirmation mode and cancellation terms before submitting. Provide doctor-side accept/decline, reschedule proposals, cancellation, and availability blocking.
- Treat Google Sheets or a CRM as an integration, not an implicit source of truth. Prefer an official calendar/CRM API with least-privilege OAuth scopes, stable external event IDs, idempotent updates, conflict detection, sync-status visibility, retries, and disconnect/reconciliation tools. If a provider insists on Sheets, use a defined schema and owner, restricted service identity, change tracking, conflict policy, and clear behavior during sync failure; never claim a slot is confirmed until the authoritative system agrees. Do not scrape or use a user's personal credentials.
- Define reminder and notification policies, time-zone/DST behavior, clinic contact and directions, rescheduling, cancellation, no-show handling, provider outages, and patient support. Keep booking data separate from clinical encounter notes and never expose patient metrics to a scheduling integration unless explicitly required and consented.

#### In-app paid consultations

- Add remote consultations only after appointment booking and professional/legal review of teleconsultation in Morocco. Verify the clinician's credentials and permitted scope; define informed consent, patient identity, suitability/triage, emergency escalation, technical failure, record keeping, and clinician availability procedures.
- Integrate a vetted video provider through a server adapter. Use authenticated, short-lived room credentials, a waiting room, least-privilege participant roles, and secure transport. Do not record calls by default; any recording requires a separate justified policy and explicit consent. Avoid placing health data in meeting titles or third-party analytics.
- For prepaid consultations, show total price, currency, provider, cancellation/refund/no-show terms, and what happens if the call fails before payment. Confirm the appointment/slot and payment state through idempotent server workflows and verified CMI callbacks. Decide whether payment is captured at booking or authorized then captured on acceptance, based on CMI support and legal/accounting advice. Reconcile refunds, fees, and provider payouts; never treat a successful browser redirect as proof of payment.
- Keep consultation payment accounting separate from donations and pharmacy orders. The platform/foundation's merchant and provider-payout roles must be explicit and legally reviewed.

#### Medication ordering and pharmacy operations

- This is a later, separately gated capability, not implied by a pharmacy map pin or "open now" result. Before implementation, confirm Moroccan rules for online medicine sales, prescription-only/restricted products, pharmacist responsibility, delivery, patient data, returns, payment, and the roles of Ihssan versus each licensed pharmacy. Start only with categories and workflows counsel and participating pharmacists approve.
- Onboard and verify each pharmacy and responsible pharmacist. A future pharmacy portal should manage branches, operating/overnight hours, service areas, catalog, prices, stock freshness, order acceptance, substitutions, fulfillment, cancellations, refunds, and staff roles. Keep Ihssan's provider verification separate from pharmacy licensing/dispensing authorization.
- Build inventory as explicit source data with quantity/availability, price and currency, branch, last-updated time, and source (pharmacy portal, POS/CRM integration, or approved manual feed). Reject stale availability from checkout or label it clearly. Hirassa open-hours data is not inventory and is not permission to sell/dispense.
- Patient flow: select an eligible pharmacy and branch; review item, quantity, price, availability timestamp, and pickup/delivery choice; provide a prescription only where legally required; submit the request. The pharmacist validates the order and prescription, confirms stock and final price, and may propose a legally permitted substitute only with the patient's explicit approval. Never auto-substitute a medicine.
- Use a state machine such as draft, submitted, pharmacist review, awaiting patient decision, accepted/stock reserved, payment pending/paid, preparing, ready for pickup/out for delivery, completed, rejected, cancelled, refund pending/completed. Reserve stock atomically when accepted and release it on timeout/cancellation. Preserve a traceable order and pharmacist decision record.
- Add pickup and delivery only where each pharmacy supports it. Define service area, delivery handoff, proof of fulfillment, temperature/special-handling exclusions where relevant, failed delivery, partial fulfillment, and support responsibility. Do not promise delivery or availability until confirmed by the pharmacy.
- Process medicine-order payments as a separate CMI merchant/order flow from both donations and consultations. Prefer charging after pharmacist acceptance and final price confirmation if supported and lawful; otherwise clearly disclose prepayment and provide an automated, auditable refund path for rejected/unavailable items. Reconcile payment, pharmacy settlement, platform fees, refunds, and order state.
- Pilot with a small number of verified pharmacies and a narrow legally approved catalog. Expand geography and catalog only after stock accuracy, pharmacist response, refund handling, and patient support meet defined service levels.

- Model donation cases and contributions as explicit state machines. Ihssan's foundation is the intended recipient/distributor; verify cases before publication and record allocation, disbursement, fees, refunds, and reconciliation separately. Keep donation funds and platform operating funds distinguishable in the ledger and operational controls.
- **Status: the built flow is direct bank transfer to the patient with receipt confirmation (see Current Implementation Status and `docs/donations.md`); the CMI/foundation model below is not implemented.** Original plan: support donations by bank transfer to the foundation and card payment through CMI, subject to confirming the foundation's eligibility, merchant onboarding, supported checkout/callback model, settlement, refunds, disputes, and local requirements. For card payments, use CMI-hosted/tokenized flows and store provider references only, never raw card credentials. Verify callbacks/webhooks, make processing idempotent, reconcile bank transfers and CMI settlement against an auditable internal ledger, and clearly communicate when a bank transfer is pending confirmation.
- Keep maps and pharmacy-hours integrations behind server-side adapters. Restrict Google Maps keys by application and API; comply with attribution, caching, and provider terms. Treat Hirassa hours as a discovery signal only, never as live stock or dispensing authorization; apply the same provider freshness and fallback checks described in the directory and pharmacy-order plans.

## Database and Access Controls

- Treat migrations as the sole source of truth for schema, indexes, constraints, triggers, functions, and database policies. Review migrations like application code; never depend on manual production console edits.
- Separate migration credentials from runtime credentials. The API runtime must not connect as table owner or a role that bypasses row security.
- Enforce tenant and relationship authorization in the API and add PostgreSQL row-level security as defense in depth. If using transaction-scoped identity context for policies, set it locally within each transaction, test connection-pool reuse, and ensure context cannot leak between requests.
- Prefer explicit constraints and transactions for invariants: foreign keys, valid state transitions, uniqueness, and appointment conflicts.
- Use private object storage for documents and images, short-lived signed access, content-type/size validation, malware scanning where appropriate, and metadata that does not expose sensitive filenames.
- Add append-only security audit events for sensitive access and administrative actions. Keep PHI out of ordinary application logs, analytics, crash reports, and notification previews.
- Define retention/deletion workflows and backups together. Test restore, not just backup creation.

Every access policy needs positive and negative tests: permitted patient access, unrelated patient denial, revoked consent denial, cross-organization denial, unverified staff denial, and administrator access limited to documented duties. Run these against a real PostgreSQL-compatible test environment in CI.

## Security Baseline

### Identity and sessions

- Require MFA for staff and administrators; prefer phishing-resistant methods where supported. Add step-up authentication for high-impact actions.
- Use short-lived access tokens, secure refresh/session rotation and revocation, account recovery protections, and rate limits for authentication endpoints.
- Use platform secure storage for session credentials. Minimize local health-data persistence; document and encrypt any approved offline cache.
- Require staff verification and periodic access review. Log role, membership, and consent changes.
- Separate technical dashboard administration from clinical-content authority. Only designated clinical editors/reviewers may approve clinical content; publishing requires an approved version and is audited. Require MFA and least privilege for every admin capability.

### Application and infrastructure

- Enforce TLS, managed encryption at rest, secret-manager-backed credentials, least-privilege service identities, and documented key rotation.
- Separate development, staging, and production projects/accounts, credentials, storage, and payment environments. Production data must not be copied into lower environments.
- Protect sensitive mutations with authorization, validation, rate limits, idempotency keys where retries can duplicate effects, and CSRF protection for browser-based admin flows.
- Add request correlation IDs, security event monitoring, anomaly alerts, and operational dashboards without recording PHI.
- Run dependency and secret scanning, static analysis, migration checks, and signed/reproducible release builds where supported. Maintain an SBOM and a patch response process.
- Define incident response, breach assessment, service recovery objectives, backup retention, and disaster recovery exercises before launch.

Security is layered: RLS is useful defense in depth, not a substitute for server authorization, secure credentials, tests, and operational controls.

## Quality and Release Gates

Required checks for every change:

- Type checking, linting, formatting, unit tests, API contract checks, and migration validation in CI.
- Domain tests for metric conversions/validation, consent transitions, appointment boundaries/time zones, and donation/payment state transitions.
- Integration tests for database constraints, transactions, RLS, webhook idempotency, and object-storage permissions.
- End-to-end tests for patient, verified clinician, platform owner, scoped support admin, and donor workflows, including denied access, grant-QR replay/revocation, report-link expiry/revocation, account switching, and document-scan review before persistence.
- Authorization tests prove support admins cannot manage memberships, patient records require a patient grant, clinician review requires separate verified status, and only the platform owner can grant/revoke support permissions.
- Test Metric Catalog role separation, required source citations/reviews, version publication, future-only effective dates, and rollback; no unapproved range or alert can become active.
- For booking, test concurrent claims, hold expiry, time-zone boundaries, calendar sync retries/conflicts, duplicate events, cancellations, and reconciliation with the authoritative schedule.
- For consultations and pharmacy orders, test payment callback idempotency, refund/reversal paths, failed calls, stock reservation/release, stale inventory rejection, pharmacist review, and patient-approved substitutions.
- Clinical validation for every threshold, trend rule, and user-visible health message; analytics/model evaluation, subgroup performance, and rollback evidence before any clinician decision-support release.
- Accessibility checks, supported-device smoke tests, and performance budgets for startup, API latency, and map rendering.
- No unresolved critical/high security findings, no production secrets in client bundles, and a successful restore exercise before production launch.

Define severity thresholds, owners, and exception expiry dates. A passing automated suite does not replace a security review or user acceptance for clinical and payment behavior.

## Delivery Roadmap

### Phase 0: Product, privacy, and threat discovery

Set the adult-only launch policy and future dependent-profile boundary; confirm the first user journey, clinical boundaries, roles/capabilities, no-expiry/revocable QR-sharing lifecycle, data inventory, retention, foundation/payment flow, provider integrations, and risk owners. Plan Arabic, French, and English localization from the first release. Obtain Morocco-specific professional review of health-data, privacy, pharmacy, fundraising, payments, and data-transfer obligations. Produce an authorization matrix and threat model. **Exit:** stakeholders agree on the first release, clinical limits, operating model, and access rules.

### Phase 1: Engineering foundation

Create the monorepo/workspaces, Expo app, API service, PostgreSQL migration pipeline, generated API types, CI, environment separation, secret handling, logging policy, and architecture decision records. Add local setup and operational docs. **Exit:** a clean checkout can build and test; deploy to isolated staging; migrations apply reproducibly.

### Phase 2: Identity and authorization spine

Implement sign-in, recovery, profiles, verified clinician memberships, patient-care consent, authorization checks, audit events, and negative access tests. Bootstrap one platform owner and build owner-managed support-admin memberships with scoped permissions, MFA, grant/revoke history, and no self-service elevation. Deliver separate doctor and admin portals; doctor access is limited to records the patient has explicitly shared. Implement short-lived, single-use profile QR challenges that establish an ongoing, no-automatic-expiry grant only after patient confirmation. Add patient-visible active shares, access history, and immediate revocation. Let doctors save a private label/list/history reference, while rechecking authorization on every view. Implement report share previews and link/QR/PDF/text export with suitable revocation/expiry and user warnings. **Exit:** tests cover invalid/replayed QR, revoked grants, clinician suspension, stale saved references, report-link expiry, support-role escalation denial, and cross-patient denial.

### Phase 3: First health-tracking vertical slice

Support an initial, clinician-approved set including blood glucose and INR, with popular additional tests chosen by the clinical team; confirm exact tests, units, reference-range context, and input shapes before schema freeze. Build the admin Metric Catalog with drafts, evidence citations, clinical review, translations, scheduled publication, immutable versions, audit history, and rollback. Record, correct, list, and chart patient-entered results; implement source/units/timestamps, versioned ranges, provenance, reviewed educational information, patient alerts with clinically reviewed messages, consent checks, export/deletion behavior, and privacy-safe telemetry. Add doctor document scanning with OCR candidate extraction and explicit doctor review before adding structured results or archiving a source document to an authorized patient's chart. There is no connected-device ingestion in this phase. **Exit:** no clinical content publishes without required approval; clinicians approve definitions, educational content, and alert content; OCR never commits unreviewed values.

### Phase 4: Care directory first release

**Status: built with Mapbox and an admin-managed `care_providers` directory.** Launch nationwide doctor and pharmacy discovery using Google Maps Platform for map/navigation and evaluate Hirassa API for day/night pharmacy availability. Verify provider identity and clearly label the source and freshness of hours, including a call-to-confirm path and fallback when the availability API is unavailable or stale. Apply provider terms, quota controls, location minimization, and target-device performance tests. Appointment booking, live inventory, and medication ordering remain out of this launch scope; detailed follow-on plans are below. **Exit:** users can find and navigate to providers nationwide without the app implying that map data guarantees availability or pharmacy stock.

### Phase 5: Donation workflow

**Status: partly built as a direct-transfer workflow (cases, bank accounts, orders, receipts, confirmation, comment moderation, analytics). Card checkout, refunds, payouts and ledger reconciliation are not built.** Implement moderation, verified case publication, foundation-owned receipt and distribution workflows, bank-transfer instructions and reconciliation, CMI card checkout/callback integration, idempotent contributions, refunds/disputes, allocation, payout/reconciliation, and audit. Validate the foundation's legal/fiscal operating model and CMI merchant/payment support for Morocco. Pilot with test payments and operational review before enabling real funds. **Exit:** finance and operations can trace donations to cases, reconcile both payment channels, and recover from duplicate, delayed, and failed events.

### Phase 6: Measurement explanations and AI safety

Launch clinician-reviewed educational explanations for metrics and results in Arabic, French, and English. If using the OpenAI API, call it only from the server, constrain it to explaining supplied measurements using approved content, communicate uncertainty, avoid diagnosis/treatment, and offer finding a doctor as the next step; actual in-app consultation booking is a later feature. Assess current provider privacy/retention/training and cross-border terms, prompt-injection and hallucination safety, multilingual quality, and clinical review before pilot. Obtain required consent/approval before sending health measurements. Predictive claims and autonomous diagnosis/treatment remain out of scope. **Exit:** clinical leadership and privacy/security reviewers approve the bounded behavior, data flow, monitoring, and rollback; otherwise use curated non-AI explanations.

### Phase 7: Controlled pilot and production readiness

Run accessibility, security, privacy, load, restore, incident-response, and device testing. Review third-party contracts and Moroccan legal/compliance obligations. Use a limited pilot, staged rollout, feature flags, support playbooks, and rollback procedures. **Exit:** accountable owners accept residual risks and production runbooks have been exercised.

### Phase 8: Appointment operations and integrations

Add verified doctor/clinic schedule management, server-generated availability, booking holds, atomic conflict prevention, doctor acceptance or immediate-confirmation modes, rescheduling/cancellation, reminders, and operational reporting. Start with doctors who use the Ihssan portal; add one calendar/CRM integration at a time using official APIs, explicit source-of-truth rules, idempotent sync, conflict detection, and observable recovery from outages. **Exit:** concurrency tests demonstrate no double bookings, booking state reconciles with the provider's chosen calendar, and support can resolve sync failures without losing or duplicating bookings.

### Phase 9: Prepaid in-app consultations

After teleconsultation review, add consultation appointment types, informed consent, authenticated video rooms, clinician/patient readiness flows, CMI payment handling, cancellation/refund policy, and failed-call recovery. Pilot with a small verified clinician group; do not record calls by default. **Exit:** privacy/security and clinical operations approve the workflow, payment reconciliation balances, and test scenarios cover no-show, cancellation, declined appointments, network failure, refund, and duplicate callbacks.

### Phase 10: Pharmacy onboarding and medication orders

After legal and partner gates, launch the pharmacy portal, branch/catalog/stock management or approved POS feeds, pharmacist review, prescription handling for permitted categories, patient-approved substitutions, pickup/delivery, CMI order payments, refunds, and support operations. Start with a controlled pharmacy pilot and limited catalog, then expand by measured stock accuracy and fulfillment performance. **Exit:** licensed partners own dispensing decisions, order/inventory/payment states reconcile, stale stock is not sold as available, and refund/support obligations are exercised before wider rollout.

### Phase 11: Parent-managed dependent profiles

Keep the initial service adult-only. Before enabling child profiles, obtain jurisdiction-specific legal/clinical review and design verified guardian authority, separate dependent identity and health records, age-appropriate access, guardian consent and revocation, safeguarding/reporting paths, data minimization, and clear rules for multiple guardians or disputed authority. Define how access changes as a child matures and transfers to an adult account, including what historical records and prior sharing grants carry over. **Exit:** the guardian/dependent model and age-transition process are legally reviewed, threat-modeled, tested for cross-family access denial, and approved before any minor data is collected.

## Documentation to Maintain

- `docs/implementation-plan.md`: this architecture and delivery baseline.
- `docs/admin-operating-model.md`: owner/support membership, permission matrix, bootstrap, and admin operating procedures.
- Architecture decision records for identity provider, database hosting, API framework, maps, payments, and data representation.
- Data inventory and authorization matrix, including examples of allowed and denied access.
- Developer setup, environment variables (names only, never values), migrations, test commands, and deployment process.
- Security threat model, incident response, backup/restore, access review, and data deletion/export procedures.
- API documentation generated from the API contract and product documentation for metric definitions and user-visible limitations.

Keep docs close to code ownership and update them as decisions change. Do not duplicate the schema manually in prose when generated diagrams or migration-derived documentation can stay current.

## Unresolved Decisions Before Implementation

1. Which popular tests beyond blood glucose and INR will the first metric catalogue include? Clinical governance is defined above; exact test-specific source evidence and approved content remain to be assembled.
2. What is the foundation's legal/fiscal arrangement for receiving and distributing funds, and has CMI confirmed merchant onboarding, donation checkout, settlement, refund, and callback requirements?
3. What service levels, support hours, hosting/data-residency constraints, and recovery objectives are required?
4. Does Hirassa provide the required nationwide day/night pharmacy coverage, acceptable freshness, and commercial/API terms? Which provider-hours fields can Google Maps/Places lawfully supply and cache?
5. What current OpenAI API data-processing terms and configuration apply to health measurements, and what consent and Morocco-specific review are required before any values are sent?
6. What is the exact minimum profile summary shown after doctor access is granted, and which report fields can the patient select for each export format?

These are product and risk decisions, not implementation trivia. Record answers as architecture/product decisions before building the affected workflows.