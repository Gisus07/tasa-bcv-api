import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import {
  ParallelDailyResponse,
  ParallelRangeQuery,
} from '../../schemas/parallel.js';
import { getParallelDailyRange } from '../../services/parallel.service.js';

const route = createRoute({
  method: 'get',
  path: '/parallel/daily',
  tags: ['parallel'],
  summary: 'Agregación diaria (OHLC) de la tasa paralela',
  description:
    'Velas diarias (open/high/low/close + promedio) de la tasa paralela, agregadas por día del calendario de Caracas. Ideal para gráficas largas. Máximo 365 días por request.',
  ...({
    'x-codeSamples': codeSamplesFor({
      path: '/v1/parallel/daily?from=2026-04-01&to=2026-05-23',
    }),
  } as Record<string, unknown>),
  request: { query: ParallelRangeQuery },
  responses: {
    200: {
      description: 'Velas diarias en el rango',
      content: { 'application/json': { schema: ParallelDailyResponse } },
    },
    400: {
      description: 'Rango inválido o mayor a 365 días',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const parallelDaily = new OpenAPIHono({ defaultHook: defaultZodHook });
parallelDaily.openapi(route, async (c) => {
  const { from, to } = c.req.valid('query');
  return c.json(await getParallelDailyRange(db(), from, to), 200);
});
