import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from './app.js';

beforeAll(() => {
  // app.ts → env.ts requires DATABASE_URL even though /openapi.json
  // doesn't actually open a connection. Provide a benign value.
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.NODE_ENV = 'test';
});

describe('createApp', () => {
  it('builds an OpenAPIHono instance without crashing', () => {
    const app = createApp({ disableRateLimit: true });
    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe('function');
  });

  it('exposes /openapi.json with all v1 endpoints registered', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const spec = (await res.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
      info: { title: string; license?: { name: string } };
    };

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('tasa-bcv-api');
    expect(spec.info.license?.name).toBe('AGPL-3.0-or-later');

    // Verify every public route declared in the plan is present.
    const expectedPaths = [
      '/health',
      '/v1/rates/latest',
      '/v1/rates/range',
      '/v1/rates/usd',
      '/v1/rates/eur',
      '/v1/rates/{date}',
      '/v1/last-updated',
      '/v1/admin/trigger-ingest',
      '/v1/admin/keys',
      '/v1/admin/keys/{id}/revoke',
      '/v1/keys/register',
      '/v1/keys/me',
      '/v1/keys/me/usage',
    ];
    for (const p of expectedPaths) {
      expect(spec.paths[p]).toBeDefined();
    }
  });

  it('/v1/keys/me returns 401 without API key', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/v1/keys/me');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('admin endpoint still works with Bearer (apiKeyResolver ignores non-tbk_ tokens)', async () => {
    process.env.ADMIN_TOKEN = 'thisIsAStrongTokenForTesting1234';
    const app = createApp({ disableRateLimit: true });
    // Without the correct admin token: 401 from adminAuth (not from apiKeyResolver)
    const res = await app.request('/v1/admin/trigger-ingest', {
      method: 'POST',
      headers: { Authorization: 'Bearer notTheRightToken12345' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('serves the Scalar UI at /docs (Spanish by default)', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/docs');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain('scalar');
  });

  it('serves an English Scalar UI at /docs/en', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/docs/en');
    expect(res.status).toBe(200);
  });

  it('redirects /docs → /docs/en when Accept-Language prefers English', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/docs', {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/docs/en');
  });

  it('honors ?lang=es over Accept-Language', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/docs?lang=es', {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    expect(res.status).toBe(200);
  });

  it('exposes a translated /openapi-en.json with the English info description', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/openapi-en.json');
    expect(res.status).toBe(200);
    const spec = (await res.json()) as {
      info: { description: string };
      tags: { name: string; description: string }[];
    };
    expect(spec.info.description).toContain('Public REST API');
    const ratesTag = spec.tags.find((t) => t.name === 'rates');
    expect(ratesTag?.description).toBe('Exchange rate queries');
  });

  it('/openapi.json keeps Spanish descriptions', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const spec = (await res.json()) as {
      info: { description: string };
      tags: { name: string; description: string }[];
    };
    expect(spec.info.description).toContain('API REST pública');
    const ratesTag = spec.tags.find((t) => t.name === 'rates');
    expect(ratesTag?.description).toBe('Consultas de tasas de cambio');
  });

  it('rejects unknown routes with 404', async () => {
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/v1/nonexistent');
    expect(res.status).toBe(404);
  });

  it('admin/trigger-ingest returns 401 without a bearer token', async () => {
    process.env.ADMIN_TOKEN = 'thisIsAStrongTokenForTesting1234';
    // Re-import env cache reset is not exposed in the public app surface;
    // the middleware reads env() on every request so updating process.env is enough.
    const app = createApp({ disableRateLimit: true });
    const res = await app.request('/v1/admin/trigger-ingest', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });
});
