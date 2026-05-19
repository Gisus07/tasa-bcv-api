import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { ErrorResponse } from '../../schemas/common.js';
import { ApiKeyInfo } from '../../schemas/rates.js';

const route = createRoute({
  method: 'get',
  path: '/keys/me',
  tags: ['keys'],
  summary: 'Info de mi API key',
  description:
    'Devuelve metadata de la key que se está usando para autenticar la llamada: ' +
    'prefijo visible, nombre, email, tier, fecha de creación, última vez usada y request count.',
  security: [{ bearerAuth: [] }],
  ...({ 'x-codeSamples': codeSamplesFor({ path: '/v1/keys/me', bearer: true }) } as Record<string, unknown>),
  responses: {
    200: {
      description: 'Información de la API key',
      content: {
        'application/json': {
          schema: ApiKeyInfo,
          example: {
            key_prefix: 'tbk_a1b2c3d4',
            name: 'Ana Pérez',
            email: 'dev@example.com',
            purpose: 'Calculadora de remesas',
            tier: 'free',
            created_at: '2026-05-19T18:30:00.000Z',
            last_used_at: '2026-05-19T19:15:42.123Z',
            request_count: 142,
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

export const keysMe = new OpenAPIHono({ defaultHook: defaultZodHook });
keysMe.openapi(route, async (c) => {
  const apiKey = c.var.apiKey;
  if (!apiKey) {
    throw new UnauthorizedError('Esta ruta requiere una API key. Envíala en `Authorization: Bearer <key>`.');
  }
  return c.json(
    {
      key_prefix: apiKey.keyPrefix,
      name: apiKey.name,
      email: apiKey.email,
      purpose: apiKey.purpose,
      tier: apiKey.tier,
      created_at: apiKey.createdAt.toISOString(),
      last_used_at: apiKey.lastUsedAt?.toISOString() ?? null,
      request_count: apiKey.requestCount,
    },
    200,
  );
});
