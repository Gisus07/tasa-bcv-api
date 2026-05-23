import { createHash, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';
import { UnauthorizedError } from '../lib/errors.js';

/**
 * Bearer-token auth for admin endpoints.
 * Requires `ADMIN_TOKEN` env var to be set; otherwise the endpoint is closed.
 */
export function adminAuth(): MiddlewareHandler {
  return async (c, next) => {
    const expected = env().ADMIN_TOKEN;
    if (!expected) {
      throw new UnauthorizedError('Admin endpoints are disabled (ADMIN_TOKEN not configured)');
    }
    const header = c.req.header('authorization');
    const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      throw new UnauthorizedError('Missing Authorization header');
    }
    if (!constantTimeEquals(token, expected)) {
      throw new UnauthorizedError('Invalid admin token');
    }
    await next();
  };
}

/**
 * Constant-time comparison that doesn't leak length. Both inputs are hashed to
 * fixed-size 32-byte digests, so timingSafeEqual never sees mismatched lengths
 * and an attacker can't probe the token length via timing (SEC-5).
 */
function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
