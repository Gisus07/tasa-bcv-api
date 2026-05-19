import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../db/schema.js';

/**
 * Module-scoped Postgres container shared across the tests in a file.
 *
 * Vitest creates a fresh Node worker per test file (we're using `pool:
 * 'forks'`), so this helper is effectively a "one container per test file"
 * pattern: the container starts on the first call to `startTestDb()` and
 * stops on `stopTestDb()` from the file's `afterAll` hook.
 *
 * Image pulled lazily; the first invocation can take ~10 s on a cold
 * machine, every subsequent file with the image already cached is sub-3 s.
 */
export interface TestDb {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
  container: StartedPostgreSqlContainer;
}

let current: TestDb | undefined;

export async function startTestDb(): Promise<TestDb> {
  if (current) return current;

  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('tasa_bcv_test')
    .withUsername('test')
    .withPassword('test')
    .withReuse()
    .start();

  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });

  await migrate(db, { migrationsFolder: './drizzle' });

  current = { db, pool, container };
  return current;
}

export async function stopTestDb(): Promise<void> {
  if (!current) return;
  try {
    await current.pool.end();
  } finally {
    await current.container.stop();
    current = undefined;
  }
}

/**
 * Clears every domain table while leaving the schema intact. Cheaper than
 * recreating the container between tests.
 */
export async function clearTables(d: NodePgDatabase<typeof schema>): Promise<void> {
  await d.execute(
    sql`TRUNCATE TABLE rates, ingest_runs, api_keys, api_key_usage_daily RESTART IDENTITY CASCADE`,
  );
}
