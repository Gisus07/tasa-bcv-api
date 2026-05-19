import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { closeDb, db } from './db/client.js';
import { env } from './env.js';
import { runBackfill } from './jobs/backfill.js';
import { startCron, stopCron } from './jobs/cron.js';
import { logger } from './logger.js';
import { disposeBcvClient } from './services/bcv/client.js';

async function runMigrations(databaseUrl: string): Promise<void> {
  const log = logger().child({ component: 'migrator' });
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const migrationsDb = drizzle(pool);
    log.info('running migrations from ./drizzle');
    await migrate(migrationsDb, { migrationsFolder: './drizzle' });
    log.info('migrations applied');
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const log = logger();
  const e = env();
  log.info(
    { nodeEnv: e.NODE_ENV, port: e.PORT, tz: e.TZ, logLevel: e.LOG_LEVEL },
    'starting tasa-bcv-api',
  );

  await runMigrations(e.DATABASE_URL);

  if (e.RUN_BACKFILL_ON_BOOT) {
    log.warn('RUN_BACKFILL_ON_BOOT=true; running full backfill in background');
    void runBackfill(db()).catch((err) => {
      log.error({ err: err instanceof Error ? err.message : err }, 'boot backfill failed');
    });
  }

  startCron();

  const app = createApp();
  const server = serve(
    { fetch: app.fetch, port: e.PORT, hostname: '0.0.0.0' },
    (info) => {
      log.info(
        { port: info.port, address: info.address ?? '0.0.0.0' },
        `listening on http://0.0.0.0:${info.port}`,
      );
    },
  );

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'graceful shutdown started');
    stopCron();
    server.close(() => {
      log.info('http server closed');
    });
    await disposeBcvClient().catch((err) => log.warn({ err }, 'bcv client close failed'));
    await closeDb().catch((err) => log.warn({ err }, 'db close failed'));
    log.info('bye');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger().error(
    { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
    'fatal error during startup',
  );
  process.exit(1);
});
