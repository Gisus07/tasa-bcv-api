import type { Database } from '../db/client.js';
import {
  completeIngestRun,
  getEarliestDate,
  hasActiveIngestRun,
  startIngestRun,
} from '../db/queries.js';
import { todayCaracas } from '../lib/dates.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../logger.js';
import { ingestEurHistory, ingestUsdHistory } from '../services/bcv/ingest.js';
import { propagateGaps } from '../services/bcv/quirks.js';

export interface BackfillOptions {
  /** First year to attempt for EUR quarterly files. Defaults to 2016. */
  fromYear?: number;
  /** Last year to attempt for EUR quarterly files. Defaults to current year. */
  toYear?: number;
  /** Concurrency for EUR XLS downloads. Defaults to 4. */
  concurrency?: number;
}

/**
 * One-shot backfill: pull every historical row available from BCV's XLS files,
 * then fill weekend/holiday gaps via propagation.
 */
export async function runBackfill(d: Database, options: BackfillOptions = {}): Promise<void> {
  const log = logger().child({ job: 'backfill' });

  // Respect the same 30-minute lock as the daily so a boot backfill can't run
  // concurrently with a scheduled ingest (BE-3).
  if (await hasActiveIngestRun(d, 30)) {
    log.warn('another ingest_run is in progress; skipping backfill');
    return;
  }

  const fromYear = options.fromYear ?? 2016;
  const toYear = options.toYear ?? new Date().getUTCFullYear();
  const runId = await startIngestRun(d, 'backfill');
  log.info({ runId, fromYear, toYear }, 'starting backfill');

  try {
    const usd = await ingestUsdHistory(d);
    const eur = await ingestEurHistory(d, fromYear, toYear, {
      ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
    });

    const today = todayCaracas();

    let propagatedUsd = 0;
    const earliestUsd = await getEarliestDate(d, 'USD');
    if (earliestUsd) {
      propagatedUsd = await propagateGaps(d, 'USD', earliestUsd, today);
    }

    let propagatedEur = 0;
    const earliestEur = await getEarliestDate(d, 'EUR');
    if (earliestEur) {
      propagatedEur = await propagateGaps(d, 'EUR', earliestEur, today);
    }

    const totalRows = usd.rowsUpserted + eur.rowsUpserted + propagatedUsd + propagatedEur;
    const totalFiles = usd.filesFetched + eur.filesFetched;
    await completeIngestRun(d, runId, 'ok', totalRows, totalFiles);

    log.info(
      {
        runId,
        usd: { records: usd.records, upserted: usd.rowsUpserted, propagated: propagatedUsd },
        eur: {
          records: eur.records,
          upserted: eur.rowsUpserted,
          propagated: propagatedEur,
          errors: eur.errors.length,
        },
        files: totalFiles,
      },
      'backfill complete',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof AppError ? err.details : undefined;
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 8).join('\n') : undefined;
    await completeIngestRun(d, runId, 'error', 0, 0, message);
    log.error({ runId, err: message, details, stack }, 'backfill failed');
    throw err;
  }
}
