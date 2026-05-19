import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Daily BCV exchange rate for a single currency.
 * Primary key is (date, currency) to keep one row per day per currency.
 */
export const rates = pgTable(
  'rates',
  {
    /** Day the rate applies in the Caracas calendar (DATE, no time). */
    date: date('date').notNull(),
    /** ISO 4217 code: 'USD' or 'EUR'. */
    currency: varchar('currency', { length: 3 }).notNull(),
    /** Tasa VENTA published by BCV (Bs per 1 unit of currency). */
    rate: numeric('rate', { precision: 18, scale: 8 }).notNull(),
    /** Always 'BCV' in v1; reserved for future alt sources. */
    source: varchar('source', { length: 8 }).notNull().default('BCV'),
    /** XLS filename, scraper id, or 'propagated' when is_propagated is true. */
    sourceFile: text('source_file').notNull(),
    /** Date BCV published the rate (differs from `date` when announcement applies next business day). */
    publishedAt: date('published_at'),
    /** True if the row was filled in to cover a weekend/holiday gap. */
    isPropagated: boolean('is_propagated').notNull().default(false),
    /** When is_propagated=true, the original date the rate was inherited from. */
    propagatedFrom: date('propagated_from'),
    /** Server-side timestamp when this row was last written. */
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.currency] }),
    check('rates_currency_check', sql`${table.currency} IN ('USD', 'EUR')`),
    check('rates_rate_positive', sql`${table.rate} > 0`),
    index('rates_date_idx').on(table.date.desc()),
    index('rates_currency_date_idx').on(table.currency, table.date.desc()),
  ],
);

export type Rate = typeof rates.$inferSelect;
export type NewRate = typeof rates.$inferInsert;

/**
 * One row per ingest job execution. Used to detect overlapping runs (lock),
 * surface the last successful run for `/v1/last-updated`, and capture errors.
 */
export const ingestRuns = pgTable('ingest_runs', {
  id: serial('id').primaryKey(),
  /** 'backfill' | 'daily' | 'retry' | 'manual'. */
  jobType: varchar('job_type', { length: 16 }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  /** 'running' | 'ok' | 'error'. */
  status: varchar('status', { length: 16 }).notNull(),
  rowsUpserted: integer('rows_upserted').notNull().default(0),
  filesFetched: integer('files_fetched').notNull().default(0),
  errorMessage: text('error_message'),
});

export type IngestRun = typeof ingestRuns.$inferSelect;
export type NewIngestRun = typeof ingestRuns.$inferInsert;
