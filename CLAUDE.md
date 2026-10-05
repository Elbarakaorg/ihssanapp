# Project notes for Claude

## Stack
Expo (expo-router) + React Native + Reanimated, in `apps/mobile`. Avoid web-only or three.js-based libraries (shadergradient, react-three-fiber) unless explicitly requested; use `expo-linear-gradient`, `react-native-svg`, or `@shopify/react-native-skia` instead.

## Skills (`.claude/skills/`)
Vendored project skills, loaded automatically. Use them for UI/UX work:
- Expo (from expo/skills): `expo-native-ui`, `expo-ui`, `expo-design-system`, `expo-animation`, `expo-router`, `expo-data-fetching`, `expo-project-structure`, `expo-overview`, `expo-upgrade`, `expo-examples` (official `with-*` integration patterns, e.g. Supabase, Reanimated, Skia), `expo-dev-client`, `eas-update`, `eas-workflows`
- Vercel (from vercel-labs/agent-skills): `react-native-skills`, `composition-patterns`, `web-design-guidelines`
- Anthropic (from anthropics/skills): `frontend-design`
- Emil Kowalski (from emilkowalski/skills, MIT): `animate-expo`, `emil-design-eng`, `apple-design`, `break-ui`, `review-animations`, `find-animation-opportunities`, `improve-animations`, `animation-vocabulary`
- Taste (from leonxlnx/taste-skill, MIT): `redesign-existing-projects`, `full-output-enforcement`
- Impeccable (from pbakaus/impeccable, Apache-2.0): `impeccable` (playbooks only; the `scripts/` launcher is excluded because it downloads a binary)
- Licenses for the three vendored repos are in `.claude/skills/_licenses/`.

Precedence: the project's own design tokens and the `expo-*` skills win over the generic design skills. Several of the added skills are web-oriented (CSS, Tailwind, GSAP); use them for `apps/admin-portal`, and for the mobile app only take the principles (motion, hierarchy, edge cases). Use `animate-expo` for native motion, `break-ui` to test screens with worst-case data (long names, Arabic/French text, empty lists).

## Loading indicator
`apps/mobile/src/ui/thinking-orb*.tsx` wraps [thinking-orbs](https://github.com/jakubantalik/thinking-orbs) (MIT, Jakub Antalik; license in `docs/third-party/`). Web uses the published canvas component; native is Skia, adapted from the repo's React Native port (not verified on a device). Use `ThinkingOrb` for prominent loading states; keep `ActivityIndicator` in small buttons.

## Visual language
Verses live in `features/spirit/verses.ts` (Arabic + English, Amiri font); home shows one per day, `/verses` lists all. Keep Arabic text exact (Uthmani script).
Wabi-sabi first: warm washi-paper/earth palette in `ui/palette.ts`, uneven hand-cut corners (`wobble`), restraint. Victorian touch: EB Garamond headings (`display`) and the `Ornament` fleuron divider under page headings. Conceptual-sketch touch: hand-drawn, slightly irregular SVG strokes. Body text stays on the system font. Use palette tokens, never hardcoded colors.

## Medicine & treatments
`features/medicine/`: static generic-name directory (no doses); each medicine = how much (amount+unit) / how often (daily, every N days, weekdays, as-needed with max per day + min gap) / for how long (or ongoing); dose logging, doctor prescribing via `prescribe_treatment` (needs an active `medical_profile` grant). Migration `202610080001`. Local dose reminders (reminders.ts, planned 7 days ahead), stock/refill tracking and adherence reports (migration 202610080002).
Built-in articles/blogs live in `features/content/library.ts` (not clinician-reviewed; needs medical review) and merge with DB `blog_articles`.

## Launch readiness
- Migration `202610090001`: `delete_my_account()` (profile cascade, then auth user; anonymised and banned if audit FKs block), comment reports (`report_doctor_comment`, auto "under_review" at 3 open reports) and admin RPCs `admin_list_comment_reports` / `admin_resolve_comment_report` (permission `support.requests.manage`, admin portal page `/moderation`).
- Sign in with Apple (iOS only): `expo-apple-authentication` + `signInWithIdToken`. Needs Apple Developer setup and the Apple provider enabled in Supabase; needs a dev client, not Expo Go.
- API deploy: `services/api/Dockerfile` (`npm start`, port from `PORT`). Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CORS_ORIGINS and optional OPENAI/RESEND/HIRASSA/GOOGLE_PLACES keys as host env vars, then point `EXPO_PUBLIC_API_BASE_URL` at it.
