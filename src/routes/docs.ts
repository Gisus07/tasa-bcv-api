import { Hono } from 'hono';
import { apiReference } from '@scalar/hono-api-reference';

/**
 * Serves the Scalar UI for both languages plus an Accept-Language auto-detect
 * on the canonical `/docs` path.
 *
 * Routes:
 *   GET /docs       → Spanish (default). Redirects to /docs/en when the
 *                     browser's primary Accept-Language starts with "en"
 *                     and the visitor hasn't explicitly asked to stay (?lang=es).
 *   GET /docs/es    → Spanish, explicit.
 *   GET /docs/en    → English.
 *
 * The OpenAPI JSON itself lives at /openapi.json (ES) and /openapi-en.json (EN).
 * Scalar pulls those over the network when the page renders.
 */
export const docs = new Hono();

docs.get('/docs', async (c, next) => {
  const explicit = c.req.query('lang');
  if (explicit === 'es') return next();
  if (explicit === 'en') return c.redirect('/docs/en', 302);

  const accept = c.req.header('accept-language') ?? '';
  const primary = accept.split(',')[0]?.trim().toLowerCase() ?? '';
  if (primary.startsWith('en')) {
    return c.redirect('/docs/en', 302);
  }
  await next();
});

docs.get(
  '/docs',
  apiReference({
    pageTitle: 'tasa-bcv-api · Documentación',
    ...({
      spec: { url: '/openapi.json' },
      theme: 'purple',
    } as Record<string, unknown>),
  }),
);

docs.get(
  '/docs/es',
  apiReference({
    pageTitle: 'tasa-bcv-api · Documentación',
    ...({
      spec: { url: '/openapi.json' },
      theme: 'purple',
    } as Record<string, unknown>),
  }),
);

docs.get(
  '/docs/en',
  apiReference({
    pageTitle: 'tasa-bcv-api · API reference',
    ...({
      spec: { url: '/openapi-en.json' },
      theme: 'purple',
    } as Record<string, unknown>),
  }),
);
