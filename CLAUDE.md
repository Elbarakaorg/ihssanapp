# Project notes for Claude

## Stack
Expo (expo-router) + React Native + Reanimated, in `apps/mobile`. Avoid web-only or three.js-based libraries (shadergradient, react-three-fiber) unless explicitly requested; use `expo-linear-gradient`, `react-native-svg`, or `@shopify/react-native-skia` instead.

## Skills (`.claude/skills/`)
Vendored project skills, loaded automatically. Use them for UI/UX work:
- Expo (from expo/skills): `expo-native-ui`, `expo-ui`, `expo-design-system`, `expo-animation`, `expo-router`, `expo-data-fetching`, `expo-project-structure`, `expo-overview`, `expo-upgrade`, `expo-examples` (official `with-*` integration patterns, e.g. Supabase, Reanimated, Skia), `expo-dev-client`, `eas-update`, `eas-workflows`
- Vercel (from vercel-labs/agent-skills): `react-native-skills`, `composition-patterns`, `web-design-guidelines`
- Anthropic (from anthropics/skills): `frontend-design`
