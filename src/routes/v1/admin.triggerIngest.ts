import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { runDailyUpdate } from '../../jobs/dailyUpdate.js';
import { logger } from '../../logger.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { ErrorResponse } from '../../schemas/common.js';
import { TriggerIngestResponse } from '../../schemas/rates.js';

const route = createRoute({
  method: 'post',
  path: '/admin/trigger-ingest',
  tags: ['admin'],
  summary: 'Manually trigger a daily ingest',
  description:
    'Bearer-authenticated endpoint that forces a daily-update run without waiting for the cron. Useful when the scheduled run failed or to refresh after a deploy. Returns 202 because the job runs in background.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              await: z.boolean().optional().default(false).openapi({
                description: 'When true, wait for the ingest to finish before responding.',
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
      description: 'Job started (or finished, if `await=true`)',
      content: { 'application/json': { schema: TriggerIngestResponse } },
    },
    401: {
      description: 'Missing or invalid admin token',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const adminTriggerIngest = new OpenAPIHono({ defaultHook: defaultZodHook });
adminTriggerIngest.use('/admin/*', adminAuth());
adminTriggerIngest.openapi(route, async (c) => {
  let body: { await?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    // body is optional
  }
  const log = logger().child({ component: 'admin-trigger' });
  log.info({ await: body.await }, 'admin-triggered ingest requested');

  if (body.await) {
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
