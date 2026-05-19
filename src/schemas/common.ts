import { z } from '@hono/zod-openapi';
import { isValidISODate } from '../lib/dates.js';

/** A valid ISO date string (YYYY-MM-DD) representing a Gregorian calendar day. */
export const DateString = z
  .string()
  .openapi({ example: '2026-05-14', description: 'ISO date YYYY-MM-DD' })
  .refine((v) => isValidISODate(v), {
    message: 'Date must be YYYY-MM-DD and a real Gregorian calendar day',
  });

export const CurrencyEnum = z
  .enum(['USD', 'EUR'])
  .openapi({ description: 'Currency ISO 4217 code' });

export const CurrencyOrAllEnum = z
  .enum(['USD', 'EUR', 'all'])
  .openapi({ description: 'Currency filter; "all" returns both' });

export type Currency = z.infer<typeof CurrencyEnum>;

export const ErrorResponse = z
  .object({
    error: z.string().openapi({ example: 'Date 2030-01-01 is in the future.' }),
    code: z.string().openapi({ example: 'DATE_OUT_OF_RANGE' }),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('ErrorResponse');

export const HealthResponse = z
  .object({
    status: z.literal('ok'),
    db: z.literal('reachable'),
    uptimeSeconds: z.number().nonnegative(),
  })
  .openapi('HealthResponse');
