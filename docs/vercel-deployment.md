# Vercel deployment

The mobile web app and admin portal are separate applications. Configure a separate Vercel project for each one and set its **Root Directory** to the matching path:

| Vercel project | Root Directory | Build/output |
| --- | --- | --- |
| Ihssan mobile web | `apps/mobile` | `npx expo export -p web` → `dist` |
| Ihssan admin portal | `apps/admin-portal` | `npm run build` → `dist` |

Each app has a `vercel.json` that specifies its build, output directory, SPA fallback for direct links and refreshes, and baseline security headers. Keep Vercel's **Include source files outside of the Root Directory** option enabled if the app build depends on files above its app folder.

Configure each Vercel project's environment variables for **Production**, **Preview**, and **Development** as appropriate:

- Mobile web: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Admin portal: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_BASE_URL`.

Use the deployed API's HTTPS origin for `VITE_API_BASE_URL`; do not leave it unset or point production at localhost. Only Supabase's publishable key belongs in browser variables. Never expose service-role keys, OAuth client secrets, or other server secrets through `EXPO_PUBLIC_*` or `VITE_*`.

For Google sign-in, add the exact deployed callback URLs to Supabase **Authentication → URL Configuration → Redirect URLs**:

- Mobile web: `https://<mobile-domain>/auth/callback`
- Admin portal: `https://<admin-domain>/`

The Google OAuth provider's authorized redirect URI remains the Supabase callback URL shown in `docs/google-oauth-setup.md`; it is not the Vercel domain. After a deployment, test the app root, nested routes opened directly, browser refresh on nested routes, and Google sign-in on desktop and mobile browsers.
