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
  summary:
    'Comprobación de disponibilidad de la API y conectividad con la base de datos',
  responses: {
    200: {
      description: 'La API y la base de datos están disponibles',
      content: { 'application/json': { schema: HealthResponse } },
    },
    503: {
      description: 'La base de datos no está disponible',
      content: { 'application/json': { schema: HealthResponse } },
    },
  },
});

const startedAt = Date.now();

export const health = new OpenAPIHono({ defaultHook: defaultZodHook });

// Liveness: 200 while the process is up, without touching the DB. Uptime
// monitors should hit this so a DB blip doesn't read as a dead process.
// Railway's deploy healthcheck stays on /health (which also checks the DB =
// readiness). (BE-5)
health.get('/health/live', (c) =>
  c.json({
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  }),
);

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
