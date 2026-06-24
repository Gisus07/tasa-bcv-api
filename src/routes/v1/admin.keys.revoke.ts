import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { NotFoundError } from '../../lib/errors.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import { AdminKeyIdParam, RevokeKeyResponse } from '../../schemas/rates.js';
import { revokeKey } from '../../services/apiKeys.service.js';

const route = createRoute({
  method: 'post',
  path: '/admin/keys/{id}/revoke',
  tags: ['admin'],
  summary: 'Revocar una API key por ID',
  description:
    'Soft-delete: marca la key como revocada (`revoked_at = now()`). La key revocada deja de autenticar de inmediato — siguientes requests con ella devuelven 401. Operación idempotente: revocar una key ya revocada responde 404 NOT_FOUND.',
  security: [{ bearerAuth: [] }],
  ...({
    'x-codeSamples': codeSamplesFor({
      path: '/v1/admin/keys/1/revoke',
      method: 'POST',
      bearer: true,
    }),
  } as Record<string, unknown>),
  request: { params: AdminKeyIdParam },
  responses: {
    200: {
      description: 'Key revocada',
      content: {
        'application/json': {
          schema: RevokeKeyResponse,
          example: {
            revoked: true,
            id: 1,
            message:
              'API key 1 revocada. Futuras requests con esta key devolverán 401.',
          },
        },
      },
    },
    401: {
      description: 'Token admin faltante o inválido',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Key no encontrada o ya estaba revocada',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const adminKeysRevoke = new OpenAPIHono({ defaultHook: defaultZodHook });
adminKeysRevoke.use('/admin/*', adminAuth());
adminKeysRevoke.openapi(route, async (c) => {
  const { id } = c.req.valid('param');
  const ok = await revokeKey(db(), id);
  if (!ok) {
    throw new NotFoundError(`API key ${id} no encontrada o ya estaba revocada`);
  }
  return c.json(
    {
      revoked: true,
      id,
      message: `API key ${id} revocada. Futuras requests con esta key devolverán 401.`,
    },
    200,
  );
});
