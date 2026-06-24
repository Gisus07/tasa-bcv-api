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
    .where(
      and(
        eq(rates.currency, currency),
        gte(rates.date, fromIso),
        lte(rates.date, toIso),
      ),
    );
  const byDate = new Map(existing.map((r) => [r.date, r]));

  // Seed with the most recent rate before `fromIso` when the window does NOT
  // start on a real row, so propagated days at the start can be (re)anchored to
  // the correct origin instead of being left stale.
  let lastKnown: { date: string; rate: string } | undefined;
  const firstRow = byDate.get(fromIso);
  if (!firstRow || firstRow.isPropagated) {
    const seed = await getLastBefore(d, fromIso, currency);
    if (seed) lastKnown = { date: seed.date, rate: seed.rate };
  }

  const toInsert: NewRate[] = [];
  for (const date of iterateDays(fromIso, toIso)) {
    const row = byDate.get(date);
    if (row && !row.isPropagated) {
      // Real row: the source of truth for the propagated days that follow.
      lastKnown = { date: row.date, rate: row.rate };
      continue;
    }
    if (!lastKnown) {
      // No anchor yet (start of history). If a propagated row already sits
      // here, keep it and use it as a fallback seed.
      if (row) lastKnown = { date: row.date, rate: row.rate };
      continue;
    }
    // Empty day OR an existing propagated row → (re)propagate from the anchor.
    // Re-propagating existing propagated rows fixes stale ones whose origin
    // changed upstream (e.g. a real rate published late). The idempotent upsert
    // skips rows that already match, so the steady-state cost is zero.
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
