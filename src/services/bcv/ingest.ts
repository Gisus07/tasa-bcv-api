import pLimit from 'p-limit';
import type { Database } from '../../db/client.js';
import type { NewRate } from '../../db/schema.js';
import { upsertRates } from '../../db/queries.js';
import { logger } from '../../logger.js';
import { fetchBcv } from './client.js';
import { parseEurWorkbook, parseEurWorkbookSafe } from './parser.eur.js';
import { parseUsdWorkbook } from './parser.usd.js';
import { scrapeBcvHomepage } from './scraper.html.js';
import { enumerateEurQuarters, eurQuarterUrl, usdHistoryUrl } from './urls.js';
import type { RateRecord } from './types.js';

export interface IngestSummary {
  filesFetched: number;
  rowsUpserted: number;
  records: number;
  errors: string[];
}

function toNewRate(r: RateRecord): NewRate {
  return {
    date: r.date,
    currency: r.currency,
    rate: r.rate,
    source: 'BCV',
    sourceFile: r.sourceFile,
    isPropagated: false,
    ...(r.publishedAt ? { publishedAt: r.publishedAt } : {}),
  };
}

/** Backfill USD history from the single canonical XLSX file. */
export async function ingestUsdHistory(d: Database): Promise<IngestSummary> {
  const log = logger().child({ source: 'usd-history' });
  const url = usdHistoryUrl();
  const fetched = await fetchBcv(url);
  if (!fetched) {
    return { filesFetched: 0, rowsUpserted: 0, records: 0, errors: [`${url}: empty body`] };
  }
  log.info({ url, bytes: fetched.body.length }, 'downloaded USD history');

  const records = parseUsdWorkbook(fetched.body, '2_1_1_tdc.xlsx');
  const rows = records.map(toNewRate);
  const upserted = await batchedUpsert(d, rows);

  log.info({ records: records.length, upserted }, 'USD history ingest complete');
  return { filesFetched: 1, rowsUpserted: upserted, records: records.length, errors: [] };
}

/**
 * Daily refresh of recent USD rows from the canonical XLS. The homepage scrape
 * only carries today's rate, but the USD XLS publishes business days with a lag
 * — so the daily must re-read it to catch dates that landed late. Otherwise a
 * late-published day stays propagated from an older one forever (the bug that
 * hit 2026-05-15..18). Filtered to `sinceIso` to keep the write set small; the
 * upsert is idempotent so unchanged rows are skipped.
 */
export async function ingestRecentUsd(d: Database, sinceIso: string): Promise<IngestSummary> {
  const log = logger().child({ source: 'usd-recent' });
  const url = usdHistoryUrl();
  const fetched = await fetchBcv(url);
  if (!fetched) {
    return { filesFetched: 0, rowsUpserted: 0, records: 0, errors: [`${url}: empty body`] };
  }
  const recent = parseUsdWorkbook(fetched.body, '2_1_1_tdc.xlsx').filter((r) => r.date >= sinceIso);
  const upserted = await batchedUpsert(d, recent.map(toNewRate));
  log.info({ records: recent.length, upserted, sinceIso }, 'recent USD refresh complete');
  return { filesFetched: 1, rowsUpserted: upserted, records: recent.length, errors: [] };
}

/** Backfill EUR history by sweeping every quarterly file in [fromYear, toYear]. */
export async function ingestEurHistory(
  d: Database,
  fromYear: number,
  toYear: number,
  options: { concurrency?: number } = {},
): Promise<IngestSummary> {
  const log = logger().child({ source: 'eur-history' });
  const concurrency = options.concurrency ?? 4;
  const limit = pLimit(concurrency);
  const errors: string[] = [];
  let filesFetched = 0;
  const allRecords: RateRecord[] = [];

  const tasks: Promise<void>[] = [];
  for (const { year, quarter, url } of enumerateEurQuarters(fromYear, toYear)) {
    tasks.push(
      limit(async () => {
        const filename = `2_1_2${quarter}${String(year % 100).padStart(2, '0')}_otrasmonedas.xls`;
        try {
          const result = await fetchBcv(url, { allow404: true });
          if (!result) {
            log.debug({ url }, 'EUR quarter not available (404)');
            return;
          }
          filesFetched++;
          // Use the lenient parser so a single bad sheet doesn't poison the
          // whole quarter — each bad sheet only loses its own day's EUR row.
          const { records, skipped } = parseEurWorkbookSafe(result.body, filename);
          allRecords.push(...records);
          if (skipped.length > 0) {
            for (const s of skipped) {
              errors.push(`${filename}#${s.sheet}: ${s.reason}`);
            }
            log.warn(
              { url, filename, records: records.length, skipped: skipped.map((s) => s.sheet) },
              'parsed EUR quarter with some skipped sheets',
            );
          } else {
            log.info(
              { url, filename, records: records.length },
              'parsed EUR quarter',
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${filename}: ${msg}`);
          log.warn({ url, err: msg }, 'failed to ingest EUR quarter');
        }
      }),
    );
  }
  await Promise.all(tasks);

  const rows = allRecords.map(toNewRate);
  const upserted = await batchedUpsert(d, rows);

  log.info(
    { records: allRecords.length, upserted, filesFetched, errors: errors.length },
    'EUR history ingest complete',
  );
  return { filesFetched, rowsUpserted: upserted, records: allRecords.length, errors };
}

/** Daily ingest: scrape the BCV homepage and upsert today's USD + EUR rate. */
export async function ingestFromHomepage(d: Database): Promise<IngestSummary> {
  const log = logger().child({ source: 'daily-scrape' });
  const records = await scrapeBcvHomepage();
  const rows = records.map(toNewRate);
  const upserted = await batchedUpsert(d, rows);
  log.info(
    { records: records.length, upserted, dates: records.map((r) => r.date) },
    'homepage scrape complete',
  );
  return { filesFetched: 1, rowsUpserted: upserted, records: records.length, errors: [] };
}

/** Single-quarter EUR refresh used by the daily job to capture late-publish corrections. */
export async function ingestCurrentEurQuarter(
  d: Database,
  year: number,
  quarter: 'a' | 'b' | 'c' | 'd',
): Promise<IngestSummary> {
  const url = eurQuarterUrl(year, quarter);
  const filename = `2_1_2${quarter}${String(year % 100).padStart(2, '0')}_otrasmonedas.xls`;
  const log = logger().child({ source: 'eur-current-quarter' });
  const result = await fetchBcv(url, { allow404: true });
  if (!result) {
    log.warn({ url }, 'current EUR quarter returned 404');
    return { filesFetched: 0, rowsUpserted: 0, records: 0, errors: [] };
  }
  const records = parseEurWorkbook(result.body, filename);
  const upserted = await batchedUpsert(d, records.map(toNewRate));
  log.info({ filename, records: records.length, upserted }, 'EUR quarter refresh');
  return { filesFetched: 1, rowsUpserted: upserted, records: records.length, errors: [] };
}

/** Upsert in chunks of 500 to keep individual queries bounded. */
async function batchedUpsert(d: Database, rows: NewRate[], chunkSize = 500): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    total += await upsertRates(d, slice);
  }
  return total;
}
