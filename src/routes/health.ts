import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../middleware/zodHook.js';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { DatabaseDownError } from '../lib/errors.js';
import { HealthResponse } from '../schemas/common.js';

const route = createRoute({
  method: 'get',
  path: '/health',
  tags: ['system'],
  summary: 'Liveness + database reachability check',
  responses: {
    200: {
      description: 'API and database are reachable',
      content: { 'application/json': { schema: HealthResponse } },
    },
    503: {
      description: 'Database is unreachable',
      content: { 'application/json': { schema: HealthResponse } },
    },
  },
});

const startedAt = Date.now();

export const health = new OpenAPIHono({ defaultHook: defaultZodHook });
health.openapi(route, async (c) => {
  try {
    await db().execute(sql`SELECT 1`);
  } catch (err) {
    throw new DatabaseDownError(err);
  }
  return c.json(
    {
      status: 'ok' as const,
      db: 'reachable' as const,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    },
    200,
  );
});
