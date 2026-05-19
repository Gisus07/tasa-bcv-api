import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { LastUpdatedResponse } from '../../schemas/rates.js';
import { getLastUpdated } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/last-updated',
  tags: ['system'],
  summary: 'Timestamp of the last successful ingest',
  description:
    'Useful for monitoring. If this stops advancing for >36h, the daily job has likely broken.',
  responses: {
    200: {
      description: 'Last successful run details',
      content: { 'application/json': { schema: LastUpdatedResponse } },
    },
  },
});

export const lastUpdated = new OpenAPIHono({ defaultHook: defaultZodHook });
lastUpdated.openapi(route, async (c) => {
  const data = await getLastUpdated(db());
  return c.json(data, 200);
});
