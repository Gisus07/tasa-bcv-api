import type { MiddlewareHandler } from 'hono';
import { db } from '../db/client.js';
import type { ApiKey } from '../db/schema.js';
import { UnauthorizedError } from '../lib/errors.js';
import { logger } from '../logger.js';
import {
  bumpUsage,
  findActiveByPlainKey,
  KEY_PREFIX,
} from '../services/apiKeys.service.js';

declare module 'hono' {
  interface ContextVariableMap {
    apiKey: ApiKey | null;
  }
}

/**
 * Optional API key resolver.
 *
 * Reads `Authorization: Bearer <key>` (preferred) or `X-API-Key: <key>`,
 * looks the key up in the DB, attaches the matching record to `c.var.apiKey`,
 * and asynchronously bumps last_used_at + request_count.
 *
 * If no key header is present, `c.var.apiKey` is set to `null` and the
 * request continues anonymously — downstream middleware (rateLimit) treats
 * authenticated vs anonymous traffic differently.
 *
 * If a key header is present but the key is invalid or revoked, the request
 * is rejected with 401. This prevents silent demotion to anonymous tier when
 * a key was just revoked.
 */
export function apiKeyResolver(): MiddlewareHandler {
  return async (c, next) => {
    const presented = extractKey(
      c.req.header('authorization'),
      c.req.header('x-api-key'),
    );
    if (!presented) {
      c.set('apiKey', null);
      return next();
    }

    // If the token doesn't look like one of our keys, leave it for other
    // auth middleware to handle (e.g. adminAuth on /v1/admin/*). This keeps
    // the resolver from rejecting valid admin tokens just because they're
    // sent on the same Authorization header.
    if (!presented.startsWith(KEY_PREFIX)) {
      c.set('apiKey', null);
      return next();
    }

    const record = await findActiveByPlainKey(db(), presented);
    if (!record) {
      throw new UnauthorizedError('API key inválida o revocada');
    }

    c.set('apiKey', record);
    // Don't await — usage tracking shouldn't block the response.
    void bumpUsage(db(), record.id).catch((err) => {
      logger().warn(
        { err: err instanceof Error ? err.message : err, keyId: record.id },
        'failed to bump api_key usage counter',
      );
    });
    return next();
  };
}

function extractKey(
  authorizationHeader: string | undefined,
  xApiKeyHeader: string | undefined,
): string | undefined {
  if (authorizationHeader) {
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1]?.trim();
  }
  if (xApiKeyHeader) return xApiKeyHeader.trim();
  return undefined;
}
