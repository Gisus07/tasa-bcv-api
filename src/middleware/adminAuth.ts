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

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
