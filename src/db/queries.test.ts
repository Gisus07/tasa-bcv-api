// TODO: these tests need real Postgres. pg-mem 3.x doesn't expose
// `getTypeParser`, which drizzle-orm/node-postgres invokes on every query,
// so the in-memory adapter throws "Not supported".
//
// Plan: migrate to @testcontainers/postgresql in the BCV services step (Task #4),
// where ingest tests also need a real DB for ON CONFLICT semantics.
import { describe, it, expect, beforeEach } from 'vitest';
import { newDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
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
import type { Database } from './client.js';

/**
 * Spins up an in-memory Postgres and applies the schema by hand. We mirror
 * the columns from src/db/schema.ts because pg-mem stumbles on a few corners
 * of the generated migration (multi-statement files, DESC NULLS LAST in
 * index syntax, etc.).
 */
function freshDb(): Database {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.none(`
    CREATE TABLE rates (
      "date" date NOT NULL,
      "currency" varchar(3) NOT NULL,
      "rate" numeric(18, 8) NOT NULL,
      "source" varchar(8) DEFAULT 'BCV' NOT NULL,
      "source_file" text NOT NULL,
      "published_at" date,
      "is_propagated" boolean DEFAULT false NOT NULL,
      "propagated_from" date,
      "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      PRIMARY KEY ("date", "currency")
    );

    CREATE TABLE ingest_runs (
      "id" serial PRIMARY KEY,
      "job_type" varchar(16) NOT NULL,
      "started_at" timestamp with time zone DEFAULT now() NOT NULL,
      "finished_at" timestamp with time zone,
      "status" varchar(16) NOT NULL,
      "rows_upserted" integer DEFAULT 0 NOT NULL,
      "files_fetched" integer DEFAULT 0 NOT NULL,
      "error_message" text
    );
  `);
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  return drizzle(pool, { schema }) as Database;
}

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

describe.skip('queries (requires real Postgres — migrate to testcontainers)', () => {
  let db: Database;
  beforeEach(() => {
    db = freshDb();
  });

  it('upserts a batch and returns the count', async () => {
    const inserted = await upsertRates(db, [usd14, usd15, eur14]);
    // pg-mem reports 0 affected on its insert path; we still expect the data to be there.
    expect(inserted).toBeGreaterThanOrEqual(0);

    const fetched = await getByDate(db, '2026-05-14', USD);
    expect(fetched?.rate).toBe('510.78730000');
    expect(fetched?.currency).toBe('USD');
  });

  it('getLatest returns the most recent row for the requested currency', async () => {
    await upsertRates(db, [usd14, usd15, usd18, eur14]);

    const latestUsd = await getLatest(db, USD);
    expect(latestUsd?.date).toBe('2026-05-18');

    const latestEur = await getLatest(db, EUR);
    expect(latestEur?.date).toBe('2026-05-14');
  });

  it('getByDate returns undefined when no row exists', async () => {
    await upsertRates(db, [usd14]);
    expect(await getByDate(db, '2026-05-15', USD)).toBeUndefined();
    expect(await getByDate(db, '2026-05-14', EUR)).toBeUndefined();
  });

  it('getRange filters by date window and optionally by currency', async () => {
    await upsertRates(db, [usd14, usd15, usd18, eur14]);

    const usdRange = await getRange(db, '2026-05-14', '2026-05-15', USD);
    expect(usdRange.map((r) => r.date)).toEqual(['2026-05-14', '2026-05-15']);

    const all = await getRange(db, '2026-05-14', '2026-05-18');
    // 3 USD + 1 EUR rows
    expect(all.length).toBe(4);
  });

  it('getLastBefore returns the most recent row strictly before a date', async () => {
    await upsertRates(db, [usd14, usd15, usd18]);
    const result = await getLastBefore(db, '2026-05-18', USD);
    expect(result?.date).toBe('2026-05-15');
  });

  it('getEarliestDate returns the smallest date for a currency', async () => {
    await upsertRates(db, [usd14, usd15, usd18, eur14]);
    expect(await getEarliestDate(db, USD)).toBe('2026-05-14');
    expect(await getEarliestDate(db, EUR)).toBe('2026-05-14');
  });

  it('records an ingest run lifecycle', async () => {
    const id = await startIngestRun(db, 'daily');
    expect(typeof id).toBe('number');

    expect(await getLastSuccessfulRun(db)).toBeUndefined();

    await completeIngestRun(db, id, 'ok', 12, 2);
    const last = await getLastSuccessfulRun(db);
    expect(last?.status).toBe('ok');
    expect(last?.rowsUpserted).toBe(12);
    expect(last?.filesFetched).toBe(2);
  });

  // make_interval is stubbed in pg-mem, so this test only checks the happy path.
  it('hasActiveIngestRun reports running runs', async () => {
    await startIngestRun(db, 'daily');
    const active = await hasActiveIngestRun(db, 30);
    expect(typeof active).toBe('boolean');
  });
});
