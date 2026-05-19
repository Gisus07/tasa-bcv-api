import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { SingleCurrencyQuery, SingleRate } from '../../schemas/rates.js';
import { getSingleCurrency } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/usd',
  tags: ['rates'],
  summary: 'Tasa USD (la más reciente por defecto, o para una fecha dada)',
  request: { query: SingleCurrencyQuery },
  responses: {
    200: {
      description: 'Tasa USD',
      content: {
        'application/json': {
          schema: SingleRate,
          examples: {
            normal: {
              summary: 'Día con publicación',
              value: { date: '2026-05-14', currency: 'USD', rate: 510.7873 },
            },
            propagated: {
              summary: 'Día propagado (sábado)',
              value: {
                date: '2026-05-16',
                currency: 'USD',
                rate: 510.7873,
                is_propagated: true,
                propagated_from: '2026-05-14',
              },
            },
          },
        },
      },
    },
    400: {
      description: 'Fecha fuera de rango o anterior al histórico disponible',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'No se encontró tasa USD',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesUsd = new OpenAPIHono({ defaultHook: defaultZodHook });
ratesUsd.openapi(route, async (c) => {
  const { date } = c.req.valid('query');
  const data = await getSingleCurrency(db(), 'USD', date);
  return c.json(data, 200);
});
