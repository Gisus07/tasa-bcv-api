import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { SingleCurrencyQuery, SingleRate } from '../../schemas/rates.js';
import { getSingleCurrency } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/eur',
  tags: ['rates'],
  summary: 'Tasa EUR (la más reciente por defecto, o para una fecha dada)',
  request: { query: SingleCurrencyQuery },
  responses: {
    200: {
      description: 'Tasa EUR',
      content: { 'application/json': { schema: SingleRate } },
    },
    400: {
      description: 'Fecha fuera de rango o anterior al histórico disponible',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'No se encontró tasa EUR',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesEur = new OpenAPIHono({ defaultHook: defaultZodHook });
ratesEur.openapi(route, async (c) => {
  const { date } = c.req.valid('query');
  const data = await getSingleCurrency(db(), 'EUR', date);
  return c.json(data, 200);
});
