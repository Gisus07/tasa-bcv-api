import type { Database } from '../db/client.js';
import { getInterventionHistory, getLatestIntervention } from '../db/intervention.queries.js';
import { diffDays } from '../lib/dates.js';
import { InvalidRangeError, NotFoundError, RangeTooLargeError } from '../lib/errors.js';

const MAX_HISTORY_DAYS = 366;
const CURRENCY_PAIR = 'EUR/VES';

export interface InterventionLatestOutput {
  date: string;
  intervention_number: string;
  currency_pair: string;
  rate: number;
  source: string;
}

/**
 * Most recent intervention. Events are punctual (no propagation): this returns
 * the last day the BCV actually intervened, which the client compares against
 * today to decide whether there was an intervention today.
 */
export async function getInterventionLatest(d: Database): Promise<InterventionLatestOutput> {
  const row = await getLatestIntervention(d);
  if (!row) {
    throw new NotFoundError('Aún no hay intervenciones cambiarias registradas.');
  }
  return {
    date: row.date,
    intervention_number: row.interventionNumber,
    currency_pair: CURRENCY_PAIR,
    rate: Number(row.rate),
    source: row.source,
  };
}

/** Interventions within [from, to] (max 366 days). Only days with an intervention appear. */
export async function getInterventionHistoryRange(
  d: Database,
  from: string,
  to: string,
): Promise<{
  from: string;
  to: string;
  currency_pair: string;
  count: number;
  interventions: { date: string; intervention_number: string; rate: number }[];
}> {
  if (from > to) throw new InvalidRangeError(from, to);
  const days = diffDays(from, to) + 1;
  if (days > MAX_HISTORY_DAYS) throw new RangeTooLargeError(days, MAX_HISTORY_DAYS);

  const rows = await getInterventionHistory(d, from, to);
  return {
    from,
    to,
    currency_pair: CURRENCY_PAIR,
    count: rows.length,
    interventions: rows.map((r) => ({
      date: r.date,
      intervention_number: r.interventionNumber,
      rate: Number(r.rate),
    })),
  };
}
