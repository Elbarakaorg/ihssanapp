import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { createApi } from './app.js';
import { createCareService } from './care-service.js';
import { createHirassaClient } from './guard.js';
import { createGooglePlacesClient } from './places.js';
import { createResendInvitationMailer } from './invitation-mailer.js';
import { createSupabaseDataAccess } from './supabase-data-access.js';

const apiEnvPath = resolve(process.cwd(), '.env.local');
const mobileEnvPath = resolve(process.cwd(), '../../apps/mobile/.env.local');
if (existsSync(mobileEnvPath)) config({ path: mobileEnvPath, override: false });
if (existsSync(apiEnvPath)) config({ path: apiEnvPath, override: true });
if (!existsSync(mobileEnvPath) && !existsSync(apiEnvPath)) config({ override: false });

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before starting the API.');
}

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const codespacesName = process.env.CODESPACE_NAME;
if (codespacesName) allowedOrigins.push(`https://${codespacesName}-5173.app.github.dev`);
const port = Number(process.env.PORT ?? 4000);
const invitationMailer = createResendInvitationMailer({
  apiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.MAILER_FROM_EMAIL,
  signupUrl: process.env.SUPPORT_INVITATION_SIGNUP_URL,
});
const placesKey = process.env.GOOGLE_PLACES_API_KEY;
const hirassaUrl = process.env.HIRASSA_GUARDS_URL;
const hirassaKey = process.env.HIRASSA_API_KEY;
const careService = createCareService({
  places: placesKey ? createGooglePlacesClient(placesKey) : null,
  guard: hirassaUrl && hirassaKey
    ? createHirassaClient({ guardsUrl: hirassaUrl, apiKey: hirassaKey, authHeader: process.env.HIRASSA_AUTH_HEADER })
    : null,
});
const app = createApi(createSupabaseDataAccess(supabaseUrl, publishableKey), allowedOrigins, invitationMailer, careService);

serve({ fetch: app.fetch, hostname: '0.0.0.0', port });
