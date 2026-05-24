import type { Database } from '../db/client.js';
import { getInterventionByDate, upsertInterventions } from '../db/intervention.queries.js';
import { getByDate } from '../db/queries.js';
import { todayCaracas } from '../lib/dates.js';
import { logger } from '../logger.js';
import { scrapeInterventions } from '../services/bcv/intervention.scraper.js';
import { toNewIntervention } from './interventionBackfill.js';

export interface InterventionCheckResult {
  checked: boolean;
  captured: boolean;
}

/**
 * Morning check (runs every couple of minutes 7-9 AM Mon-Fri). Captures today's
 * intervention as soon as it appears in the BCV table.
 *
 * Uses propagation as a holiday/weekend detector: a propagated BCV rate means a
 * non-business day, and the BCV never intervenes then — so we don't even hit the
 * page. If today's row is missing, it proceeds anyway (better a wasted check
 * than a missed intervention). Best-effort: upstream errors are logged, not thrown.
 */
export async function runInterventionCheck(d: Database): Promise<InterventionCheckResult> {
  const log = logger().child({ job: 'intervention-check' });
  const today = todayCaracas();

  const todayRate = await getByDate(d, today, 'USD');
  if (todayRate?.isPropagated) {
    log.info({ today }, 'skip: propagated day (holiday/weekend), no intervention');
    return { checked: false, captured: false };
  }

  try {
    // Once today's row exists, stop hitting the page for the rest of the window.
    if (await getInterventionByDate(d, today)) {
      return { checked: true, captured: false };
    }
    const todays = (await scrapeInterventions()).filter((r) => r.date === today);
    if (todays.length === 0) {
      return { checked: true, captured: false }; // no intervention announced yet
    }
    const n = await upsertInterventions(d, todays.map(toNewIntervention));
    if (n > 0) log.info({ today, intervention: todays[0] }, 'intervention captured');
    return { checked: true, captured: n > 0 };
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : err },
      'intervention check failed; will retry next tick',
    );
    return { checked: true, captured: false };
  }
}
