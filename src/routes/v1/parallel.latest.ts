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
  summary: 'Última tasa paralela (Binance P2P, USDT/VES)',
  description:
    'Tasa paralela actual ("dólar Binance", USDT/VES), mediana del top-10 de ofertas P2P, capturada cada hora. `buy` = Bs para comprar 1 USDT, `sell` = al vender, `average` = referencia.',
  ...({ 'x-codeSamples': codeSamplesFor({ path: '/v1/parallel/latest' }) } as Record<string, unknown>),
  responses: {
    200: {
      description: 'Último snapshot de la tasa paralela',
      content: { 'application/json': { schema: ParallelLatest } },
    },
    404: {
      description: 'Aún no hay snapshots disponibles',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const parallelLatest = new OpenAPIHono({ defaultHook: defaultZodHook });
parallelLatest.openapi(route, async (c) => c.json(await getParallelLatest(db()), 200));
