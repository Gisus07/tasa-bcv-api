import { randomBytes, createHash } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { apiKeys, type ApiKey } from '../db/schema.js';

/** All issued keys start with this prefix so they're identifiable in logs / leaks. */
export const KEY_PREFIX = 'tbk_';

/** Bytes of randomness in the key body (after the prefix). 24 bytes → 48 hex chars → ~192 bits. */
const KEY_RANDOM_BYTES = 24;

/** Length kept in plaintext on the `key_prefix` column. Enough to recognize, not enough to use. */
const VISIBLE_PREFIX_LEN = 12;

export interface CreatedKey {
  /** The full plaintext key. Show it to the user ONCE; we don't store it. */
  key: string;
  record: ApiKey;
}

export interface CreateKeyInput {
  email: string;
  name: string;
  purpose?: string;
}

export function generatePlainKey(): string {
  return KEY_PREFIX + randomBytes(KEY_RANDOM_BYTES).toString('hex');
}

export function hashKey(plainKey: string): string {
  return createHash('sha256').update(plainKey).digest('hex');
}

export function visiblePrefix(plainKey: string): string {
  return plainKey.slice(0, VISIBLE_PREFIX_LEN);
}

/** Creates a new active key. Returns both the plaintext (one-time) and the DB record. */
export async function createKey(d: Database, input: CreateKeyInput): Promise<CreatedKey> {
  const plain = generatePlainKey();
  const rows = await d
    .insert(apiKeys)
    .values({
      keyHash: hashKey(plain),
      keyPrefix: visiblePrefix(plain),
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      purpose: input.purpose?.trim() ?? null,
      tier: 'free',
    })
    .returning();
  const record = rows[0]!;
  return { key: plain, record };
}

/** Returns the active (non-revoked) API key matching the supplied plaintext, or undefined. */
export async function findActiveByPlainKey(
  d: Database,
  plainKey: string,
): Promise<ApiKey | undefined> {
  if (!plainKey.startsWith(KEY_PREFIX)) return undefined;
  const rows = await d
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashKey(plainKey)), isNull(apiKeys.revokedAt)))
    .limit(1);
  return rows[0];
}

/**
 * Bumps last_used_at and request_count in a single statement.
 *
 * Fire-and-forget from the request handler: we update on every successful
 * authenticated request, but it's an unawaited promise so the response isn't
 * blocked. PostgreSQL coalesces concurrent updates fine for this counter.
 */
export async function bumpUsage(d: Database, keyId: number): Promise<void> {
  await d
    .update(apiKeys)
    .set({
      lastUsedAt: sql`now()`,
      requestCount: sql`${apiKeys.requestCount} + 1`,
    })
    .where(eq(apiKeys.id, keyId));
}

/** Soft-delete: mark the key revoked. Future requests with it fail auth. */
export async function revokeKey(d: Database, id: number): Promise<boolean> {
  const result = await d
    .update(apiKeys)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return result.length > 0;
}

/** Admin listing — paginated for safety. */
export async function listKeys(d: Database, limit = 100): Promise<ApiKey[]> {
  return d.select().from(apiKeys).orderBy(sql`${apiKeys.createdAt} DESC`).limit(limit);
}
