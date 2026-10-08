# Admin portal

Vite + React + TypeScript web app for platform owners and support admins. Sign-in requires TOTP MFA (aal2); the API rejects `/v1/admin/*` without it.

Sections: overview, metrics and articles, support, provider verification, map locations (`/locations`), doctor comment reports (`/moderation`), giving & community (`/donations`), audit and team.

    npm install
    npm run dev      # local
    npx tsc -b       # typecheck
    npm run build    # production build

Environment (git-ignored `.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`, `VITE_MAPBOX_TOKEN`, `VITE_MAPBOX_STYLE_URL`, optional `VITE_APP_URL`. See `docs/vercel-deployment.md` and `docs/admin-operating-model.md`.
