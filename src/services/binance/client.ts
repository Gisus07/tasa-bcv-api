import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../../logger.js';

/**
 * Binance P2P public endpoint (no auth). Returns the live ad book for a pair.
 * This is the de-facto source for the Venezuelan "parallel" rate (USDT/VES).
 */
const P2P_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

/** How many top ads per side to median over. */
const ROWS = 10;

const RETRY_BACKOFF_MS = [500, 1500, 4000];

/** From the taker's perspective: BUY = buy USDT (pay Bs), SELL = sell USDT. */
export type P2pSide = 'BUY' | 'SELL';

export interface ParallelSnapshot {
  /** Median of the top-10 ads to BUY USDT (Bs per USDT). */
  buy: number;
  /** Median of the top-10 ads to SELL USDT. */
  sell: number;
  /** (buy + sell) / 2. */
  average: number;
}

interface P2pResponse {
  data?: Array<{ adv?: { price?: string } }>;
}

/** Median of a non-empty numeric array. */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of empty array');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/** Fetches the top-N P2P prices for one side of USDT/VES, with retries. */
async function fetchPrices(side: P2pSide): Promise<number[]> {
  const body = JSON.stringify({
    asset: 'USDT',
    fiat: 'VES',
    tradeType: side,
    page: 1,
    rows: ROWS,
    payTypes: [],
    countries: [],
    publisherType: null,
    transAmount: '',
  });

  const log = logger().child({ component: 'binance-p2p', side });
  let attempt = 0;

  while (true) {
    try {
      const res = await fetch(P2P_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) tasa-bcv-api/0.3.0',
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Binance P2P returned HTTP ${res.status}`);
      const json = (await res.json()) as P2pResponse;
      const prices = (json.data ?? [])
        .map((d) => Number(d.adv?.price))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (prices.length === 0) throw new Error('Binance P2P returned no usable prices');
      return prices;
    } catch (err) {
      if (attempt >= RETRY_BACKOFF_MS.length) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      const delay = RETRY_BACKOFF_MS[attempt]!;
      log.warn(
        { attempt: attempt + 1, nextDelayMs: delay, err: err instanceof Error ? err.message : err },
        'transient Binance P2P failure; retrying',
      );
      await sleep(delay);
      attempt++;
    }
  }
}

/**
 * Captures one USDT/VES snapshot: median of the top-10 ads on each side.
 * Both sides are fetched in parallel.
 */
export async function getParallelSnapshot(): Promise<ParallelSnapshot> {
  const [buyPrices, sellPrices] = await Promise.all([fetchPrices('BUY'), fetchPrices('SELL')]);
  const buy = round8(median(buyPrices));
  const sell = round8(median(sellPrices));
  const average = round8((buy + sell) / 2);
  return { buy, sell, average };
}
