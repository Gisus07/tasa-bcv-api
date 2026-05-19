import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { RatesPair } from '../../schemas/rates.js';
import { getLatestPair } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/latest',
  tags: ['rates'],
  summary: 'Most recent USD and EUR rates',
  description:
    'Returns the most recent published rate for USD and EUR. Each currency may have its own date if one was updated more recently.',
  responses: {
    200: {
      description: 'Latest USD and EUR rates',
      content: { 'application/json': { schema: RatesPair } },
    },
    404: {
      description: 'No rates available yet (run backfill or daily)',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesLatest = new OpenAPIHono();
ratesLatest.openapi(route, async (c) => {
  const data = await getLatestPair(db());
  return c.json(data, 200);
});
