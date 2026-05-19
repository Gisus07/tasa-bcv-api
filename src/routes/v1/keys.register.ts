import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import { RegisterKeyRequest, RegisterKeyResponse } from '../../schemas/rates.js';
import { createKey } from '../../services/apiKeys.service.js';

const FREE_TIER_LIMIT = 300;

const route = createRoute({
  method: 'post',
  path: '/keys/register',
  tags: ['keys'],
  summary: 'Crear una API key del tier Free (gratis)',
  description:
    'Auto-registro público. Devuelve la API key en texto plano UNA SOLA VEZ. ' +
    'Guárdala — no la podemos mostrar de nuevo, solo el prefijo visible. ' +
    'La key da derecho a 300 req/min (vs 30 req/min sin key). ' +
    'Sin verificación de email por ahora — si abusan, se revoca.',
  ...({
    'x-codeSamples': codeSamplesFor({
      path: '/v1/keys/register',
      method: 'POST',
      body: { email: 'dev@example.com', name: 'Ana Pérez', purpose: 'Mi proyecto' },
    }),
  } as Record<string, unknown>),
  request: {
    body: {
      content: { 'application/json': { schema: RegisterKeyRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'API key creada. Guarda `key` ahora mismo — solo se muestra una vez.',
      content: {
        'application/json': {
          schema: RegisterKeyResponse,
          example: {
            key: 'tbk_a1b2c3d4e5f6789012345678abcdef1234567890abcdef12',
            key_prefix: 'tbk_a1b2c3d4',
            tier: 'free',
            rate_limit_per_minute: 300,
            created_at: '2026-05-19T18:30:00.000Z',
            usage: {
              tip: 'Envía el header `Authorization: Bearer <tu_key>` en cada request.',
            },
          },
        },
      },
    },
    400: {
      description: 'Entrada inválida (email mal formado, campos faltantes, etc.)',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const keysRegister = new OpenAPIHono({ defaultHook: defaultZodHook });
keysRegister.openapi(route, async (c) => {
  const body = c.req.valid('json');
  const { key, record } = await createKey(db(), body);

  return c.json(
    {
      key,
      key_prefix: record.keyPrefix,
      tier: record.tier,
      rate_limit_per_minute: FREE_TIER_LIMIT,
      created_at: record.createdAt.toISOString(),
      usage: {
        tip: 'Envía el header `Authorization: Bearer <tu_key>` en cada request.',
      },
    },
    201,
  );
});
