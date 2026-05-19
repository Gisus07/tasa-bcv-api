import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import { KeyUsageResponse, UsageQuery } from '../../schemas/rates.js';
import { getDailyUsage } from '../../services/apiKeys.service.js';

const route = createRoute({
  method: 'get',
  path: '/keys/me/usage',
  tags: ['keys'],
  summary: 'Histograma diario de uso de mi API key',
  description:
    'Devuelve el conteo de requests por día en la ventana solicitada (default 30 días). ' +
    'Los días sin requests no aparecen — el cliente debe asumir 0 para los faltantes si necesita una serie completa. ' +
    'Ideal para gráficas de uso semanales o mensuales.',
  security: [{ bearerAuth: [] }],
  ...({
    'x-codeSamples': codeSamplesFor({ path: '/v1/keys/me/usage?days=30', bearer: true }),
  } as Record<string, unknown>),
  request: { query: UsageQuery },
  responses: {
    200: {
      description: 'Histograma diario',
      content: {
        'application/json': {
          schema: KeyUsageResponse,
          example: {
            key_prefix: 'tbk_a1b2c3d4',
            days: 30,
            total_requests: 412,
            usage: [
              { date: '2026-05-19', count: 87 },
              { date: '2026-05-18', count: 64 },
              { date: '2026-05-15', count: 122 },
              { date: '2026-05-14', count: 139 },
            ],
          },
        },
      },
    },
    401: {
      description: 'Falta API key o es inválida',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const keysMeUsage = new OpenAPIHono({ defaultHook: defaultZodHook });
keysMeUsage.openapi(route, async (c) => {
  const apiKey = c.var.apiKey;
  if (!apiKey) {
    throw new UnauthorizedError(
      'Esta ruta requiere una API key. Envíala en `Authorization: Bearer <key>`.',
    );
  }
  const { days } = c.req.valid('query');
  const rows = await getDailyUsage(db(), apiKey.id, days);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return c.json(
    {
      key_prefix: apiKey.keyPrefix,
      days,
      total_requests: total,
      usage: rows.map((r) => ({ date: r.date, count: r.count })),
    },
    200,
  );
});
