import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { ByDateParams, RatesPair } from '../../schemas/rates.js';
import { getPairByDate } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/{date}',
  tags: ['rates'],
  summary: 'Tasas USD y EUR para una fecha específica',
  description:
    'Devuelve ambas monedas para la fecha indicada. Fines de semana y feriados se devuelven con `propagated_currencies` indicando qué monedas se heredaron del último día hábil.',
  request: { params: ByDateParams },
  responses: {
    200: {
      description: 'Tasas para la fecha solicitada',
      content: { 'application/json': { schema: RatesPair } },
    },
    400: {
      description: 'Fecha fuera de rango o anterior al histórico disponible',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'No hay tasas para esa fecha (datos aún no ingresados)',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesByDate = new OpenAPIHono({ defaultHook: defaultZodHook });
ratesByDate.openapi(route, async (c) => {
  const { date } = c.req.valid('param');
  const data = await getPairByDate(db(), date);
  return c.json(data, 200);
});
