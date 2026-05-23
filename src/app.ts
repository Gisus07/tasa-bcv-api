import { OpenAPIHono } from '@hono/zod-openapi';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { apiKeyResolver } from './middleware/apiKey.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ipRateLimit, registerRateLimit } from './middleware/rateLimit.js';
import { defaultZodHook } from './middleware/zodHook.js';
import { ES_TO_EN, translateSpec } from './i18n/translations.js';
import { health } from './routes/health.js';
import { docs } from './routes/docs.js';
import { buildV1 } from './routes/v1/index.js';
import { logger } from './logger.js';
import { env } from './env.js';
import { readFileSync } from 'node:fs';
import { todayCaracas } from './lib/dates.js';

/**
 * API version shown in the OpenAPI spec. Single source of truth: package.json
 * (read at startup). Falls back to '0.0.0' if it can't be read (D3).
 */
const API_VERSION = ((): string => {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

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
  // Only successful responses are cached — caching a 404/503 would let a CDN or
  // client keep serving a stale error after the data appears (BE-1).
  app.use('/v1/rates/*', async (c, next) => {
    await next();
    if (c.res.status < 200 || c.res.status >= 300) return;
    const path = c.req.path;
    if (path.endsWith('/latest')) {
      // 5-minute cache for "latest" — daily rates only change at 00:00 Caracas.
      c.header('Cache-Control', 'public, max-age=300');
    } else if (/\/v1\/rates\/\d{4}-\d{2}-\d{2}$/.test(path)) {
      // Specific historical dates can be cached for a day. They rarely change
      // (only on rare BCV corrections), and any change forces fetched_at to
      // shift so clients with conditional requests still see the new value.
      c.header('Cache-Control', 'public, max-age=86400');
    } else if (path.endsWith('/rates/range')) {
      // Past-only ranges are immutable; ranges that include today change daily.
      const to = c.req.query('to');
      c.header(
        'Cache-Control',
        to && to < todayCaracas() ? 'public, max-age=86400' : 'public, max-age=300',
      );
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

  // Resolve API keys before the rate limiter so per-tier limits apply.
  // The resolver attaches `c.var.apiKey` (null when anonymous); the limiter
  // reads it to pick the right bucket size.
  app.use('/v1/*', apiKeyResolver());

  if (!options.disableRateLimit) {
    // Stricter cap on the public signup endpoint to curb key spam (SEC-1).
    app.use('/v1/keys/register', registerRateLimit());
    // Skip rate limit on /health so uptime checks don't get 429'd.
    app.use('/v1/*', ipRateLimit());
  }

  app.route('/', health);
  app.route('/v1', buildV1());
  app.route('/', docs);

  const PRODUCTION_URL = env().PUBLIC_BASE_URL;

  // OpenAPI spec (idioma por defecto: español)
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'tasa-bcv-api',
      version: API_VERSION,
      description:
        'API REST pública del histórico oficial de tasas de cambio del Banco Central de Venezuela (BCV) para USD/VES y EUR/VES. Las tasas se actualizan diariamente a las 00:00 America/Caracas (lun–vie). Las fechas de fin de semana y feriados devuelven tasas propagadas con `is_propagated: true`.',
      contact: {
        name: 'Repositorio',
        url: 'https://github.com/Gisus07/tasa-bcv-api',
      },
      license: {
        name: 'AGPL-3.0-or-later',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
      },
    },
    servers: [
      { url: PRODUCTION_URL, description: 'Producción' },
    ],
    tags: [
      { name: 'rates', description: 'Consultas de tasas de cambio' },
      { name: 'keys', description: 'Gestión de API keys del tier Free' },
      { name: 'system', description: 'Estado y metadatos' },
      { name: 'admin', description: 'Endpoints administrativos (requieren bearer token)' },
    ],
    externalDocs: {
      description: 'Código fuente y documentación extendida',
      url: 'https://github.com/Gisus07/tasa-bcv-api',
    },
  });
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
  });

  // Versión en inglés del spec — generada en runtime aplicando el mapping
  // ES → EN sobre el JSON ya construido. Mantiene una sola fuente de verdad
  // (el código está en español) y traduce solo los strings visibles.
  app.get('/openapi-en.json', (c) => {
    const spec = app.getOpenAPIDocument({
      openapi: '3.1.0',
      info: {
        title: 'tasa-bcv-api',
        version: API_VERSION,
        description:
          'Public REST API for the official Banco Central de Venezuela (BCV) exchange rate history (USD/VES and EUR/VES). Rates are updated daily at 00:00 America/Caracas (Mon–Fri). Weekend and holiday dates return propagated rates with `is_propagated: true`.',
        contact: {
          name: 'Repository',
          url: 'https://github.com/Gisus07/tasa-bcv-api',
        },
        license: {
          name: 'AGPL-3.0-or-later',
          url: 'https://www.gnu.org/licenses/agpl-3.0.html',
        },
      },
      servers: [
        { url: PRODUCTION_URL, description: 'Production' },
      ],
      tags: [
        { name: 'rates', description: 'Exchange rate queries' },
        { name: 'keys', description: 'Free-tier API key management' },
        { name: 'system', description: 'Health and metadata' },
        { name: 'admin', description: 'Administrative endpoints (require bearer token)' },
      ],
      externalDocs: {
        description: 'Source code and extended documentation',
        url: 'https://github.com/Gisus07/tasa-bcv-api',
      },
    });
    return c.json(translateSpec(spec, ES_TO_EN));
  });

  app.onError(errorHandler);

  return app;
}
