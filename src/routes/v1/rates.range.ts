import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { RangeQuery, RangeResponse } from '../../schemas/rates.js';
import { getRange } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/range',
  tags: ['rates'],
  summary: 'Historical rates within a date range (max 365 days)',
  description:
    'Returns every available row within `[from, to]`, optionally filtered by currency. Propagated days are included with `is_propagated: true`.',
  request: { query: RangeQuery },
  responses: {
    200: {
      description: 'Rates in the requested window',
      content: { 'application/json': { schema: RangeResponse } },
    },
    400: {
      description: 'Invalid range, range too large, or date out of bounds',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesRange = new OpenAPIHono({ defaultHook: defaultZodHook });
ratesRange.openapi(route, async (c) => {
  const { from, to, currency } = c.req.valid('query');
  const data = await getRange(db(), from, to, currency);
  return c.json(data, 200);
});
