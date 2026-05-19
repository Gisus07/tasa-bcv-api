import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
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
  ...({
    'x-codeSamples': codeSamplesFor({
      path: '/v1/rates/range?from=2026-05-01&to=2026-05-19&currency=USD',
    }),
  } as Record<string, unknown>),
  request: { query: RangeQuery },
  responses: {
    200: {
      description: 'Tasas dentro del rango solicitado',
      content: {
        'application/json': {
          schema: RangeResponse,
          example: {
            from: '2026-05-14',
            to: '2026-05-17',
            count: 4,
            rates: [
              { date: '2026-05-14', currency: 'USD', rate: 510.7873 },
              {
                date: '2026-05-15',
                currency: 'USD',
                rate: 510.7873,
                is_propagated: true,
                propagated_from: '2026-05-14',
              },
              {
                date: '2026-05-16',
                currency: 'USD',
                rate: 510.7873,
                is_propagated: true,
                propagated_from: '2026-05-14',
              },
              {
                date: '2026-05-17',
                currency: 'USD',
                rate: 510.7873,
                is_propagated: true,
                propagated_from: '2026-05-14',
              },
            ],
          },
        },
      },
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
