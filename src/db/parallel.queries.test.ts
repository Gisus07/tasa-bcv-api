import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  getLatestParallel,
  getParallelDaily,
  getParallelHistory,
  insertParallelSnapshot,
} from './parallel.queries.js';
import { startTestDb, stopTestDb, type TestDb } from '../__tests__/testcontainer.helper.js';

describe('parallel.queries (real Postgres via testcontainers)', () => {
  let env: TestDb;

  beforeAll(async () => {
    env = await startTestDb();
  }, 60_000);

  afterAll(async () => {
    await stopTestDb();
  }, 30_000);

  beforeEach(async () => {
    await env.db.execute(sql`TRUNCATE TABLE parallel_rates RESTART IDENTITY`);
  });

  it('inserts snapshots and getLatest returns the most recent', async () => {
    await insertParallelSnapshot(env.db, { buy: 720, sell: 718, average: 719 }, 'binance_p2p', new Date('2026-05-23T14:00:00Z'));
    await insertParallelSnapshot(env.db, { buy: 722, sell: 720, average: 721 }, 'binance_p2p', new Date('2026-05-23T15:00:00Z'));

    const latest = await getLatestParallel(env.db);
    expect(latest?.average).toBe('721.00000000');
    expect(Number(latest?.buy)).toBe(722);
    expect(latest?.source).toBe('binance_p2p');
  });

  it('getParallelHistory returns rows within the range, oldest first', async () => {
    await insertParallelSnapshot(env.db, { buy: 1, sell: 1, average: 1 }, 'binance_p2p', new Date('2026-05-22T10:00:00Z'));
    await insertParallelSnapshot(env.db, { buy: 2, sell: 2, average: 2 }, 'binance_p2p', new Date('2026-05-23T10:00:00Z'));
    await insertParallelSnapshot(env.db, { buy: 3, sell: 3, average: 3 }, 'binance_p2p', new Date('2026-05-24T10:00:00Z'));

    const rows = await getParallelHistory(
      env.db,
      new Date('2026-05-23T00:00:00Z'),
      new Date('2026-05-23T23:59:59Z'),
    );
    expect(rows.length).toBe(1);
    expect(Number(rows[0]?.average)).toBe(2);
  });

  it('getParallelDaily aggregates OHLC by Caracas day', async () => {
    // All three fall on 2026-05-23 in Caracas (UTC-4): 08:00, 12:00, 16:00.
    await insertParallelSnapshot(env.db, { buy: 719, sell: 719, average: 719 }, 'binance_p2p', new Date('2026-05-23T12:00:00Z'));
    await insertParallelSnapshot(env.db, { buy: 725, sell: 725, average: 725 }, 'binance_p2p', new Date('2026-05-23T16:00:00Z'));
    await insertParallelSnapshot(env.db, { buy: 721, sell: 721, average: 721 }, 'binance_p2p', new Date('2026-05-23T20:00:00Z'));

    const days = await getParallelDaily(
      env.db,
      new Date('2026-05-23T00:00:00Z'),
      new Date('2026-05-24T23:59:59Z'),
    );
    expect(days.length).toBe(1);
    expect(days[0]?.date).toBe('2026-05-23');
    expect(Number(days[0]?.open)).toBe(719); // first by timestamp
    expect(Number(days[0]?.high)).toBe(725);
    expect(Number(days[0]?.low)).toBe(719);
    expect(Number(days[0]?.close)).toBe(721); // last by timestamp
  });
});
