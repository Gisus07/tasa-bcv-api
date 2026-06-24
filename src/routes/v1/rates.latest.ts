import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { ErrorResponse } from '../../schemas/common.js';
import { RatesPair } from '../../schemas/rates.js';
import { getLatestPair } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/latest',
  tags: ['rates'],
  summary: 'Últimas tasas USD y EUR',
  description:
    'Devuelve la tasa publicada más reciente para USD y EUR. Cada moneda puede tener su propia fecha si una se actualizó después que la otra.',
  ...({
    'x-codeSamples': codeSamplesFor({ path: '/v1/rates/latest' }),
  } as Record<string, unknown>),
  responses: {
    200: {
      description: 'Últimas tasas USD y EUR',
      content: {
        'application/json': {
          schema: RatesPair,
          example: {
            date: '2026-05-19',
            usd: 510.7873,
            eur: 602.18768455,
            propagated_currencies: ['USD'],
          },
        },
      },
    },
    404: {
      description: 'Aún no hay tasas disponibles (ejecutar backfill o daily)',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesLatest = new OpenAPIHono({ defaultHook: defaultZodHook });
ratesLatest.openapi(route, async (c) => {
  const data = await getLatestPair(db());
  return c.json(data, 200);
});
