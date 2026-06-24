import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/tasa_bcv_api';

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  const db = drizzle(pool);
  console.log('Connecting to', databaseUrl);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✓ Migrations applied');
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
