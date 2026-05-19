import { OpenAPIHono } from '@hono/zod-openapi';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/errorHandler.js';
import { ipRateLimit } from './middleware/rateLimit.js';
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
  const app = new OpenAPIHono();

  // Per-request log line (method, path, status, ms)
  app.use(
    '*',
    honoLogger((message, ...rest) => {
      logger().debug({ rest }, message);
    }),
  );

  // Apply secure headers to API routes, but skip the docs UI which loads its
  // own assets (Scalar CDN) and would otherwise be blocked by a strict CSP.
  app.use('/v1/*', secureHeaders());
  app.use('/health', secureHeaders());
  app.use('/openapi.json', secureHeaders());

  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST'] }));

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
