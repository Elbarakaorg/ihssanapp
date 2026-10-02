# Google Sign-In Setup

Google OAuth is brokered by Supabase Auth. The Ihssan mobile app must not contain a Google client secret or a Google OAuth client secret; do not add either to `.env.local`.

## Google Cloud

1. Create or select the Google Cloud project for Ihssan.
2. In **Google Auth Platform → Branding**, set the app name to **Ihssan**, add the support email, app logo, home page (`https://ihssanapp.com`), and privacy policy URL. Verify `ihssanapp.com` as an authorized domain. This is what replaces the generic “Sign in to dqwmmcmpznfjjkfvprit.supabase.co” wording on Google's consent screen.
3. In **Google Auth Platform → Audience**, configure the appropriate audience. While the consent screen is in Testing, add the people who will test sign-in as test users.
4. Create an OAuth 2.0 Client ID with application type **Web application**. Request only the `openid`, `email`, and `profile` scopes.
5. Add this exact **Authorized redirect URI** to the Google OAuth client. Google redirects to Supabase; app URLs are configured in Supabase, not in this Google field:

   `https://dqwmmcmpznfjjkfvprit.supabase.co/auth/v1/callback`

6. Copy the generated client ID and client secret. Enter them only in the Supabase dashboard in the next section. Never put the client secret in the mobile app, `.env.local`, source control, or chat.

## Supabase

1. Open **Authentication → Sign In / Providers → Google** for the Ihssan development project.
2. Enable Google and enter the Google OAuth **client ID** and **client secret**.
3. Open **Authentication → URL Configuration**. Set the production **Site URL** to `https://ihssanapp.com` (or your chosen canonical production domain), then add each exact app callback URL to the redirect allow list:
   - `http://localhost:8081/auth/callback` for local Expo web.
   - `http://localhost:5173/` for the separate admin portal during local development.
   - `https://urban-journey-jr79v6vvjp6xf9vx-8081.app.github.dev/auth/callback` for the current Codespaces mobile web preview.
   - `https://urban-journey-jr79v6vvjp6xf9vx-5173.app.github.dev/` for the current Codespaces admin portal. Codespaces hostnames can change; update both entries when they do.
   - `https://ihssanapp.com/auth/callback` for production web. Add the `www` variant only if the app will use it as a distinct callback host.
   - `https://admin.ihssanapp.com/` for the production admin portal if deployed on that subdomain; use the actual admin host if different.
   - `ihssan://auth/callback` for native development/production builds that register the `ihssan` custom URL scheme.
4. Keep email/password signup enabled if you want both methods. Google provider enablement is separate from the app's local environment variables.
5. Keep **Confirm email** enabled in the hosted Supabase project's email provider settings. Admin invitation acceptance requires a confirmed email that matches the invited address. The local `supabase/config.toml` also enables email confirmation.

For Expo Go, `Linking.createURL()` uses a temporary `exp://<device-host>:<port>/--/auth/callback` URL. That URL changes with the development host; add the exact current URL to Supabase's redirect allow list while testing in Expo Go. A development or production native build uses the registered `ihssan://auth/callback` scheme. For a public production release, prefer verified iOS Universal Links and Android App Links over a custom scheme alone, and register the verified HTTPS domain in Expo native configuration and Supabase's allow list.

## Keys and Other Services

No Google credential is required in the app `.env.local` for Google sign-in. Supabase receives the OAuth callback and returns an authenticated session to the app. Google Maps Platform uses separate API keys and is not required for authentication. OpenAI, CMI, Hirassa, email delivery, and analytics credentials are unrelated to Google sign-in and should only be configured server-side when those features are implemented.
