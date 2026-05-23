import { and, asc, desc, gte, lte, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { parallelRates, type ParallelRate } from './schema.js';

export interface ParallelSnapshotInput {
  buy: number;
  sell: number;
  average: number;
}

/** Inserts one hourly snapshot. `timestamp` defaults to now. */
export async function insertParallelSnapshot(
  d: Database,
  snap: ParallelSnapshotInput,
  source = 'binance_p2p',
  timestamp: Date = new Date(),
): Promise<ParallelRate> {
  const rows = await d
    .insert(parallelRates)
    .values({
      timestamp,
      buy: snap.buy.toFixed(8),
      sell: snap.sell.toFixed(8),
      average: snap.average.toFixed(8),
      source,
    })
    .returning();
  return rows[0]!;
}

/** Most recent snapshot (there is no "future" here — it's a live market). */
export async function getLatestParallel(d: Database): Promise<ParallelRate | undefined> {
  const rows = await d
    .select()
    .from(parallelRates)
    .orderBy(desc(parallelRates.timestamp))
    .limit(1);
  return rows[0];
}

/** Raw hourly snapshots within [from, to], oldest first. */
export async function getParallelHistory(
  d: Database,
  from: Date,
  to: Date,
): Promise<ParallelRate[]> {
  return d
    .select()
    .from(parallelRates)
    .where(and(gte(parallelRates.timestamp, from), lte(parallelRates.timestamp, to)))
    .orderBy(asc(parallelRates.timestamp));
}

export interface ParallelDailyRow {
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  average: string;
}

/**
 * Daily OHLC aggregation of the `average`, grouped by the Caracas calendar day.
 * `open`/`close` are the first/last snapshot of the day; `high`/`low`/`average`
 * are computed over that day's snapshots.
 */
export async function getParallelDaily(
  d: Database,
  from: Date,
  to: Date,
): Promise<ParallelDailyRow[]> {
  const res = await d.execute(sql`
    SELECT
      (timestamp AT TIME ZONE 'America/Caracas')::date::text AS date,
      (array_agg(average ORDER BY timestamp ASC))[1]::text AS open,
      max(average)::text AS high,
      min(average)::text AS low,
      (array_agg(average ORDER BY timestamp DESC))[1]::text AS close,
      round(avg(average), 8)::text AS average
    FROM parallel_rates
    WHERE timestamp >= ${from} AND timestamp <= ${to}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  return res.rows as unknown as ParallelDailyRow[];
}
