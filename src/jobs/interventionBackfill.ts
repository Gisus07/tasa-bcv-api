import type { Database } from '../db/client.js';
import { getLatestIntervention, upsertInterventions } from '../db/intervention.queries.js';
import type { NewIntervention } from '../db/schema.js';
import { logger } from '../logger.js';
import {
  scrapeInterventions,
  type InterventionRecord,
} from '../services/bcv/intervention.scraper.js';

/** Maps a scraped record to a DB row (source is always the BCV table). */
export function toNewIntervention(r: InterventionRecord): NewIntervention {
  return {
    date: r.date,
    interventionNumber: r.interventionNumber,
    rate: r.rate,
    source: 'bcv',
  };
}

/**
 * One-shot seed of the full intervention history from the BCV table (back to
 * 2019-05-13). Idempotent — safe to re-run; unchanged rows are skipped.
 */
export async function runInterventionBackfill(d: Database): Promise<number> {
  const log = logger().child({ job: 'intervention-backfill' });
  const records = await scrapeInterventions();
  const upserted = await upsertInterventions(d, records.map(toNewIntervention));
  log.info({ records: records.length, upserted }, 'intervention backfill complete');
  return upserted;
}

/**
 * Seeds the history only when the table is empty. Called best-effort on boot so
 * a fresh deploy gets the full history with no manual step; a no-op thereafter.
 */
export async function seedInterventionsIfEmpty(d: Database): Promise<void> {
  if (await getLatestIntervention(d)) return;
  await runInterventionBackfill(d);
}
