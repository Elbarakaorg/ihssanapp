import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { z } from 'zod';

import { canAccessAdminPortal, canManageMemberships, hasPermission, supportPermissions } from './admin-permissions.js';
import { DataAccessError, type AdminMembership, type AuthIdentity, type DataAccess } from './data-access.js';
import { NotConfiguredError, RateLimitError, type CareService } from './care-service.js';
import type { SupportInvitationMailer } from './invitation-mailer.js';

type Variables = {
  identity: AuthIdentity;
  accessToken: string;
};

const permissionsSchema = z.array(z.enum(supportPermissions)).max(supportPermissions.length);
const grantSchema = z.object({
  userId: z.string().uuid(),
  permissions: permissionsSchema,
}).strict();
const invitationSchema = z.object({
  email: z.string().trim().email().max(254),
  permissions: permissionsSchema.min(1),
}).strict();
const updatePermissionsSchema = z.object({
  permissions: permissionsSchema,
}).strict();
const profileChangesSchema = z.object({
  display_name: z.string().trim().min(2).max(80).optional(),
  preferred_locale: z.enum(['ar', 'fr', 'en']).optional(),
}).strict().refine((changes) => Object.keys(changes).length > 0);
const measurementSchema = z.object({
  metricKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  numericValue: z.number().finite().positive(),
  unit: z.string().trim().min(1).max(32),
  measuredAt: z.string().datetime({ offset: true }),
}).strict();

const languageSchema = z.enum(['ar', 'fr', 'en']).default('fr');
const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(500).max(20000).default(5000),
  kind: z.enum(['pharmacy', 'hospital', 'clinic', 'all']).default('all'),
  lang: languageSchema,
});
const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  lang: languageSchema,
});

