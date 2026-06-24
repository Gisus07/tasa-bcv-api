import { z } from '@hono/zod-openapi';
import { DateString } from './common.js';

/** Latest parallel (Binance P2P) snapshot. */
export const ParallelLatest = z
  .object({
    timestamp: z
      .string()
      .datetime()
      .openapi({ example: '2026-05-23T17:00:00.000Z' }),
    currency_pair: z.string().openapi({ example: 'USDT/VES' }),
    buy: z.number().positive().openapi({
      example: 722.5,
      description: 'Bs para comprar 1 USDT (mediana top-10)',
    }),
    sell: z.number().positive().openapi({
      example: 721.1,
      description: 'Bs al vender 1 USDT (mediana top-10)',
    }),
    average: z.number().positive().openapi({ example: 721.8 }),
    source: z.string().openapi({ example: 'binance_p2p' }),
  })
  .openapi('ParallelLatest');

export const ParallelSnapshot = z
  .object({
    timestamp: z.string().datetime(),
    buy: z.number().positive(),
    sell: z.number().positive(),
    average: z.number().positive(),
  })
  .openapi('ParallelSnapshot');

export const ParallelHistoryResponse = z
  .object({
    from: DateString,
    to: DateString,
    count: z.number().int().nonnegative(),
    snapshots: z.array(ParallelSnapshot),
  })
  .openapi('ParallelHistoryResponse');

export const ParallelDailyItem = z
  .object({
    date: DateString,
    open: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    close: z.number().positive(),
    average: z.number().positive(),
  })
  .openapi('ParallelDailyItem');

export const ParallelDailyResponse = z
  .object({
    from: DateString,
    to: DateString,
    count: z.number().int().nonnegative(),
    days: z.array(ParallelDailyItem),
  })
  .openapi('ParallelDailyResponse');

export const ParallelRangeQuery = z.object({
  from: DateString,
  to: DateString,
});
