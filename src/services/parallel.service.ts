import type { Database } from '../db/client.js';
import {
  getLatestParallel,
  getParallelDaily,
  getParallelHistory,
} from '../db/parallel.queries.js';
import { diffDays } from '../lib/dates.js';
import { InvalidRangeError, NotFoundError, RangeTooLargeError } from '../lib/errors.js';
import { getParallelSnapshot } from './binance/client.js';

const MAX_HISTORY_DAYS = 31;
const MAX_DAILY_DAYS = 365;

/** Cache window for the live "latest" so we don't hit Binance on every request. */
const LIVE_TTL_MS = 30_000;
let liveCache: { value: ParallelLatestOutput; expiresAt: number } | undefined;

/** Caracas is fixed UTC-4 (no DST), so day bounds use a literal offset. */
function caracasDayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000-04:00`);
}
function caracasDayEnd(iso: string): Date {
  return new Date(`${iso}T23:59:59.999-04:00`);
}

export interface ParallelLatestOutput {
  timestamp: string;
  currency_pair: string;
  buy: number;
  sell: number;
  average: number;
  source: string;
}

/**
 * Live latest parallel rate: queries Binance on the fly, cached ~30s to spare
 * the upstream and keep responses fast. If Binance is unreachable, falls back
 * to the most recent stored snapshot — the older `timestamp` signals staleness.
 * The hourly cron keeps populating the stored series for history/daily.
 */
export async function getParallelLatest(d: Database): Promise<ParallelLatestOutput> {
  const now = Date.now();
  if (liveCache && liveCache.expiresAt > now) return liveCache.value;

  try {
    const snap = await getParallelSnapshot();
    const value: ParallelLatestOutput = {
      timestamp: new Date().toISOString(),
      currency_pair: 'USDT/VES',
      buy: snap.buy,
      sell: snap.sell,
      average: snap.average,
      source: 'binance_p2p',
    };
    liveCache = { value, expiresAt: now + LIVE_TTL_MS };
    return value;
  } catch {
    // Upstream failed — serve the last stored snapshot if we have one.
    const row = await getLatestParallel(d);
    if (!row) {
      throw new NotFoundError(
        'Aún no hay tasa paralela disponible (Binance no responde y no hay snapshots).',
      );
    }
    return {
      timestamp: row.timestamp.toISOString(),
      currency_pair: 'USDT/VES',
      buy: Number(row.buy),
      sell: Number(row.sell),
      average: Number(row.average),
      source: row.source,
    };
  }
}

/** Raw hourly snapshots in [from, to] (max 31 days). */
export async function getParallelHistoryRange(
  d: Database,
  from: string,
  to: string,
): Promise<{
  from: string;
  to: string;
  count: number;
  snapshots: { timestamp: string; buy: number; sell: number; average: number }[];
}> {
  if (from > to) throw new InvalidRangeError(from, to);
  const days = diffDays(from, to) + 1;
  if (days > MAX_HISTORY_DAYS) throw new RangeTooLargeError(days, MAX_HISTORY_DAYS);

  const rows = await getParallelHistory(d, caracasDayStart(from), caracasDayEnd(to));
  return {
    from,
    to,
    count: rows.length,
    snapshots: rows.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      buy: Number(r.buy),
      sell: Number(r.sell),
      average: Number(r.average),
    })),
  };
}

/** Daily OHLC aggregation in [from, to] (max 365 days). */
export async function getParallelDailyRange(
  d: Database,
  from: string,
  to: string,
): Promise<{
  from: string;
  to: string;
  count: number;
  days: { date: string; open: number; high: number; low: number; close: number; average: number }[];
}> {
  if (from > to) throw new InvalidRangeError(from, to);
  const days = diffDays(from, to) + 1;
  if (days > MAX_DAILY_DAYS) throw new RangeTooLargeError(days, MAX_DAILY_DAYS);

  const rows = await getParallelDaily(d, caracasDayStart(from), caracasDayEnd(to));
  return {
    from,
    to,
    count: rows.length,
    days: rows.map((r) => ({
      date: r.date,
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      average: Number(r.average),
    })),
  };
}