export function createApi(dataAccess: DataAccess, allowedOrigins: string[] = [], invitationMailer: SupportInvitationMailer | null = null, careService: CareService | null = null) {
  const app = new Hono<{ Variables: Variables }>();
  const origins = new Set(allowedOrigins);

  app.use('/v1/*', cors({
    origin: (origin) => origins.has(origin) ? origin : '',
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  }));

  app.get('/health', (context) => context.json({ status: 'ok' }));

  app.use('/v1/*', async (context, next) => {
    const authorization = context.req.header('Authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) return context.json({ error: 'Authentication required.' }, 401);

    const accessToken = match[1];
    const identity = await dataAccess.verifyAccessToken(accessToken).catch(() => null);
    if (!identity) return context.json({ error: 'Session is invalid or expired.' }, 401);

    context.set('identity', identity);
    context.set('accessToken', accessToken);
    await next();
  });

  app.get('/v1/care/nearby', async (context) => {
    const parsed = nearbyQuerySchema.safeParse(context.req.query());
    if (!parsed.success) return context.json({ error: 'Search parameters are invalid.' }, 400);
    if (!careService) return context.json({ error: 'Care directory is not available.' }, 503);
    try {
      const { lat, lng, radius, kind, lang } = parsed.data;
      return context.json(await careService.nearby(context.get('identity').id, { latitude: lat, longitude: lng, radiusMeters: radius, kind, language: lang }));
    } catch (error) {
      return respondToCareError(context, error);
    }
  });

  app.get('/v1/care/search', async (context) => {
    const parsed = searchQuerySchema.safeParse(context.req.query());
    if (!parsed.success) return context.json({ error: 'Search parameters are invalid.' }, 400);
    if (!careService) return context.json({ error: 'Care directory is not available.' }, 503);
    try {
      const { q, lat, lng, lang } = parsed.data;
      return context.json({ places: await careService.search(context.get('identity').id, { query: q, latitude: lat, longitude: lng, language: lang }) });
    } catch (error) {
      return respondToCareError(context, error);
    }
  });

  app.get('/v1/me', async (context) => {
    try {
      const profile = await dataAccess.getProfile(context.get('accessToken'), context.get('identity').id);
      if (!profile) return context.json({ error: 'Profile not found.' }, 404);
      return context.json({ profile });
    } catch (error) {
      return respondToDataError(context, error, 'Could not load profile.');
    }
  });

  app.patch('/v1/me', async (context) => {
    const parsed = profileChangesSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: 'Profile changes are invalid.' }, 400);

    try {
      const profile = await dataAccess.updateProfile(context.get('accessToken'), context.get('identity').id, parsed.data);
      return context.json({ profile });
    } catch (error) {
      return respondToDataError(context, error, 'Could not update profile.');
    }
  });

  app.get('/v1/metric-definitions', async (context) => {
    try {
      const definitions = await dataAccess.listMetricDefinitions(context.get('accessToken'));
      return context.json({ definitions });
    } catch (error) {
      return respondToDataError(context, error, 'Could not load metric definitions.');
    }
  });

  app.get('/v1/measurements', async (context) => {
    try {
      const measurements = await dataAccess.listMeasurements(context.get('accessToken'), context.get('identity').id);
      return context.json({ measurements });
    } catch (error) {
      return respondToDataError(context, error, 'Could not load measurements.');
    }
  });

  app.post('/v1/measurements', async (context) => {
    const parsed = measurementSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: 'Measurement values are invalid.' }, 400);

    try {
      const measurement = await dataAccess.createMeasurement(
        context.get('accessToken'),
        context.get('identity').id,
        parsed.data,
      );
      return context.json({ measurement }, 201);
    } catch (error) {
      return respondToDataError(context, error, 'Could not save measurement.');
    }
  });

  app.get('/v1/admin/me', async (context) => {
    try {
      await dataAccess.acceptSupportAdminInvitation(context.get('accessToken'));
      const membership = await dataAccess.getAdminMembership(context.get('accessToken'), context.get('identity').id);
      if (!canAccessAdminPortal(membership)) return context.json({ error: 'Admin access required.' }, 403);
      return context.json({ membership });
    } catch (error) {
      return respondToDataError(context, error, 'Could not load admin membership.');
    }
  });

  app.get('/v1/admin/memberships', async (context) => {
    const actor = await getAdminMembership(dataAccess, context.get('accessToken'), context.get('identity'));
    if (!canManageMemberships(actor)) return context.json({ error: 'Platform owner permission required.' }, 403);

    try {
      const memberships = await dataAccess.listAdminMemberships(context.get('accessToken'));
      return context.json({ memberships });
    } catch (error) {
      return respondToDataError(context, error, 'Could not load support memberships.');
    }
  });

  app.post('/v1/admin/memberships', async (context) => {
    const actor = await getAdminMembership(dataAccess, context.get('accessToken'), context.get('identity'));
    if (!canManageMemberships(actor)) return context.json({ error: 'Platform owner permission required.' }, 403);

    const parsed = grantSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: 'Support membership request is invalid.' }, 400);

    try {
      const membershipId = await dataAccess.grantSupportAdmin(
        context.get('accessToken'),
        parsed.data.userId,
        parsed.data.permissions,
      );
      return context.json({ membershipId }, 201);
    } catch (error) {
      return respondToDataError(context, error, 'Could not grant support access.');
    }
  });

  app.patch('/v1/admin/memberships/:membershipId', async (context) => {
    const actor = await getAdminMembership(dataAccess, context.get('accessToken'), context.get('identity'));
    if (!canManageMemberships(actor)) return context.json({ error: 'Platform owner permission required.' }, 403);

    const parsed = updatePermissionsSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: 'Permission update is invalid.' }, 400);

    try {
      await dataAccess.updateSupportAdminPermissions(context.get('accessToken'), context.req.param('membershipId'), parsed.data.permissions);
      return context.body(null, 204);
    } catch (error) {
      return respondToDataError(context, error, 'Could not update support permissions.');
    }
  });

  app.delete('/v1/admin/memberships/:membershipId', async (context) => {
    const actor = await getAdminMembership(dataAccess, context.get('accessToken'), context.get('identity'));
    if (!canManageMemberships(actor)) return context.json({ error: 'Platform owner permission required.' }, 403);

    try {
      await dataAccess.revokeSupportAdmin(context.get('accessToken'), context.req.param('membershipId'));
      return context.body(null, 204);
    } catch (error) {
      return respondToDataError(context, error, 'Could not revoke support access.');
    }
  });

  app.get('/v1/admin/invitations', async (context) => {
    const actor = await getAdminMembership(dataAccess, context.get('accessToken'), context.get('identity'));
    if (!canManageMemberships(actor)) return context.json({ error: 'Platform owner permission required.' }, 403);

    try {
      const invitations = await dataAccess.listSupportAdminInvitations(context.get('accessToken'));
      return context.json({ invitations });
    } catch (error) {
      return respondToDataError(context, error, 'Could not load support invitations.');
    }
  });

  app.post('/v1/admin/invitations', async (context) => {
    const actor = await getAdminMembership(dataAccess, context.get('accessToken'), context.get('identity'));
    if (!canManageMemberships(actor)) return context.json({ error: 'Platform owner permission required.' }, 403);

    const parsed = invitationSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: 'Invitation email or permissions are invalid.' }, 400);

    try {
      const invitationId = await dataAccess.inviteSupportAdminByEmail(
        context.get('accessToken'),
        parsed.data.email.toLowerCase(),
        parsed.data.permissions,
      );
      let delivery: 'sent' | 'not_configured' | 'failed' = 'not_configured';
      if (invitationMailer) {
        try {
          await invitationMailer.send({ email: parsed.data.email.toLowerCase() });
          delivery = 'sent';
        } catch (error) {
          console.error('Support invitation email delivery failed.', error);
          delivery = 'failed';
        }
      }
      return context.json({ invitationId, delivery }, 201);
    } catch (error) {
      return respondToDataError(context, error, 'Could not create support invitation.');
    }
  });

  app.delete('/v1/admin/invitations/:invitationId', async (context) => {
    const actor = await getAdminMembership(dataAccess, context.get('accessToken'), context.get('identity'));
    if (!canManageMemberships(actor)) return context.json({ error: 'Platform owner permission required.' }, 403);

    try {
      await dataAccess.revokeSupportAdminInvitation(context.get('accessToken'), context.req.param('invitationId'));
      return context.body(null, 204);
    } catch (error) {
      return respondToDataError(context, error, 'Could not revoke support invitation.');
    }
  });

  return app;
}

async function getAdminMembership(dataAccess: DataAccess, accessToken: string, identity: AuthIdentity): Promise<AdminMembership | null> {
  return dataAccess.getAdminMembership(accessToken, identity.id);
}

function respondToDataError(context: { json: (body: unknown, status?: number) => Response }, error: unknown, fallback: string) {
  if (error instanceof DataAccessError) return context.json({ error: error.message }, error.statusCode);
  return context.json({ error: fallback }, 500);
}
function respondToCareError(context: { json: (body: unknown, status?: number) => Response }, error: unknown) {
  if (error instanceof RateLimitError) return context.json({ error: 'Too many requests. Please wait a moment.' }, 429);
  if (error instanceof NotConfiguredError) return context.json({ error: 'Care directory is not available.' }, 503);
  return context.json({ error: 'Could not load places right now.' }, 502);
}
