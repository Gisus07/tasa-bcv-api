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

  it('propagates forward up to a future published rate (anticipated weekend fill)', async () => {
    // The 23:00 daily already knows the next business day's rate, so the
    // propagation window ends on a FUTURE real row. Friday 22 real, Monday 25
    // real (published Friday night); Sat 23 / Sun 24 must be filled from Friday.
    await upsertRates(env.db, [
      { date: '2026-05-22', currency: USD, rate: '526.00000000', sourceFile: 'x' },
      { date: '2026-05-25', currency: USD, rate: '528.00000000', sourceFile: 'x' },
    ]);

    const n = await propagateGaps(env.db, USD, '2026-05-22', '2026-05-25');
    expect(n).toBe(2); // 23, 24

    for (const day of ['2026-05-23', '2026-05-24']) {
      const row = await getByDate(env.db, day, USD);
      expect(row?.isPropagated).toBe(true);
      expect(row?.propagatedFrom).toBe('2026-05-22');
      expect(row?.rate).toBe('526.00000000');
    }
    // The future Monday rate stays real and untouched.
    const mon = await getByDate(env.db, '2026-05-25', USD);
    expect(mon?.isPropagated).toBe(false);
    expect(mon?.rate).toBe('528.00000000');
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

  it('re-propagates a stale propagated row when its real anchor changes', async () => {
    // Reproduces the prod bug: backfill state had 14 real and 15-16 propagated
    // from 14; then the real Friday rate (15) arrived late and overwrote 15.
    await upsertRates(env.db, [
      { date: '2026-05-14', currency: USD, rate: '510.00000000', sourceFile: 'x' },
      {
        date: '2026-05-15',
        currency: USD,
        rate: '510.00000000',
        sourceFile: 'propagated',
        isPropagated: true,
        propagatedFrom: '2026-05-14',
      },
      {
        date: '2026-05-16',
        currency: USD,
        rate: '510.00000000',
        sourceFile: 'propagated',
        isPropagated: true,
        propagatedFrom: '2026-05-14',
      },
    ]);
    await upsertRates(env.db, [
      { date: '2026-05-15', currency: USD, rate: '515.00000000', sourceFile: 'x' },
    ]);

    const n = await propagateGaps(env.db, USD, '2026-05-14', '2026-05-16');
    expect(n).toBe(1); // only 16 changes

    const row16 = await getByDate(env.db, '2026-05-16', USD);
    expect(row16?.isPropagated).toBe(true);
    expect(row16?.propagatedFrom).toBe('2026-05-15'); // re-anchored to the real 15
    expect(row16?.rate).toBe('515.00000000');

    const row15 = await getByDate(env.db, '2026-05-15', USD);
    expect(row15?.isPropagated).toBe(false);
    expect(row15?.rate).toBe('515.00000000');
  });

  it('re-anchors propagated rows when the window starts on a propagated day', async () => {
    // The daily window can start on a propagated day (e.g. min(today-7, lastReal)).
    // The seed must reach back to the real anchor before the window.
    await upsertRates(env.db, [
      { date: '2026-05-15', currency: USD, rate: '515.00000000', sourceFile: 'x' },
      {
        date: '2026-05-16',
        currency: USD,
        rate: '510.00000000',
        sourceFile: 'propagated',
        isPropagated: true,
        propagatedFrom: '2026-05-14',
      },
    ]);

    // Window starts at 16 (propagated); 15 (real) is outside it.
    const n = await propagateGaps(env.db, USD, '2026-05-16', '2026-05-16');
    expect(n).toBe(1);

    const row16 = await getByDate(env.db, '2026-05-16', USD);
    expect(row16?.propagatedFrom).toBe('2026-05-15');
    expect(row16?.rate).toBe('515.00000000');
  });
});
