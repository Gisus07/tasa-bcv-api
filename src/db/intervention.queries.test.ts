import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getInterventionByDate,
  getInterventionHistory,
  getLatestIntervention,
  upsertInterventions,
} from './intervention.queries.js';
import {
  clearTables,
  startTestDb,
  stopTestDb,
  type TestDb,
} from '../__tests__/testcontainer.helper.js';

const iv = (date: string, n: string, rate: string) => ({
  date,
  interventionNumber: n,
  rate,
  source: 'bcv',
});

describe('intervention queries (real Postgres via testcontainers)', () => {
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
    const n = await upsertInterventions(env.db, [
      iv('2026-05-19', '011-26', '710.35000000'),
      iv('2026-05-20', '011-26', '708.64000000'),
      iv('2026-05-21', '011-26', '710.95000000'),
    ]);
    expect(n).toBe(3);
    const row = await getInterventionByDate(env.db, '2026-05-21');
    expect(row?.rate).toBe('710.95000000');
    expect(row?.interventionNumber).toBe('011-26');
  });

  it('getLatestIntervention returns the most recent by date', async () => {
    await upsertInterventions(env.db, [
      iv('2026-05-19', '011-26', '710.35000000'),
      iv('2026-05-21', '011-26', '710.95000000'),
    ]);
    expect((await getLatestIntervention(env.db))?.date).toBe('2026-05-21');
  });

  it('is idempotent: re-upserting identical rows affects nothing', async () => {
    const batch = [iv('2026-05-21', '011-26', '710.95000000')];
    expect(await upsertInterventions(env.db, batch)).toBe(1);
    expect(await upsertInterventions(env.db, batch)).toBe(0);
  });

  it('updates only when the rate or number changes', async () => {
    await upsertInterventions(env.db, [iv('2026-05-21', '011-26', '710.95000000')]);
    const changed = await upsertInterventions(env.db, [iv('2026-05-21', '011-26', '711.00000000')]);
    expect(changed).toBe(1);
    expect((await getInterventionByDate(env.db, '2026-05-21'))?.rate).toBe('711.00000000');
  });

  it('dedupes a batch with the same date (last wins)', async () => {
    const n = await upsertInterventions(env.db, [
      iv('2026-05-21', '011-26', '710.00000000'),
      iv('2026-05-21', '011-26', '710.95000000'),
    ]);
    expect(n).toBe(1);
    expect((await getInterventionByDate(env.db, '2026-05-21'))?.rate).toBe('710.95000000');
  });

  it('getInterventionHistory returns the range, oldest first', async () => {
    await upsertInterventions(env.db, [
      iv('2026-05-13', '010-26', '716.72000000'),
      iv('2026-05-19', '011-26', '710.35000000'),
      iv('2026-05-21', '011-26', '710.95000000'),
    ]);
    const rows = await getInterventionHistory(env.db, '2026-05-14', '2026-05-21');
    expect(rows.map((r) => r.date)).toEqual(['2026-05-19', '2026-05-21']);
  });

  it('getInterventionByDate returns undefined when no intervention that day', async () => {
    await upsertInterventions(env.db, [iv('2026-05-21', '011-26', '710.95000000')]);
    expect(await getInterventionByDate(env.db, '2026-05-22')).toBeUndefined();
  });
});
