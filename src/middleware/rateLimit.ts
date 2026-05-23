import { rateLimiter } from 'hono-rate-limiter';
import type { Context, MiddlewareHandler } from 'hono';
import { env } from '../env.js';

const FREE_TIER_MULTIPLIER = 10;

/** Registrations allowed per IP per hour — anti-spam for the open signup. */
const REGISTER_LIMIT_PER_HOUR = 5;

/**
 * Resolves the real client IP from forwarding headers.
 *
 * `X-Forwarded-For` is a chain `client, proxy1, proxy2, ...` where the LEFT is
 * attacker-controlled and each proxy appends on the RIGHT. Only the hops we
 * actually run are trustworthy, so we count `TRUSTED_PROXY_HOPS` from the right
 * and take that entry. With Railway's edge in front (1 hop) this is the last
 * value — the IP Railway saw — not whatever the client put first. The previous
 * code took `[0]`, letting any client spoof its bucket with a fake header (SEC-2).
 *
 * NOTE: assumes the platform appends the downstream socket IP. Verify against
 * the host (Railway today) and bump TRUSTED_PROXY_HOPS if the topology grows
 * (e.g. Cloudflare in front → 2 hops).
 */
export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const hops = Math.max(1, env().TRUSTED_PROXY_HOPS);
      const idx = Math.max(0, parts.length - hops);
      return parts[idx] ?? parts[parts.length - 1]!;
    }
  }
  const real = c.req.header('x-real-ip');
  if (real) return real.trim();
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf.trim();
  return 'anonymous';
}

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
 */
export function ipRateLimit(): MiddlewareHandler {
  const baseLimit = env().RATE_LIMIT_PER_MIN;

  return rateLimiter({
    windowMs: 60_000,
    standardHeaders: 'draft-6',
    limit: (c) => (c.var.apiKey ? baseLimit * FREE_TIER_MULTIPLIER : baseLimit),
    keyGenerator: (c) => (c.var.apiKey ? `key:${c.var.apiKey.id}` : `ip:${clientIp(c)}`),
    message: {
      error: 'Demasiadas solicitudes. Por favor reduce el ritmo.',
      code: 'RATE_LIMITED',
    },
  });
}

/**
 * Stricter limiter for the public signup endpoint (SEC-1). Key registration is
 * the only unauthenticated write, so cap it hard per IP to curb spam of keys
 * and junk emails. Bucket is independent from the per-minute API limit.
 */
export function registerRateLimit(): MiddlewareHandler {
  return rateLimiter({
    windowMs: 60 * 60_000,
    limit: REGISTER_LIMIT_PER_HOUR,
    standardHeaders: 'draft-6',
    keyGenerator: (c) => `register:${clientIp(c)}`,
    message: {
      error: 'Demasiados registros desde esta IP. Intenta de nuevo más tarde.',
      code: 'RATE_LIMITED',
    },
  });
}
