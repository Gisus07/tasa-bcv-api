import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { propagateGaps } from './quirks.js';
import { getByDate, upsertRates } from '../../db/queries.js';
import {
  clearTables,
  startTestDb,
  stopTestDb,
  type TestDb,
} from '../../__tests__/testcontainer.helper.js';

const USD = 'USD' as const;

describe('propagateGaps (real Postgres via testcontainers)', () => {
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

  it('does nothing when there is no anchor rate (start of history)', async () => {
    const n = await propagateGaps(env.db, USD, '2026-05-16', '2026-05-18');
    expect(n).toBe(0);
    expect(await getByDate(env.db, '2026-05-17', USD)).toBeUndefined();
  });

  it('carries the last real rate forward across a weekend + holiday gap', async () => {
    // Friday 15 real, Tuesday 19 real; Sat 16 / Sun 17 / Mon 18 (holiday) missing.
    await upsertRates(env.db, [
      { date: '2026-05-15', currency: USD, rate: '510.00000000', sourceFile: 'x' },
      { date: '2026-05-19', currency: USD, rate: '512.00000000', sourceFile: 'x' },
    ]);

    const n = await propagateGaps(env.db, USD, '2026-05-15', '2026-05-19');
    expect(n).toBe(3); // 16, 17, 18

    for (const day of ['2026-05-16', '2026-05-17', '2026-05-18']) {
      const row = await getByDate(env.db, day, USD);
      expect(row?.isPropagated).toBe(true);
      // All propagated days point at the real origin (15), not at each other.
      expect(row?.propagatedFrom).toBe('2026-05-15');
      expect(row?.rate).toBe('510.00000000');
    }

    // The real Tuesday rate is untouched.
    const tue = await getByDate(env.db, '2026-05-19', USD);
    expect(tue?.isPropagated).toBe(false);
    expect(tue?.rate).toBe('512.00000000');
  });

  it('seeds from the last real rate before the window', async () => {
    await upsertRates(env.db, [
      { date: '2026-05-15', currency: USD, rate: '510.00000000', sourceFile: 'x' },
    ]);

    const n = await propagateGaps(env.db, USD, '2026-05-16', '2026-05-18');
    expect(n).toBe(3);

    const row = await getByDate(env.db, '2026-05-18', USD);
    expect(row?.propagatedFrom).toBe('2026-05-15');
    expect(row?.rate).toBe('510.00000000');
  });

  it('is a no-op when the range is already fully populated with real rows', async () => {
    await upsertRates(env.db, [
      { date: '2026-05-15', currency: USD, rate: '1.00000000', sourceFile: 'x' },
      { date: '2026-05-16', currency: USD, rate: '2.00000000', sourceFile: 'x' },
      { date: '2026-05-17', currency: USD, rate: '3.00000000', sourceFile: 'x' },
    ]);

    const n = await propagateGaps(env.db, USD, '2026-05-15', '2026-05-17');
    expect(n).toBe(0);
  });
});
