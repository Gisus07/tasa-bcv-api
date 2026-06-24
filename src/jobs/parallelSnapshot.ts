import type { Database } from '../db/client.js';
import { insertParallelSnapshot } from '../db/parallel.queries.js';
import { logger } from '../logger.js';
import {
  getParallelSnapshot,
  type ParallelSnapshot,
} from '../services/binance/client.js';

/**
 * Captures one Binance P2P USDT/VES snapshot and stores it. Best-effort: if
 * Binance is unreachable, it logs and skips — that hour simply has no row
 * (the parallel series is not propagated like the BCV one).
 */
export async function runParallelSnapshot(
  d: Database,
): Promise<ParallelSnapshot | null> {
  const log = logger().child({ job: 'parallel-snapshot' });
  try {
    const snap = await getParallelSnapshot();
    await insertParallelSnapshot(d, snap);
    log.info(snap, 'parallel snapshot stored');
    return snap;
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : err },
      'parallel snapshot failed; skipping this hour',
    );
    return null;
  }
}
