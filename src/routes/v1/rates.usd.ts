import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { SingleCurrencyQuery, SingleRate } from '../../schemas/rates.js';
import { getSingleCurrency } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/usd',
  tags: ['rates'],
  summary: 'USD rate (latest by default, or for a given date)',
  request: { query: SingleCurrencyQuery },
  responses: {
    200: {
      description: 'USD rate',
      content: { 'application/json': { schema: SingleRate } },
    },
    400: {
      description: 'Date out of range or before history',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'No USD rate found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesUsd = new OpenAPIHono();
ratesUsd.openapi(route, async (c) => {
  const { date } = c.req.valid('query');
  const data = await getSingleCurrency(db(), 'USD', date);
  return c.json(data, 200);
});
