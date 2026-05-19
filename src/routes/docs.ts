import { Hono } from 'hono';
import { apiReference } from '@scalar/hono-api-reference';

/**
 * Light, opinionated branding for the Scalar docs page. Avoids overwhelming
 * Scalar's default styles — only tweaks colors, spacing of the sidebar header,
 * and the link panel so the page reads as "tasa-bcv-api" instead of "yet
 * another OpenAPI playground".
 */
const CUSTOM_CSS = `
:root {
  --scalar-font: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --scalar-font-code: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  --scalar-color-accent: #7c3aed;
  --scalar-color-accent-hover: #6d28d9;
}

.dark-mode {
  --scalar-color-accent: #a78bfa;
  --scalar-color-accent-hover: #c4b5fd;
}

/* Slight visual polish */
.scalar-card { border-radius: 12px; }
.scalar-api-reference .heading { letter-spacing: -0.01em; }
`;

const COMMON_OPTIONS = {
  theme: 'purple' as const,
  customCss: CUSTOM_CSS,
  // Surface the most popular HTTP clients first in the playground.
  hiddenClients: {
    node: ['undici', 'unirest'],
    php: ['guzzle', 'http2'],
    java: ['asynchttp', 'nethttp', 'okhttp', 'unirest'],
    go: ['native'],
    csharp: ['httpclient', 'restsharp'],
    kotlin: ['okhttp'],
    objc: ['nsurlsession'],
    swift: ['nsurlsession'],
    r: ['httr'],
  },
};

/**
 * Routes:
 *   GET /docs       → Spanish (default). Redirects to /docs/en when the
 *                     browser's primary Accept-Language starts with "en"
 *                     and the visitor hasn't explicitly asked to stay (?lang=es).
 *   GET /docs/es    → Spanish, explicit.
 *   GET /docs/en    → English.
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
      ...COMMON_OPTIONS,
    } as Record<string, unknown>),
  }),
);

docs.get(
  '/docs/es',
  apiReference({
    pageTitle: 'tasa-bcv-api · Documentación',
    ...({
      spec: { url: '/openapi.json' },
      ...COMMON_OPTIONS,
    } as Record<string, unknown>),
  }),
);

docs.get(
  '/docs/en',
  apiReference({
    pageTitle: 'tasa-bcv-api · API reference',
    ...({
      spec: { url: '/openapi-en.json' },
      ...COMMON_OPTIONS,
    } as Record<string, unknown>),
  }),
);
