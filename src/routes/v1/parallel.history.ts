import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import {
  ParallelHistoryResponse,
  ParallelRangeQuery,
} from '../../schemas/parallel.js';
import { getParallelHistoryRange } from '../../services/parallel.service.js';

const route = createRoute({
  method: 'get',
  path: '/parallel/history',
  tags: ['parallel'],
  summary: 'Histórico horario de la tasa paralela',
  description:
    'Snapshots horarios de la tasa paralela (Binance P2P) en un rango de fechas (YYYY-MM-DD). Máximo 31 días por request; para rangos mayores usa /v1/parallel/daily.',
  ...({
    'x-codeSamples': codeSamplesFor({
      path: '/v1/parallel/history?from=2026-05-22&to=2026-05-23',
    }),
  } as Record<string, unknown>),
  request: { query: ParallelRangeQuery },
  responses: {
    200: {
      description: 'Snapshots horarios en el rango',
      content: { 'application/json': { schema: ParallelHistoryResponse } },
    },
    400: {
      description: 'Rango inválido o mayor a 31 días',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const parallelHistory = new OpenAPIHono({ defaultHook: defaultZodHook });
parallelHistory.openapi(route, async (c) => {
  const { from, to } = c.req.valid('query');
  return c.json(await getParallelHistoryRange(db(), from, to), 200);
});
