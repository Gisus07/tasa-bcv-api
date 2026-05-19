import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { LastUpdatedResponse } from '../../schemas/rates.js';
import { getLastUpdated } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/last-updated',
  tags: ['system'],
  summary: 'Timestamp de la última ingesta exitosa',
  description:
    'Útil para monitoreo. Si este valor no avanza durante >36h, el job diario probablemente está fallando.',
  responses: {
    200: {
      description: 'Detalles del último run exitoso',
      content: {
        'application/json': {
          schema: LastUpdatedResponse,
          example: {
            last_successful_run_at: '2026-05-19T04:00:00.000Z',
            last_successful_job_type: 'daily',
            rows_upserted: 12,
          },
        },
      },
    },
  },
});

export const lastUpdated = new OpenAPIHono({ defaultHook: defaultZodHook });
lastUpdated.openapi(route, async (c) => {
  const data = await getLastUpdated(db());
  return c.json(data, 200);
});
