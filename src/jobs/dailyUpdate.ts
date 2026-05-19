import type { Database } from '../db/client.js';
import {
  completeIngestRun,
  getByDate,
  hasActiveIngestRun,
  startIngestRun,
} from '../db/queries.js';
import { addDays, todayCaracas } from '../lib/dates.js';
import { logger } from '../logger.js';
import { monthToQuarterLetter } from '../services/bcv/urls.js';
import {
  ingestCurrentEurQuarter,
  ingestFromHomepage,
} from '../services/bcv/ingest.js';
import { propagateGaps } from '../services/bcv/quirks.js';

export interface DailyUpdateResult {
  capturedToday: boolean;
  rowsUpserted: number;
  filesFetched: number;
}

/**
 * Daily ingest: scrape the BCV homepage for today's rate, refresh the current
 * EUR quarter from the XLS for late corrections, then propagate any gaps.
 *
 * Idempotent: re-running yields the same DB state. A 30-minute lock prevents
 * accidental overlap with another worker invocation.
 */
export async function runDailyUpdate(
  d: Database,
  jobType: 'daily' | 'retry' | 'manual' = 'daily',
): Promise<DailyUpdateResult> {
  const log = logger().child({ job: jobType });

  if (await hasActiveIngestRun(d, 30)) {
    log.warn('another ingest_run is in progress; skipping');
    return { capturedToday: false, rowsUpserted: 0, filesFetched: 0 };
  }

  const runId = await startIngestRun(d, jobType);
  const today = todayCaracas();
  let totalUpserted = 0;
  let totalFiles = 0;

  try {
    const homepage = await ingestFromHomepage(d);
    totalUpserted += homepage.rowsUpserted;
    totalFiles += homepage.filesFetched;

    // Also refresh the current EUR quarter so late corrections are captured.
    const yyyy = Number(today.slice(0, 4));
    const mm = Number(today.slice(5, 7));
    const eurQuarter = await ingestCurrentEurQuarter(d, yyyy, monthToQuarterLetter(mm));
    totalUpserted += eurQuarter.rowsUpserted;
    totalFiles += eurQuarter.filesFetched;

    // Fill any gaps over the last 7 days (covers weekends and short outages).
    const windowStart = addDays(today, -7);
    totalUpserted += await propagateGaps(d, 'USD', windowStart, today);
    totalUpserted += await propagateGaps(d, 'EUR', windowStart, today);

    const usdToday = await getByDate(d, today, 'USD');
    const eurToday = await getByDate(d, today, 'EUR');
    const capturedToday = Boolean(usdToday) && Boolean(eurToday);

    await completeIngestRun(d, runId, 'ok', totalUpserted, totalFiles);
    log.info(
      { runId, today, capturedToday, totalUpserted, totalFiles },
      'daily update complete',
    );
    return { capturedToday, rowsUpserted: totalUpserted, filesFetched: totalFiles };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeIngestRun(d, runId, 'error', totalUpserted, totalFiles, message);
    log.error({ runId, err: message }, 'daily update failed');
    throw err;
  }
}
