import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

let _pool: Pool | undefined;
let _db: Database | undefined;

export function db(): Database {
  if (!_db) {
    _pool = new Pool({
      connectionString: env().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}

/** Closes the underlying connection pool. Call on graceful shutdown. */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = undefined;
    _db = undefined;
  }
}

/** Resets the cached db so tests can inject their own. Test-only. */
export function setDbForTesting(database: Database, pool?: Pool): void {
  _db = database;
  _pool = pool;
}
