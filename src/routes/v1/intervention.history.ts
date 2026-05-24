import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import {
  InterventionHistoryResponse,
  InterventionRangeQuery,
} from '../../schemas/intervention.js';
import { getInterventionHistoryRange } from '../../services/intervention.service.js';

const route = createRoute({
  method: 'get',
  path: '/intervention/history',
  tags: ['intervention'],
  summary: 'Histórico de intervenciones cambiarias',
  description:
    'Intervenciones cambiarias del BCV (tipo de cambio Bs./EUR) en un rango de fechas (YYYY-MM-DD). Máximo 366 días por request. Solo aparecen los días en que el BCV efectivamente intervino.',
  ...({
    'x-codeSamples': codeSamplesFor({
      path: '/v1/intervention/history?from=2026-05-01&to=2026-05-21',
    }),
  } as Record<string, unknown>),
  request: { query: InterventionRangeQuery },
  responses: {
    200: {
      description: 'Intervenciones en el rango',
      content: { 'application/json': { schema: InterventionHistoryResponse } },
    },
    400: {
      description: 'Rango inválido o mayor a 366 días',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const interventionHistory = new OpenAPIHono({ defaultHook: defaultZodHook });
interventionHistory.openapi(route, async (c) => {
  const { from, to } = c.req.valid('query');
  return c.json(await getInterventionHistoryRange(db(), from, to), 200);
});
