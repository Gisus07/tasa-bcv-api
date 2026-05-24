import { z } from '@hono/zod-openapi';
import { DateString } from './common.js';

/** Latest BCV exchange intervention. The rate is Bs./EUR (independent series). */
export const InterventionLatest = z
  .object({
    date: DateString.openapi({ example: '2026-05-21' }),
    intervention_number: z.string().openapi({ example: '011-26' }),
    currency_pair: z.string().openapi({ example: 'EUR/VES' }),
    rate: z
      .number()
      .positive()
      .openapi({ example: 710.95, description: 'Tipo de cambio de la intervención, Bs. por EUR' }),
    source: z.string().openapi({ example: 'bcv' }),
  })
  .openapi('InterventionLatest');

export const InterventionItem = z
  .object({
    date: DateString,
    intervention_number: z.string().openapi({ example: '011-26' }),
    rate: z.number().positive().openapi({ example: 710.95 }),
  })
  .openapi('InterventionItem');

export const InterventionHistoryResponse = z
  .object({
    from: DateString,
    to: DateString,
    currency_pair: z.string().openapi({ example: 'EUR/VES' }),
    count: z.number().int().nonnegative(),
    interventions: z.array(InterventionItem),
  })
  .openapi('InterventionHistoryResponse');

export const InterventionRangeQuery = z.object({
  from: DateString,
  to: DateString,
});
