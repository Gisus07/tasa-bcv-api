import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { closeDb, db } from './db/client.js';
import { env } from './env.js';
import { runBackfill } from './jobs/backfill.js';
import { startCron, stopCron } from './jobs/cron.js';
import { runParallelSnapshot } from './jobs/parallelSnapshot.js';
import { seedInterventionsIfEmpty } from './jobs/interventionBackfill.js';
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

  // Last-resort safety nets: a rejected promise or thrown error that nothing
  // caught leaves the process in an unknown state. Log it (pino) and exit so
  // Railway's ON_FAILURE policy restarts a clean process (BE-4).
  process.on('unhandledRejection', (reason) => {
    logger().fatal(
      {
        reason:
          reason instanceof Error
            ? { message: reason.message, stack: reason.stack }
            : reason,
      },
      'unhandledRejection — exiting',
    );
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logger().fatal(
      { err: { message: err.message, stack: err.stack } },
      'uncaughtException — exiting',
    );
    process.exit(1);
  });

  await runMigrations(e.DATABASE_URL);

  if (e.RUN_BACKFILL_ON_BOOT) {
    log.warn('RUN_BACKFILL_ON_BOOT=true; running full backfill in background');
    void runBackfill(db()).catch((err) => {
      // The job itself already logs details via the AppError path. Here we
      // only need to surface the failure at the top level so it's visible in
      // a `railway logs` scroll.
      log.error(
        {
          err: err instanceof Error ? err.message : err,
          name: err instanceof Error ? err.name : undefined,
        },
        'boot backfill failed',
      );
    });
  }

  startCron();

  // Take an initial parallel snapshot on boot so /v1/parallel/latest has data
  // right away; the hourly cron continues from there. Best-effort.
  void runParallelSnapshot(db()).catch((err) =>
    log.error(
      { err: err instanceof Error ? err.message : err },
      'initial parallel snapshot failed',
    ),
  );

  // Seed the intervention history once (only when the table is empty) so a fresh
  // deploy gets the full back-history with no manual step; the morning cron
  // keeps it current. Best-effort.
  void seedInterventionsIfEmpty(db()).catch((err) =>
    log.error(
      { err: err instanceof Error ? err.message : err },
      'initial intervention seed failed',
    ),
  );

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

  // Graceful shutdown: stop the cron, stop accepting new connections and wait
  // for in-flight requests to drain (capped at 10s), then release resources.
  // Waiting for server.close before closing the DB avoids truncating responses
  // mid-flight (BE-4).
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'graceful shutdown started');
    stopCron();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        log.warn('server close timed out after 10s; forcing shutdown');
        resolve();
      }, 10_000);
      server.close(() => {
        clearTimeout(timer);
        log.info('http server closed');
        resolve();
      });
    });
    await disposeBcvClient().catch((err) =>
      log.warn({ err }, 'bcv client close failed'),
    );
    await closeDb().catch((err) => log.warn({ err }, 'db close failed'));
    log.info('bye');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger().error(
    {
      err:
        err instanceof Error ? { message: err.message, stack: err.stack } : err,
    },
    'fatal error during startup',
  );
  process.exit(1);
});
