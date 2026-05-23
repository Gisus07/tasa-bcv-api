import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import { ParallelLatest } from '../../schemas/parallel.js';
import { getParallelLatest } from '../../services/parallel.service.js';

const route = createRoute({
  method: 'get',
  path: '/parallel/latest',
  tags: ['parallel'],
  summary: 'Tasa paralela en vivo (Binance P2P, USDT/VES)',
  description:
    'Tasa paralela actual ("dólar Binance", USDT/VES) consultada en vivo desde Binance P2P (cache de 30s). Mediana del top-10 de ofertas. `buy` = Bs para comprar 1 USDT, `sell` = al vender, `average` = referencia. Si Binance no responde, devuelve el último snapshot horario almacenado.',
  ...({ 'x-codeSamples': codeSamplesFor({ path: '/v1/parallel/latest' }) } as Record<string, unknown>),
  responses: {
    200: {
      description: 'Tasa paralela actual',
      content: { 'application/json': { schema: ParallelLatest } },
    },
    404: {
      description: 'Sin datos (Binance no responde y no hay snapshots aún)',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const parallelLatest = new OpenAPIHono({ defaultHook: defaultZodHook });
parallelLatest.openapi(route, async (c) => {
  c.header('Cache-Control', 'public, max-age=30');
  return c.json(await getParallelLatest(db()), 200);
});
