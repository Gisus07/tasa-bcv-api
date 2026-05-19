import { and, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { rates, type NewRate, type Rate } from '../../db/schema.js';
import { getLastBefore, upsertRates } from '../../db/queries.js';
import { iterateDays } from '../../lib/dates.js';
import type { Currency } from './types.js';

/**
 * Fills gaps in the [from, to] window for a currency by carrying forward the
 * last known rate. This implements the BCV rule confirmed by the project:
 *
 *   "Si una fecha no tiene tasa publicada, hereda la del último día con tasa."
 *
 * Applies to weekends, public holidays, and any other unreported day.
 * Rows produced here always have `isPropagated = true` and a
 * `propagatedFrom = <origin date>` for auditability.
 *
 * Returns the number of rows upserted.
 */
export async function propagateGaps(
  d: Database,
  currency: Currency,
  fromIso: string,
  toIso: string,
): Promise<number> {
  // Bulk load every existing row in the window so we make a single SELECT
  // instead of one per day. Backfill ranges easily span 4000+ days.
  const existing: Rate[] = await d
    .select()
    .from(rates)
    .where(and(eq(rates.currency, currency), gte(rates.date, fromIso), lte(rates.date, toIso)));
  const byDate = new Map(existing.map((r) => [r.date, r]));

  // Seed with the most recent rate before `fromIso` so the first gap days
  // can be filled (when the window itself doesn't start with a real row).
  let lastKnown: { date: string; rate: string } | undefined;
  if (!byDate.has(fromIso)) {
    const seed = await getLastBefore(d, fromIso, currency);
    if (seed) lastKnown = { date: seed.date, rate: seed.rate };
  }

  const toInsert: NewRate[] = [];
  for (const date of iterateDays(fromIso, toIso)) {
    const real = byDate.get(date);
    if (real) {
      // Track the most recent real (non-propagated) value as the source of truth
      // for subsequent gap days.
      if (!real.isPropagated) {
        lastKnown = { date: real.date, rate: real.rate };
      } else if (!lastKnown) {
        // Defensive: if we only have a propagated row, still use it as a fallback.
        lastKnown = { date: real.date, rate: real.rate };
      }
      continue;
    }
    if (!lastKnown) continue; // no anchor available yet (start of history)

    toInsert.push({
      date,
      currency,
      rate: lastKnown.rate,
      source: 'BCV',
      sourceFile: 'propagated',
      isPropagated: true,
      propagatedFrom: lastKnown.date,
    });
  }

  if (toInsert.length === 0) return 0;
  return upsertRates(d, toInsert);
}
