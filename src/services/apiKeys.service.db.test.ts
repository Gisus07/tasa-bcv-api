import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  bumpUsage,
  createKey,
  findActiveByPlainKey,
  getDailyUsage,
  listKeys,
  revokeKey,
} from './apiKeys.service.js';
import {
  clearTables,
  startTestDb,
  stopTestDb,
  type TestDb,
} from '../__tests__/testcontainer.helper.js';

describe('apiKeys.service with real Postgres', () => {
  let env: TestDb;

  beforeAll(async () => {
    env = await startTestDb();
  }, 60_000);

  afterAll(async () => {
    await stopTestDb();
  }, 30_000);

  beforeEach(async () => {
    await clearTables(env.db);
  });

  describe('createKey', () => {
    it('persists the key and returns both plaintext and record', async () => {
      const { key, record } = await createKey(env.db, {
        email: 'Alice@Example.com',
        name: '  Alice Demo  ',
        purpose: '  Mi proyecto  ',
      });

      expect(key).toMatch(/^tbk_[0-9a-f]{48}$/);
      expect(record.id).toBeGreaterThan(0);
      expect(record.tier).toBe('free');
      // Email normalized and trimmed; name trimmed.
      expect(record.email).toBe('alice@example.com');
      expect(record.name).toBe('Alice Demo');
      expect(record.purpose).toBe('Mi proyecto');
      expect(record.keyPrefix).toBe(key.slice(0, 12));
      expect(record.keyPrefix.startsWith('tbk_')).toBe(true);
      expect(record.requestCount).toBe(0);
      expect(record.lastUsedAt).toBeNull();
      expect(record.revokedAt).toBeNull();
    });

    it('rejects malformed emails via the DB-level constraint', async () => {
      await expect(
        createKey(env.db, { email: 'not-an-email', name: 'Bad' }),
      ).rejects.toThrow();
    });
  });

  describe('findActiveByPlainKey', () => {
    it('finds an active key by its plaintext', async () => {
      const { key } = await createKey(env.db, { email: 'a@b.com', name: 'A' });
      const found = await findActiveByPlainKey(env.db, key);
      expect(found?.email).toBe('a@b.com');
    });

    it('returns undefined for an unknown plaintext', async () => {
      const found = await findActiveByPlainKey(
        env.db,
        'tbk_unknownunknownunknownunknownunknownunknownun',
      );
      expect(found).toBeUndefined();
    });

    it('returns undefined for a revoked key', async () => {
      const { key, record } = await createKey(env.db, {
        email: 'r@b.com',
        name: 'R',
      });
      await revokeKey(env.db, record.id);
      const found = await findActiveByPlainKey(env.db, key);
      expect(found).toBeUndefined();
    });

    it('returns undefined for tokens without the tbk_ prefix', async () => {
      const found = await findActiveByPlainKey(env.db, 'not-our-token-format');
      expect(found).toBeUndefined();
    });
  });

  describe('bumpUsage', () => {
    it('increments request_count and stamps last_used_at', async () => {
      const { record } = await createKey(env.db, {
        email: 'b@b.com',
        name: 'B',
      });
      await bumpUsage(env.db, record.id);
      await bumpUsage(env.db, record.id);
      await bumpUsage(env.db, record.id);

      // Re-fetch via listKeys to keep this test independent of internal queries.
      const all = await listKeys(env.db);
      const updated = all.find((k) => k.id === record.id)!;
      expect(updated.requestCount).toBe(3);
      expect(updated.lastUsedAt).not.toBeNull();
    });

    it('accumulates the daily histogram for today', async () => {
      const { record } = await createKey(env.db, {
        email: 'h@b.com',
        name: 'H',
      });
      for (let i = 0; i < 5; i++) {
        await bumpUsage(env.db, record.id);
      }
      const usage = await getDailyUsage(env.db, record.id, 7);
      expect(usage.length).toBe(1);
      expect(usage[0]?.count).toBe(5);
    });
  });

  describe('revokeKey', () => {
    it('soft-deletes by setting revoked_at', async () => {
      const { record } = await createKey(env.db, {
        email: 'rv@b.com',
        name: 'Rv',
      });
      const ok = await revokeKey(env.db, record.id);
      expect(ok).toBe(true);

      // Second call returns false (already revoked).
      expect(await revokeKey(env.db, record.id)).toBe(false);
    });

    it('returns false when the id does not exist', async () => {
      expect(await revokeKey(env.db, 99_999)).toBe(false);
    });
  });

  describe('listKeys', () => {
    it('returns keys ordered by created_at descending', async () => {
      const first = await createKey(env.db, { email: 'a@b.com', name: 'A' });
      // Tiny delay so created_at differs at the millisecond level
      await new Promise((r) => setTimeout(r, 5));
      const second = await createKey(env.db, { email: 'c@b.com', name: 'C' });

      const all = await listKeys(env.db);
      expect(all.length).toBe(2);
      expect(all[0]?.id).toBe(second.record.id);
      expect(all[1]?.id).toBe(first.record.id);
    });

    it('caps the result count at the supplied limit', async () => {
      for (let i = 0; i < 5; i++) {
        await createKey(env.db, { email: `u${i}@b.com`, name: `U${i}` });
      }
      const top3 = await listKeys(env.db, 3);
      expect(top3.length).toBe(3);
    });
  });

  describe('getDailyUsage', () => {
    it('returns empty array when nothing has been recorded', async () => {
      const { record } = await createKey(env.db, {
        email: 'q@b.com',
        name: 'Q',
      });
      const usage = await getDailyUsage(env.db, record.id, 30);
      expect(usage).toEqual([]);
    });
  });
});
