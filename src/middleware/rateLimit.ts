import { rateLimiter } from 'hono-rate-limiter';
import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';

/**
 * IP-based rate limit for the public API.
 *
 * Trust order for client identity (Railway puts the real IP in X-Forwarded-For):
 * 1. X-Forwarded-For (first hop)
 * 2. X-Real-IP
 * 3. CF-Connecting-IP (if behind Cloudflare in the future)
 * 4. Falls back to 'anonymous' (same bucket for all unknowns)
 */
export function ipRateLimit(): MiddlewareHandler {
  return rateLimiter({
    windowMs: 60_000,
    limit: env().RATE_LIMIT_PER_MIN,
    standardHeaders: 'draft-6',
    keyGenerator: (c) => {
      const xff = c.req.header('x-forwarded-for');
      if (xff) return xff.split(',')[0]!.trim();
      const real = c.req.header('x-real-ip');
      if (real) return real;
      const cf = c.req.header('cf-connecting-ip');
      if (cf) return cf;
      return 'anonymous';
    },
    message: {
      error: 'Too many requests. Please slow down.',
      code: 'RATE_LIMITED',
    },
  });
}
