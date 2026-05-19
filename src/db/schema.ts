import { sql } from 'drizzle-orm';
import {
  bigint,
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

/**
 * API keys for the Free tier. The plain-text key is shown to the user only
 * once at creation time; we store an SHA-256 hash so a DB leak can't be
 * used to authenticate against the API. `key_prefix` keeps the first chars
 * (e.g. "tbk_a1b2c3d4") visible so users can identify their own keys.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: serial('id').primaryKey(),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    purpose: text('purpose'),
    tier: varchar('tier', { length: 16 }).notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    requestCount: bigint('request_count', { mode: 'number' }).notNull().default(0),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    check('api_keys_tier_check', sql`${table.tier} IN ('free', 'pro')`),
    check('api_keys_email_format', sql`${table.email} ~* '^[^@]+@[^@]+\\.[^@]+$'`),
    index('api_keys_email_idx').on(table.email),
    index('api_keys_active_idx').on(table.keyHash).where(sql`${table.revokedAt} IS NULL`),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
