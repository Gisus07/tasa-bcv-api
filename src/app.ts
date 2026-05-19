import { OpenAPIHono } from '@hono/zod-openapi';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/errorHandler.js';
import { ipRateLimit } from './middleware/rateLimit.js';
import { defaultZodHook } from './middleware/zodHook.js';
import { health } from './routes/health.js';
import { docs } from './routes/docs.js';
import { buildV1 } from './routes/v1/index.js';
import { logger } from './logger.js';

export interface AppOptions {
  /** Skip the IP rate limiter (test mode). */
  disableRateLimit?: boolean;
}

/**
 * Build the application graph. Pure factory so tests can spin up an isolated
 * instance per test file without leaking state.
 *
 * Mount order (matters for middleware visibility):
 *   1. Cross-cutting middleware (logger, security headers, CORS)
 *   2. Rate limit (skipped when disabled)
 *   3. /health (never rate-limited so monitors don't pollute)
 *   4. /v1/*
 *   5. /docs and /openapi.json
 *   6. Error handler (last)
 */
export function createApp(options: AppOptions = {}): OpenAPIHono {
  // The defaultHook only applies to routes registered directly on this app.
  // Sub-routers (built with new OpenAPIHono inside each module) need to
  // receive the same hook explicitly. See middleware/zodHook.ts.
  const app = new OpenAPIHono({ defaultHook: defaultZodHook });

  // Per-request log line (method, path, status, ms)
  app.use(
    '*',
    honoLogger((message, ...rest) => {
      logger().debug({ rest }, message);
    }),
  );

  // Apply secure headers to API routes, but skip the docs UI which loads its
  // own assets (Scalar CDN) and would otherwise be blocked by a strict CSP.
  const apiSecureHeaders = secureHeaders({
    // Explicitly disable browser APIs we don't use — defense in depth in case
    // someone embeds our JSON responses in a page they shouldn't.
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: [],
    },
    // The API serves JSON, so the strictest CSP applies.
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    // HSTS is already set by Railway's edge, but we double down.
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  });
  app.use('/v1/*', apiSecureHeaders);
  app.use('/health', apiSecureHeaders);
  app.use('/openapi.json', apiSecureHeaders);

  // Stamp every response with the API version for client-side feature gating.
  app.use('*', async (c, next) => {
    await next();
    c.header('X-API-Version', 'v1');
  });

  // Cache hints. Historical dates never change; "latest" can be cached briefly.
  app.use('/v1/rates/*', async (c, next) => {
    await next();
    const path = c.req.path;
    if (path.endsWith('/latest')) {
      // 5-minute cache for "latest" — daily rates only change at 00:00 Caracas.
      c.header('Cache-Control', 'public, max-age=300');
    } else if (/\/v1\/rates\/\d{4}-\d{2}-\d{2}$/.test(path)) {
      // Specific historical dates can be cached for a day. They rarely change
      // (only on rare BCV corrections), and any change forces fetched_at to
      // shift so clients with conditional requests still see the new value.
      c.header('Cache-Control', 'public, max-age=86400');
    } else {
      c.header('Cache-Control', 'public, max-age=600');
    }
  });

  // CORS: API is public, so allow any origin to read. POST is reserved for
  // the admin endpoint, which is bearer-protected (CORS just gates browser
  // visibility, not server-to-server calls).
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-API-Version', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge: 86400,
    }),
  );

  if (!options.disableRateLimit) {
    // Skip rate limit on /health so uptime checks don't get 429'd.
    app.use('/v1/*', ipRateLimit());
  }

  app.route('/', health);
  app.route('/v1', buildV1());
  app.route('/', docs);

  // OpenAPI spec
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'tasa-bcv-api',
      version: '0.1.0',
      description:
        'Public REST API for the official Banco Central de Venezuela (BCV) exchange rate history (USD/VES and EUR/VES). Rates are updated daily at 00:00 America/Caracas (Mon–Fri). Weekend and holiday dates return propagated rates with `is_propagated: true`.',
      license: {
        name: 'AGPL-3.0-or-later',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
      },
    },
    tags: [
      { name: 'rates', description: 'Exchange rate queries' },
      { name: 'system', description: 'Health and metadata' },
      { name: 'admin', description: 'Administrative endpoints (require bearer token)' },
    ],
  });
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
  });

  app.onError(errorHandler);

  return app;
}
