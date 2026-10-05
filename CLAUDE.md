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
