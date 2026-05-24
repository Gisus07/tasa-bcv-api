#!/usr/bin/env node
/**
 * CLI dispatcher for ingest jobs.
 *
 * Usage:
 *   pnpm jobs:backfill              # full historical load (USD 2016+, EUR 2016+)
 *   pnpm jobs:backfill -- --from-year=2024
 *   pnpm jobs:daily                 # incremental update + propagation
 */
import { closeDb, db } from '../db/client.js';
import { logger } from '../logger.js';
import { runBackfill, type BackfillOptions } from './backfill.js';
import { runDailyUpdate } from './dailyUpdate.js';
import { runInterventionBackfill } from './interventionBackfill.js';

type JobName = 'backfill' | 'daily' | 'retry' | 'intervention-backfill';

function parseArgs(argv: string[]): { job: JobName; options: BackfillOptions } {
  const job = argv[2] as JobName | undefined;
  if (!job || !['backfill', 'daily', 'retry', 'intervention-backfill'].includes(job)) {
    // eslint-disable-next-line no-console
    console.error('Usage: tsx src/jobs/runner.ts <backfill|daily|retry|intervention-backfill> [--from-year=YYYY] [--to-year=YYYY] [--concurrency=N]');
    process.exit(1);
  }

  const options: BackfillOptions = {};
  for (const arg of argv.slice(3)) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (!v) continue;
    if (k === 'from-year') options.fromYear = Number(v);
    if (k === 'to-year') options.toYear = Number(v);
    if (k === 'concurrency') options.concurrency = Number(v);
  }
  return { job, options };
}

async function main(): Promise<void> {
  const { job, options } = parseArgs(process.argv);
  const log = logger().child({ component: 'runner' });
  log.info({ job, options }, 'starting job');

  const d = db();
  try {
    if (job === 'backfill') {
      await runBackfill(d, options);
    } else if (job === 'daily') {
      await runDailyUpdate(d, 'daily');
    } else if (job === 'intervention-backfill') {
      await runInterventionBackfill(d);
    } else {
      await runDailyUpdate(d, 'retry');
    }
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
