import cron, { type ScheduledTask } from 'node-cron';
import { db } from '../db/client.js';
import { getByDate } from '../db/queries.js';
import { env } from '../env.js';
import { CARACAS_TZ, todayCaracas } from '../lib/dates.js';
import { logger } from '../logger.js';
import { runDailyUpdate } from './dailyUpdate.js';
import { runParallelSnapshot } from './parallelSnapshot.js';

let dailyTask: ScheduledTask | undefined;
let retryTask: ScheduledTask | undefined;
let parallelTask: ScheduledTask | undefined;

/**
 * Schedules the cron jobs:
 *  - Daily ingest at `CRON_DAILY_AT` (default Mon-Fri 00:00 Caracas).
 *  - Retry at `CRON_RETRY_AT` (default Mon-Fri 08:00) if today's real rate is missing.
 *  - Parallel (Binance) snapshot at `CRON_PARALLEL_AT` (default hourly, every day).
 *
 * All timezone-aware against America/Caracas; the host's TZ is irrelevant.
 */
export function startCron(): void {
  const e = env();
  const log = logger().child({ component: 'cron' });

  if (dailyTask || retryTask || parallelTask) {
    log.warn('cron already started; restarting');
    stopCron();
  }

  dailyTask = cron.schedule(
    e.CRON_DAILY_AT,
    async () => {
      log.info('cron tick: daily');
      try {
        const result = await runDailyUpdate(db(), 'daily');
        log.info(result, 'cron daily finished');
      } catch (err) {
        log.error({ err: err instanceof Error ? err.message : err }, 'cron daily threw');
      }
    },
    { timezone: CARACAS_TZ },
  );

  retryTask = cron.schedule(
    e.CRON_RETRY_AT,
    async () => {
      const today = todayCaracas();
      const usdToday = await getByDate(db(), today, 'USD');
      const eurToday = await getByDate(db(), today, 'EUR');
      const needsRetry =
        !usdToday || !eurToday || usdToday.isPropagated || eurToday.isPropagated;
      if (!needsRetry) {
        log.info({ today }, 'cron retry skipped: today already has fresh rates');
        return;
      }
      log.warn(
        {
          today,
          hasUsdReal: usdToday && !usdToday.isPropagated,
          hasEurReal: eurToday && !eurToday.isPropagated,
        },
        'cron tick: retry running',
      );
      try {
        const result = await runDailyUpdate(db(), 'retry');
        log.info(result, 'cron retry finished');
      } catch (err) {
        log.error({ err: err instanceof Error ? err.message : err }, 'cron retry threw');
      }
    },
    { timezone: CARACAS_TZ },
  );

  parallelTask = cron.schedule(
    e.CRON_PARALLEL_AT,
    async () => {
      log.info('cron tick: parallel snapshot');
      try {
        await runParallelSnapshot(db());
      } catch (err) {
        log.error({ err: err instanceof Error ? err.message : err }, 'cron parallel threw');
      }
    },
    { timezone: CARACAS_TZ },
  );

  log.info(
    {
      dailyAt: e.CRON_DAILY_AT,
      retryAt: e.CRON_RETRY_AT,
      parallelAt: e.CRON_PARALLEL_AT,
      tz: CARACAS_TZ,
    },
    'cron scheduled',
  );
}

export function stopCron(): void {
  dailyTask?.stop();
  retryTask?.stop();
  parallelTask?.stop();
  dailyTask = undefined;
  retryTask = undefined;
  parallelTask = undefined;
}
