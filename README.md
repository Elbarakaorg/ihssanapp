# ihssanapp

Ihssan is a Morocco-first health and giving app: patient-entered health tracking, doctor and pharmacy discovery, treatments and reminders, patient-approved sharing with clinicians, and donations to verified cases.

## Repository

| Path | What |
| --- | --- |
| `apps/mobile` | Expo (expo-router) app for iOS, Android and web |
| `apps/admin-portal` | Vite/React admin portal (TOTP MFA required) |
| `services/api` | Hono API, deployed on Fly.io |
| `supabase/migrations` | Ordered SQL migrations (apply in filename order) |
| `docs` | Plans and runbooks |

## Docs

- [Architecture, delivery plan and current status](docs/implementation-plan.md)
- [Donations](docs/donations.md)
- [Admin operating model](docs/admin-operating-model.md)
- [Deployment: Vercel and Fly.io](docs/vercel-deployment.md)
- [Care directory data sources](docs/care-directory-data-sources.md)
- [App Store publishing](docs/app-store-publishing.md), [Google OAuth](docs/google-oauth-setup.md), [Resend email](docs/resend-email-setup.md), [Supabase email template](docs/supabase-email-template.md)
- `CLAUDE.md`: working notes for the AI assistant (stack, design language, feature notes)

## Develop

    cd apps/mobile && npm install && npx expo start
    cd apps/admin-portal && npm install && npm run dev
    cd services/api && npm install && npm test

Secrets live in git-ignored `.env.local` files; never commit them.
