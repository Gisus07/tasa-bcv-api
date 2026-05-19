import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { ByDateParams, RatesPair } from '../../schemas/rates.js';
import { getPairByDate } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/{date}',
  tags: ['rates'],
  summary: 'USD and EUR rates for a specific date',
  description:
    'Returns both currencies for the given date. Weekends and holidays return propagated rows (`is_propagated: true`) inherited from the previous business day.',
  request: { params: ByDateParams },
  responses: {
    200: {
      description: 'Rates for the requested date',
      content: { 'application/json': { schema: RatesPair } },
    },
    400: {
      description: 'Date out of range or before history',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'No rates for that date (data not ingested yet)',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesByDate = new OpenAPIHono();
ratesByDate.openapi(route, async (c) => {
  const { date } = c.req.valid('param');
  const data = await getPairByDate(db(), date);
  return c.json(data, 200);
});
