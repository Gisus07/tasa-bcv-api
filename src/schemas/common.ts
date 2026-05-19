import { z } from '@hono/zod-openapi';
import { isValidISODate } from '../lib/dates.js';

/** Fecha ISO YYYY-MM-DD representando un día real del calendario gregoriano. */
export const DateString = z
  .string()
  .openapi({ example: '2026-05-14', description: 'Fecha ISO YYYY-MM-DD' })
  .refine((v) => isValidISODate(v), {
    message: 'La fecha debe estar en formato YYYY-MM-DD y ser un día válido del calendario gregoriano',
  });

export const CurrencyEnum = z
  .enum(['USD', 'EUR'])
  .openapi({ description: 'Código ISO 4217 de la moneda' });

export const CurrencyOrAllEnum = z
  .enum(['USD', 'EUR', 'all'])
  .openapi({ description: 'Filtro de moneda; "all" devuelve ambas' });

export type Currency = z.infer<typeof CurrencyEnum>;

export const ErrorResponse = z
  .object({
    error: z.string().openapi({ example: 'La fecha 2030-01-01 está en el futuro.' }),
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
