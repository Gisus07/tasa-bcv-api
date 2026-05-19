import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import { AdminKeyList } from '../../schemas/rates.js';
import { listKeys } from '../../services/apiKeys.service.js';

const route = createRoute({
  method: 'get',
  path: '/admin/keys',
  tags: ['admin'],
  summary: 'Listar todas las API keys (activas y revocadas)',
  description:
    'Devuelve metadata de todas las keys ordenadas por fecha de creación descendente. Limitado a 100 por respuesta. No incluye la key en texto plano — solo el prefijo visible y el resto de campos.',
  security: [{ bearerAuth: [] }],
  ...({
    'x-codeSamples': codeSamplesFor({ path: '/v1/admin/keys', bearer: true }),
  } as Record<string, unknown>),
  responses: {
    200: {
      description: 'Listado de keys',
      content: {
        'application/json': {
          schema: AdminKeyList,
          example: {
            count: 2,
            keys: [
              {
                id: 2,
                key_prefix: 'tbk_b3c4d5e6',
                name: 'Acme Calculator',
                email: 'dev@acme.com',
                purpose: 'Conversión de remesas',
                tier: 'free',
                created_at: '2026-05-19T22:30:00.000Z',
                last_used_at: '2026-05-19T22:45:12.123Z',
                request_count: 87,
                revoked_at: null,
              },
              {
                id: 1,
                key_prefix: 'tbk_a1b2c3d4',
                name: 'Test',
                email: 'test@example.com',
                purpose: null,
                tier: 'free',
                created_at: '2026-05-18T10:00:00.000Z',
                last_used_at: '2026-05-18T11:00:00.000Z',
                request_count: 12,
                revoked_at: '2026-05-19T20:00:00.000Z',
              },
            ],
          },
        },
      },
    },
    401: {
      description: 'Token admin faltante o inválido',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const adminKeysList = new OpenAPIHono({ defaultHook: defaultZodHook });
adminKeysList.use('/admin/*', adminAuth());
adminKeysList.openapi(route, async (c) => {
  const records = await listKeys(db(), 100);
  return c.json(
    {
      count: records.length,
      keys: records.map((k) => ({
        id: k.id,
        key_prefix: k.keyPrefix,
        name: k.name,
        email: k.email,
        purpose: k.purpose,
        tier: k.tier,
        created_at: k.createdAt.toISOString(),
        last_used_at: k.lastUsedAt?.toISOString() ?? null,
        request_count: k.requestCount,
        revoked_at: k.revokedAt?.toISOString() ?? null,
      })),
    },
    200,
  );
});
