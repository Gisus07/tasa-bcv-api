import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { runBackfill } from '../../jobs/backfill.js';
import { logger } from '../../logger.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { ErrorResponse } from '../../schemas/common.js';
import { TriggerIngestResponse } from '../../schemas/rates.js';

const route = createRoute({
  method: 'post',
  path: '/admin/reingest',
  tags: ['admin'],
  summary: 'Re-ingesta total del histórico (corrige datos mal cargados)',
  description:
    'Endpoint protegido con bearer token que re-ejecuta el backfill completo: re-lee los XLS de USD y EUR del BCV y re-propaga los huecos. Idempotente (sobrescribe solo lo que cambió) y con lock de 30 min. Úsalo para corregir fechas que entraron mal en una carga previa (p. ej. un XLS publicado con lag). Con await=false (default) responde 202 y corre en background; con await=true espera a que termine y responde 200.',
  ...({
    'x-codeSamples': codeSamplesFor({
      path: '/v1/admin/reingest',
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
                description:
                  'Cuando es true, espera a que la re-ingesta termine antes de responder.',
              }),
            })
            .openapi('ReingestRequest'),
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: 'Re-ingesta completada (cuando await=true)',
      content: { 'application/json': { schema: TriggerIngestResponse } },
    },
    202: {
      description: 'Re-ingesta iniciada en background (cuando await=false)',
      content: { 'application/json': { schema: TriggerIngestResponse } },
    },
    401: {
      description: 'Token admin faltante o inválido',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const adminReingest = new OpenAPIHono({ defaultHook: defaultZodHook });
adminReingest.use('/admin/*', adminAuth());
adminReingest.openapi(route, async (c) => {
  const body = c.req.valid('json');
  const awaitJob = body?.await ?? false;
  const log = logger().child({ component: 'admin-reingest' });
  log.info(
    { await: awaitJob },
    'admin-triggered reingest (backfill) requested',
  );

  if (awaitJob) {
    await runBackfill(db());
    return c.json(
      { job_type: 'backfill', started: true, message: 'Reingest completed.' },
      200,
    );
  }

  // Fire-and-forget; the backfill logs its own progress and respects the lock.
  void runBackfill(db()).catch((err) => {
    log.error(
      { err: err instanceof Error ? err.message : err },
      'background reingest failed',
    );
  });
  return c.json(
    {
      job_type: 'backfill',
      started: true,
      message: 'Reingest started in background.',
    },
    202,
  );
});
