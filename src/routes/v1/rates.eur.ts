import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { RateRecord, SingleCurrencyQuery } from '../../schemas/rates.js';
import { getSingleCurrency } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/eur',
  tags: ['rates'],
  summary: 'EUR rate (latest by default, or for a given date)',
  request: { query: SingleCurrencyQuery },
  responses: {
    200: {
      description: 'EUR rate',
      content: { 'application/json': { schema: RateRecord } },
    },
    400: {
      description: 'Date out of range or before history',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'No EUR rate found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesEur = new OpenAPIHono();
ratesEur.openapi(route, async (c) => {
  const { date } = c.req.valid('query');
  const data = await getSingleCurrency(db(), 'EUR', date);
  return c.json(data, 200);
});
