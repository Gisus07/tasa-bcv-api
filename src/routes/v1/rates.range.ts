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
  summary: 'Tasas históricas dentro de un rango (máx 365 días)',
  description:
    'Devuelve cada registro disponible dentro de `[from, to]`, opcionalmente filtrado por moneda. Los días propagados se incluyen con `is_propagated: true`.',
  request: { query: RangeQuery },
  responses: {
    200: {
      description: 'Tasas dentro del rango solicitado',
      content: { 'application/json': { schema: RangeResponse } },
    },
    400: {
      description: 'Rango inválido, demasiado grande, o fecha fuera de límites',
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
