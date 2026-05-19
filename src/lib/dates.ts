/**
 * Date utilities for the BCV API.
 *
 * Caracas timezone is fixed at UTC-4 (Venezuela does not observe DST).
 * All dates persisted in the DB are pure DATE values (no time) representing
 * the day a rate applies in the local Caracas calendar.
 */

export const CARACAS_TZ = 'America/Caracas';

/** Returns "YYYY-MM-DD" for the current day in Caracas. */
export function todayCaracas(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CARACAS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/** Parses "DD/MM/YYYY" (BCV format) into "YYYY-MM-DD". Throws on invalid input. */
export function parseBCVDate(input: string): string {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`Invalid BCV date format: "${input}" (expected DD/MM/YYYY)`);
  }
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid BCV date: "${input}" (out of range)`);
  }
  const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  if (!isValidISODate(iso)) {
    throw new Error(`Invalid BCV date: "${input}" (not a real calendar day)`);
  }
  return iso;
}

/** Validates that a string is a real "YYYY-MM-DD" date in the Gregorian calendar. */
export function isValidISODate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const [yyyy, mm, dd] = input.split('-').map(Number) as [number, number, number];
  if (mm < 1 || mm > 12) return false;
  const daysInMonth = new Date(Date.UTC(yyyy, mm, 0)).getUTCDate();
  return dd >= 1 && dd <= daysInMonth;
}

/** Adds (or subtracts) calendar days from an ISO date string. */
export function addDays(iso: string, days: number): string {
  if (!isValidISODate(iso)) throw new Error(`Invalid ISO date: "${iso}"`);
  const [yyyy, mm, dd] = iso.split('-').map(Number) as [number, number, number];
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Returns the number of whole days from `from` to `to` (positive if to > from). */
export function diffDays(from: string, to: string): number {
  if (!isValidISODate(from) || !isValidISODate(to)) {
    throw new Error(`Invalid ISO date input: from="${from}", to="${to}"`);
  }
  return isoToUtcDays(to) - isoToUtcDays(from);
}

function isoToUtcDays(iso: string): number {
  const [yyyy, mm, dd] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(yyyy, mm - 1, dd) / 86_400_000;
}

/** Iterates every day from `from` (inclusive) to `to` (inclusive). */
export function* iterateDays(from: string, to: string): Generator<string> {
  if (!isValidISODate(from) || !isValidISODate(to)) {
    throw new Error(`Invalid ISO date input: from="${from}", to="${to}"`);
  }
  let cursor = from;
  while (cursor <= to) {
    yield cursor;
    cursor = addDays(cursor, 1);
  }
}

/** Returns ISO weekday: 1=Mon ... 7=Sun (matches PostgreSQL's `isodow`). */
export function isoDayOfWeek(iso: string): number {
  const [yyyy, mm, dd] = iso.split('-').map(Number) as [number, number, number];
  const jsDay = new Date(Date.UTC(yyyy, mm - 1, dd)).getUTCDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

/** True if the ISO date falls on a Saturday or Sunday. */
export function isWeekend(iso: string): boolean {
  const dow = isoDayOfWeek(iso);
  return dow === 6 || dow === 7;
}

/**
 * Computes the date a BCV announcement applies to.
 *
 * The BCV publishes a rate on day X that applies on day X+1, except when X is
 * a Friday — then it applies on the following Monday (skipping Sat/Sun).
 *
 * Mirrors `notifier.py:fecha_destino_tasa` from the legacy bot.
 */
export function getApplicationDate(announcementIso: string): string {
  const dow = isoDayOfWeek(announcementIso);
  // 5 = Friday → +3 days (Mon); otherwise → +1 day.
  return addDays(announcementIso, dow === 5 ? 3 : 1);
}
