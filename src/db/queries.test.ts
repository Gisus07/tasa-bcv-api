import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getLatest,
  getByDate,
  getRange,
  getLastBefore,
  getEarliestDate,
  upsertRates,
  startIngestRun,
  completeIngestRun,
  hasActiveIngestRun,
  getLastSuccessfulRun,
} from './queries.js';
import {
  clearTables,
  startTestDb,
  stopTestDb,
  type TestDb,
} from '../__tests__/testcontainer.helper.js';

const USD = 'USD' as const;
const EUR = 'EUR' as const;

const usd14 = {
  date: '2026-05-14',
  currency: USD,
  rate: '510.78730000',
  sourceFile: '2_1_1_tdc.xlsx',
};
const usd15 = {
  date: '2026-05-15',
  currency: USD,
  rate: '510.85000000',
  sourceFile: '2_1_1_tdc.xlsx',
};
const usd18 = {
  date: '2026-05-18',
  currency: USD,
  rate: '511.00000000',
  sourceFile: '2_1_1_tdc.xlsx',
};
const eur14 = {
  date: '2026-05-14',
  currency: EUR,
  rate: '598.12171255',
  sourceFile: '2_1_2b26_otrasmonedas.xls',
};

describe('queries (real Postgres via testcontainers)', () => {
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

  it('upserts a batch and returns the number of rows affected', async () => {
    const inserted = await upsertRates(env.db, [usd14, usd15, eur14]);
    expect(inserted).toBe(3);

    const fetched = await getByDate(env.db, '2026-05-14', USD);
    expect(fetched?.rate).toBe('510.78730000');
    expect(fetched?.currency).toBe('USD');
  });

  it('getLatest returns the most recent row for the requested currency', async () => {
    await upsertRates(env.db, [usd14, usd15, usd18, eur14]);

    const latestUsd = await getLatest(env.db, USD);
    expect(latestUsd?.date).toBe('2026-05-18');

    const latestEur = await getLatest(env.db, EUR);
    expect(latestEur?.date).toBe('2026-05-14');
  });

  it('getLatest caps at asOf, ignoring future-dated rows (the /latest bug)', async () => {
    await upsertRates(env.db, [usd14, usd15, usd18]);
    // Without asOf → the absolute max date.
    expect((await getLatest(env.db, USD))?.date).toBe('2026-05-18');
    // With asOf → the latest on or before that date (18 is "future").
    expect((await getLatest(env.db, USD, '2026-05-15'))?.date).toBe(
      '2026-05-15',
    );
    expect((await getLatest(env.db, USD, '2026-05-16'))?.date).toBe(
      '2026-05-15',
    );
  });

  it('getByDate returns undefined when no row exists', async () => {
    await upsertRates(env.db, [usd14]);
    expect(await getByDate(env.db, '2026-05-15', USD)).toBeUndefined();
    expect(await getByDate(env.db, '2026-05-14', EUR)).toBeUndefined();
  });

  it('getRange filters by date window and optionally by currency', async () => {
    await upsertRates(env.db, [usd14, usd15, usd18, eur14]);

    const usdRange = await getRange(env.db, '2026-05-14', '2026-05-15', USD);
    expect(usdRange.map((r) => r.date)).toEqual(['2026-05-14', '2026-05-15']);

    const all = await getRange(env.db, '2026-05-14', '2026-05-18');
    // 3 USD + 1 EUR rows
    expect(all.length).toBe(4);
  });

  it('getLastBefore returns the most recent row strictly before a date', async () => {
    await upsertRates(env.db, [usd14, usd15, usd18]);
    const result = await getLastBefore(env.db, '2026-05-18', USD);
    expect(result?.date).toBe('2026-05-15');
  });

  it('getEarliestDate returns the smallest date for a currency', async () => {
    await upsertRates(env.db, [usd14, usd15, usd18, eur14]);
    expect(await getEarliestDate(env.db, USD)).toBe('2026-05-14');
    expect(await getEarliestDate(env.db, EUR)).toBe('2026-05-14');
  });

  it('upsertRates deduplicates intra-batch and is idempotent across runs', async () => {
    // Same (date, currency) appearing twice — must not crash ON CONFLICT.
    const first = await upsertRates(env.db, [
      usd14,
      { ...usd14, rate: '510.99999999' },
    ]);
    expect(first).toBeGreaterThan(0);
    const stored = await getByDate(env.db, '2026-05-14', USD);
    expect(stored?.rate).toBe('510.99999999'); // last wins

    // Re-running with the same values should be a no-op for the row count.
    const second = await upsertRates(env.db, [
      { ...usd14, rate: '510.99999999' },
    ]);
    expect(second).toBe(0);
  });

  it('records an ingest run lifecycle', async () => {
    const id = await startIngestRun(env.db, 'daily');
    expect(typeof id).toBe('number');

    expect(await getLastSuccessfulRun(env.db)).toBeUndefined();

    await completeIngestRun(env.db, id, 'ok', 12, 2);
    const last = await getLastSuccessfulRun(env.db);
    expect(last?.status).toBe('ok');
    expect(last?.rowsUpserted).toBe(12);
    expect(last?.filesFetched).toBe(2);
  });

  it('hasActiveIngestRun reports running runs within the window', async () => {
    await startIngestRun(env.db, 'daily');
    expect(await hasActiveIngestRun(env.db, 30)).toBe(true);

    // After completing it, should report false again.
    const id = await startIngestRun(env.db, 'manual');
    await completeIngestRun(env.db, id, 'ok', 0, 0);
    // The first one is still running — adjust: clear and re-test the
    // negative case in isolation.
    await clearTables(env.db);
    expect(await hasActiveIngestRun(env.db, 30)).toBe(false);
  });
});
