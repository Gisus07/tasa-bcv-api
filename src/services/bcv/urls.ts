import { env } from '../../env.js';

/** BCV publishes EUR rates one file per quarter; `a`=Q1 ... `d`=Q4. */
const QUARTER_LETTERS = ['a', 'b', 'c', 'd'] as const;
export type QuarterLetter = (typeof QUARTER_LETTERS)[number];

/** Convert a calendar month (1-12) to its BCV quarter letter. */
export function monthToQuarterLetter(month: number): QuarterLetter {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  const idx = Math.floor((month - 1) / 3);
  return QUARTER_LETTERS[idx]!;
}

/** Returns the single URL serving the full USD daily history (2016 → today). */
export function usdHistoryUrl(): string {
  return env().BCV_USD_URL;
}

/** Returns the EUR XLS URL for a specific year + quarter letter. */
export function eurQuarterUrl(year: number, quarter: QuarterLetter): string {
  if (year < 2000 || year > 2100) {
    throw new Error(`Invalid year: ${year}`);
  }
  const yy = String(year % 100).padStart(2, '0');
  return env()
    .BCV_EUR_URL_TEMPLATE.replace('{trim}', quarter)
    .replace('{yy}', yy);
}

/** Returns the EUR XLS URL for the quarter containing the given ISO date. */
export function eurUrlForDate(iso: string): string {
  const [yyyy, mm] = iso.split('-').map(Number) as [number, number, number];
  return eurQuarterUrl(yyyy, monthToQuarterLetter(mm));
}

/**
 * Enumerates every (year, quarter) pair from `fromYear` to `toYear` inclusive,
 * each year having all four quarters in order. Used by the backfill job to
 * try every potential EUR file and tolerate 404s.
 */
export function* enumerateEurQuarters(
  fromYear: number,
  toYear: number,
): Generator<{ year: number; quarter: QuarterLetter; url: string }> {
  for (let year = fromYear; year <= toYear; year++) {
    for (const quarter of QUARTER_LETTERS) {
      yield { year, quarter, url: eurQuarterUrl(year, quarter) };
    }
  }
}

/** BCV homepage URL — used by the daily scraper to fetch the live USD/EUR rate. */
export function bcvHomeUrl(): string {
  return 'https://www.bcv.org.ve/';
}
