import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { runDailyUpdate } from '../../jobs/dailyUpdate.js';
import { logger } from '../../logger.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { ErrorResponse } from '../../schemas/common.js';
import { TriggerIngestResponse } from '../../schemas/rates.js';

const route = createRoute({
  method: 'post',
  path: '/admin/trigger-ingest',
  tags: ['admin'],
  summary: 'Dispara una ingesta diaria manualmente',
  description:
    'Endpoint protegido con bearer token que fuerza un daily-update sin esperar al cron. Útil cuando el run programado falla o para refrescar tras un deploy. Devuelve 202 porque el job corre en background.',
  ...({
    'x-codeSamples': codeSamplesFor({
      path: '/v1/admin/trigger-ingest',
      method: 'POST',
      bearer: true,
      body: { await: false },
    }),
  } as Record<string, unknown>),
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              await: z.boolean().optional().default(false).openapi({
                description: 'Cuando es true, espera a que la ingesta termine antes de responder.',
              }),
            })
            .openapi('TriggerIngestRequest'),
        },
      },
      required: false,
    },
  },
  responses: {
    202: {
      description: 'Job iniciado (o finalizado, si `await=true`)',
      content: { 'application/json': { schema: TriggerIngestResponse } },
    },
    401: {
      description: 'Token admin faltante o inválido',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const adminTriggerIngest = new OpenAPIHono({ defaultHook: defaultZodHook });
adminTriggerIngest.use('/admin/*', adminAuth());
adminTriggerIngest.openapi(route, async (c) => {
  const body = c.req.valid('json');
  const awaitJob = body?.await ?? false;
  const log = logger().child({ component: 'admin-trigger' });
  log.info({ await: awaitJob }, 'admin-triggered ingest requested');

  if (awaitJob) {
    await runDailyUpdate(db(), 'manual');
    return c.json(
      { job_type: 'manual', started: true, message: 'Ingest completed.' },
      202,
    );
  }

  // Fire-and-forget; errors land in ingest_runs and logs.
  void runDailyUpdate(db(), 'manual').catch((err) => {
    log.error({ err: err instanceof Error ? err.message : err }, 'background ingest failed');
  });
  return c.json(
    { job_type: 'manual', started: true, message: 'Ingest started in background.' },
    202,
  );
});
