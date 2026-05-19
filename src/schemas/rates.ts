import { z } from '@hono/zod-openapi';
import { CurrencyEnum, CurrencyOrAllEnum, DateString } from './common.js';

/** A single rate as returned by the public API. */
export const RateRecord = z
  .object({
    date: DateString,
    currency_pair: z
      .enum(['USD/VES', 'EUR/VES'])
      .openapi({ example: 'USD/VES', description: 'Quoted pair' }),
    rate: z
      .number()
      .positive()
      .openapi({ example: 510.7873, description: 'Tasa de venta oficial publicada por el BCV' }),
    source: z
      .literal('BCV')
      .openapi({ description: 'Always "BCV" in v1; reserved for future alt sources' }),
    source_file: z
      .string()
      .openapi({
        example: '2_1_1_tdc.xlsx#2026',
        description: 'Provenance: source file + sheet, or "scraper:bcv-home", or "propagated"',
      }),
    is_propagated: z
      .boolean()
      .openapi({
        description:
          'True when this row was carried forward (weekend, holiday, gap). Means the BCV did not publish a new rate on that date and the value is inherited from `propagated_from`.',
      }),
    propagated_from: DateString.nullable().openapi({
      description: 'When is_propagated is true, the date the rate was inherited from',
    }),
    published_at: DateString.nullable().openapi({
      description:
        'When known (EUR only), the date BCV published the rate. Differs from `date` since the BCV publishes today the rate that applies tomorrow.',
    }),
    fetched_at: z.string().datetime().openapi({
      example: '2026-05-19T04:00:00.000Z',
      description: 'Server-side timestamp when this row was last written',
    }),
  })
  .openapi('RateRecord');

export type RateRecordOutput = z.infer<typeof RateRecord>;

/** Pair of USD + EUR rates for the same date. Used by /latest and /by-date. */
export const RatesPair = z
  .object({
    date: DateString,
    usd: RateRecord,
    eur: RateRecord,
  })
  .openapi('RatesPair');

export const RangeQuery = z.object({
  from: DateString,
  to: DateString,
  currency: CurrencyOrAllEnum.optional().default('all'),
});

export const SingleCurrencyQuery = z.object({
  date: DateString.optional().openapi({
    description: 'If omitted, returns the most recent rate.',
  }),
});

export const ByDateParams = z.object({
  date: DateString,
});

export const CurrencyParams = z.object({
  currency: CurrencyEnum,
});

export const RangeResponse = z
  .object({
    from: DateString,
    to: DateString,
    count: z.number().int().nonnegative(),
    rates: z.array(RateRecord),
  })
  .openapi('RangeResponse');

export const LastUpdatedResponse = z
  .object({
    last_successful_run_at: z.string().datetime().nullable(),
    last_successful_job_type: z.string().nullable(),
    rows_upserted: z.number().int().nonnegative().nullable(),
  })
  .openapi('LastUpdatedResponse');

export const TriggerIngestResponse = z
  .object({
    job_type: z.string(),
    started: z.boolean(),
    message: z.string(),
  })
  .openapi('TriggerIngestResponse');
