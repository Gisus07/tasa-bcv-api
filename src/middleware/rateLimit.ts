import { rateLimiter } from 'hono-rate-limiter';
import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';

const FREE_TIER_MULTIPLIER = 10;

/**
 * Per-tier rate limiting.
 *
 * - Anonymous (no API key): `RATE_LIMIT_PER_MIN` requests/minute, bucketed
 *   by client IP. Default is 30.
 * - Free tier (registered API key): the same limit × `FREE_TIER_MULTIPLIER`,
 *   bucketed by the key's database ID. Default is 300/min.
 *
 * Buckets are independent: an authenticated client never competes with
 * anonymous traffic from the same IP.
 *
 * IP resolution order (Railway puts the real IP in X-Forwarded-For):
 * 1. X-Forwarded-For (first hop)
 * 2. X-Real-IP
 * 3. CF-Connecting-IP (in case we sit behind Cloudflare later)
 * 4. 'anonymous' (one shared bucket, defensive default)
 */
export function ipRateLimit(): MiddlewareHandler {
  const baseLimit = env().RATE_LIMIT_PER_MIN;

  return rateLimiter({
    windowMs: 60_000,
    standardHeaders: 'draft-6',
    limit: (c) => (c.var.apiKey ? baseLimit * FREE_TIER_MULTIPLIER : baseLimit),
    keyGenerator: (c) => {
      if (c.var.apiKey) return `key:${c.var.apiKey.id}`;
      const xff = c.req.header('x-forwarded-for');
      if (xff) return `ip:${xff.split(',')[0]!.trim()}`;
      const real = c.req.header('x-real-ip');
      if (real) return `ip:${real}`;
      const cf = c.req.header('cf-connecting-ip');
      if (cf) return `ip:${cf}`;
      return 'ip:anonymous';
    },
    message: {
      error: 'Demasiadas solicitudes. Por favor reduce el ritmo.',
      code: 'RATE_LIMITED',
    },
  });
}
