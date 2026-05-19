import { and, asc, desc, eq, gt, gte, lte, lt, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { ingestRuns, rates, type IngestRun, type NewIngestRun, type NewRate, type Rate } from './schema.js';

export type Currency = 'USD' | 'EUR';

export async function getLatest(d: Database, currency: Currency): Promise<Rate | undefined> {
  const rows = await d
    .select()
    .from(rates)
    .where(eq(rates.currency, currency))
    .orderBy(desc(rates.date))
    .limit(1);
  return rows[0];
}

export async function getByDate(
  d: Database,
  date: string,
  currency: Currency,
): Promise<Rate | undefined> {
  const rows = await d
    .select()
    .from(rates)
    .where(and(eq(rates.date, date), eq(rates.currency, currency)))
    .limit(1);
  return rows[0];
}

export async function getRange(
  d: Database,
  from: string,
  to: string,
  currency?: Currency,
): Promise<Rate[]> {
  const conditions = currency
    ? and(gte(rates.date, from), lte(rates.date, to), eq(rates.currency, currency))
    : and(gte(rates.date, from), lte(rates.date, to));

  return d.select().from(rates).where(conditions).orderBy(asc(rates.date), asc(rates.currency));
}

/** Most recent rate strictly before `date`. Used to backfill gaps. */
export async function getLastBefore(
  d: Database,
  date: string,
  currency: Currency,
): Promise<Rate | undefined> {
  const rows = await d
    .select()
    .from(rates)
    .where(and(lt(rates.date, date), eq(rates.currency, currency)))
    .orderBy(desc(rates.date))
    .limit(1);
  return rows[0];
}

/** Earliest date in the DB for a currency (used to validate DATE_BEFORE_HISTORY). */
export async function getEarliestDate(
  d: Database,
  currency: Currency,
): Promise<string | undefined> {
  const rows = await d
    .select({ date: rates.date })
    .from(rates)
    .where(eq(rates.currency, currency))
    .orderBy(asc(rates.date))
    .limit(1);
  return rows[0]?.date;
}

/**
 * Idempotent batch upsert. On conflict, updates only when the rate or
 * propagation flag actually changed, avoiding gratuitous writes.
 */
export async function upsertRates(d: Database, batch: NewRate[]): Promise<number> {
  if (batch.length === 0) return 0;

  // PostgreSQL rejects an INSERT ... ON CONFLICT DO UPDATE when the same
  // (date, currency) appears twice in the VALUES list. This happens during
  // backfill because each EUR quarterly file contains a "Fecha Valor" that
  // crosses into the next quarter (the last business day of Q1 has a Fecha
  // Valor in Q2, etc.). Dedupe in-process, last-wins.
  const dedupedMap = new Map<string, NewRate>();
  for (const row of batch) {
    dedupedMap.set(`${row.date}:${row.currency}`, row);
  }
  const deduped = [...dedupedMap.values()];

  const inserted = await d
    .insert(rates)
    .values(deduped)
    .onConflictDoUpdate({
      target: [rates.date, rates.currency],
      set: {
        rate: sql`excluded.rate`,
        source: sql`excluded.source`,
        sourceFile: sql`excluded.source_file`,
        publishedAt: sql`excluded.published_at`,
        isPropagated: sql`excluded.is_propagated`,
        propagatedFrom: sql`excluded.propagated_from`,
        updatedAt: sql`now()`,
      },
      setWhere: sql`${rates.rate} IS DISTINCT FROM excluded.rate
                 OR ${rates.isPropagated} IS DISTINCT FROM excluded.is_propagated`,
    })
    .returning({ date: rates.date });

  // `inserted.length` is the number of rows ON CONFLICT actually affected:
  // brand-new rows plus rows whose rate or propagation flag changed. Rows
  // that already had the same value are skipped by `setWhere` and do not
  // appear in the result — that is the desired idempotent behaviour.
  return inserted.length;
}

export async function startIngestRun(
  d: Database,
  jobType: NewIngestRun['jobType'],
): Promise<number> {
  const rows = await d
    .insert(ingestRuns)
    .values({ jobType, status: 'running' })
    .returning({ id: ingestRuns.id });
  return rows[0]!.id;
}

export async function completeIngestRun(
  d: Database,
  id: number,
  status: 'ok' | 'error',
  rowsUpserted: number,
  filesFetched: number,
  errorMessage?: string,
): Promise<void> {
  await d
    .update(ingestRuns)
    .set({
      status,
      rowsUpserted,
      filesFetched,
      finishedAt: sql`now()`,
      ...(errorMessage ? { errorMessage } : {}),
    })
    .where(eq(ingestRuns.id, id));
}

/** True if there is a 'running' ingest_run started within the last `withinMinutes`. */
export async function hasActiveIngestRun(
  d: Database,
  withinMinutes: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinMinutes * 60_000);
  const rows = await d
    .select({ id: ingestRuns.id })
    .from(ingestRuns)
    .where(and(eq(ingestRuns.status, 'running'), gt(ingestRuns.startedAt, cutoff)))
    .limit(1);
  return rows.length > 0;
}

/** Last successful ingest run, used by GET /v1/last-updated. */
export async function getLastSuccessfulRun(d: Database): Promise<IngestRun | undefined> {
  const rows = await d
    .select()
    .from(ingestRuns)
    .where(eq(ingestRuns.status, 'ok'))
    .orderBy(desc(ingestRuns.finishedAt))
    .limit(1);
  return rows[0];
}
