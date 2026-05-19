import { Hono } from 'hono';
import { apiReference } from '@scalar/hono-api-reference';

/**
 * Mounts /docs (Scalar UI). The OpenAPI JSON itself is exposed by the parent
 * OpenAPIHono via `app.doc('/openapi.json', ...)` — see `src/app.ts`.
 */
export const docs = new Hono();
docs.get(
  '/docs',
  apiReference({
    pageTitle: 'tasa-bcv-api · API reference',
    // theme and spec.url are accepted at runtime by the underlying Scalar
    // bundle but aren't surfaced in the current TypeScript types.
    ...({
      spec: { url: '/openapi.json' },
      theme: 'purple',
    } as Record<string, unknown>),
  }),
);
