import type { Database } from '../db/client.js';
import {
  getByDate,
  getEarliestDate,
  getLastSuccessfulRun,
  getLatest,
  getRange as getRangeQuery,
} from '../db/queries.js';
import type { Rate } from '../db/schema.js';
import { addDays, diffDays, todayCaracas } from '../lib/dates.js';
import {
  DateBeforeHistoryError,
  DateOutOfRangeError,
  InvalidRangeError,
  NotFoundError,
  RangeTooLargeError,
} from '../lib/errors.js';
import type { Currency } from '../schemas/common.js';
import type { RatesPairOutput, SingleRateOutput } from '../schemas/rates.ts';

const MAX_RANGE_DAYS = 365;

/**
 * BCV publishes today the rate that applies tomorrow, so the API accepts
 * dates up to `today + 1` in Caracas.
 */
function maxAllowedDate(): string {
  return addDays(todayCaracas(), 1);
}

async function assertDateInRange(d: Database, date: string, currency: Currency): Promise<void> {
  const maxDate = maxAllowedDate();
  if (date > maxDate) throw new DateOutOfRangeError(date, maxDate);
  const earliest = await getEarliestDate(d, currency);
  if (earliest && date < earliest) {
    throw new DateBeforeHistoryError(date, earliest, currency);
  }
}

/** Returns the most recent rate per currency, paired into one flat object. */
export async function getLatestPair(d: Database): Promise<RatesPairOutput> {
  const usdRow = await getLatest(d, 'USD');
  const eurRow = await getLatest(d, 'EUR');
  if (!usdRow || !eurRow) {
    throw new NotFoundError(
      'Aún no hay tasas disponibles. Ejecuta el backfill o el job diario primero.',
    );
  }
  const pairDate = usdRow.date > eurRow.date ? usdRow.date : eurRow.date;
  return buildPair(pairDate, usdRow, eurRow);
}

/** Returns USD + EUR for a given date. */
export async function getPairByDate(d: Database, date: string): Promise<RatesPairOutput> {
  await assertDateInRange(d, date, 'USD');
  await assertDateInRange(d, date, 'EUR');
  const usdRow = await getByDate(d, date, 'USD');
  const eurRow = await getByDate(d, date, 'EUR');
  if (!usdRow || !eurRow) {
    throw new NotFoundError(
      `No hay tasas para ${date}. La propagación puede no haber corrido aún para alguna de las monedas.`,
    );
  }
  return buildPair(date, usdRow, eurRow);
}

/** Returns rates for a single currency on a given date, or the latest if `date` is omitted. */
export async function getSingleCurrency(
  d: Database,
  currency: Currency,
  date?: string,
): Promise<SingleRateOutput> {
  if (date === undefined) {
    const row = await getLatest(d, currency);
    if (!row) throw new NotFoundError(`Aún no hay tasa ${currency} disponible.`);
    return buildSingle(row);
  }
  await assertDateInRange(d, date, currency);
  const row = await getByDate(d, date, currency);
  if (!row) {
    throw new NotFoundError(`No se encontró tasa ${currency} para ${date}.`);
  }
  return buildSingle(row);
}

/** Returns rates within a date window. */
export async function getRange(
  d: Database,
  from: string,
  to: string,
  currency: Currency | 'all',
): Promise<{ from: string; to: string; count: number; rates: SingleRateOutput[] }> {
  if (from > to) throw new InvalidRangeError(from, to);
  const days = diffDays(from, to) + 1;
  if (days > MAX_RANGE_DAYS) throw new RangeTooLargeError(days, MAX_RANGE_DAYS);

  const maxDate = maxAllowedDate();
  if (to > maxDate) throw new DateOutOfRangeError(to, maxDate);

  if (currency !== 'all') {
    const earliest = await getEarliestDate(d, currency);
    if (earliest && from < earliest) {
      throw new DateBeforeHistoryError(from, earliest, currency);
    }
  } else {
    const earliestUsd = await getEarliestDate(d, 'USD');
    const earliestEur = await getEarliestDate(d, 'EUR');
    const earliest = [earliestUsd, earliestEur].filter(Boolean).sort()[0];
    if (earliest && from < earliest) {
      throw new DateBeforeHistoryError(from, earliest, 'USD+EUR');
    }
  }

  const rows =
    currency === 'all'
      ? await getRangeQuery(d, from, to)
      : await getRangeQuery(d, from, to, currency);

  return { from, to, count: rows.length, rates: rows.map(buildSingle) };
}

/** /v1/last-updated payload. */
export async function getLastUpdated(d: Database): Promise<{
  last_successful_run_at: string | null;
  last_successful_job_type: string | null;
  rows_upserted: number | null;
}> {
  const run = await getLastSuccessfulRun(d);
  if (!run) {
    return { last_successful_run_at: null, last_successful_job_type: null, rows_upserted: null };
  }
  return {
    last_successful_run_at: run.finishedAt?.toISOString() ?? null,
    last_successful_job_type: run.jobType,
    rows_upserted: run.rowsUpserted,
  };
}

/**
 * Maps a DB row to the public `SingleRate` shape. Optional fields are omitted
 * unless they apply, so the JSON stays minimal for the common case.
 */
function buildSingle(row: Rate): SingleRateOutput {
  const base: SingleRateOutput = {
    date: row.date,
    currency: row.currency as Currency,
    rate: Number(row.rate),
  };
  if (row.isPropagated) {
    base.is_propagated = true;
    if (row.propagatedFrom) base.propagated_from = row.propagatedFrom;
  }
  return base;
}

/** Builds the flat pair shape. `propagated_currencies` is omitted when none apply. */
function buildPair(date: string, usdRow: Rate, eurRow: Rate): RatesPairOutput {
  const propagated: Currency[] = [];
  if (usdRow.isPropagated) propagated.push('USD');
  if (eurRow.isPropagated) propagated.push('EUR');

  const pair: RatesPairOutput = {
    date,
    usd: Number(usdRow.rate),
    eur: Number(eurRow.rate),
  };
  if (propagated.length > 0) pair.propagated_currencies = propagated;
  return pair;
}
