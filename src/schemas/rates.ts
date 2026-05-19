import { z } from '@hono/zod-openapi';
import { CurrencyEnum, CurrencyOrAllEnum, DateString } from './common.js';

/**
 * A single rate as returned by the public API. The optional fields only
 * appear when applicable: `is_propagated` and `propagated_from` are present
 * if and only if the value was inherited from a previous business day
 * (e.g. weekend, banking holiday).
 */
export const SingleRate = z
  .object({
    date: DateString,
    currency: CurrencyEnum,
    rate: z
      .number()
      .positive()
      .openapi({ example: 510.7873, description: 'Tasa de venta oficial publicada por el BCV' }),
    is_propagated: z.literal(true).optional().openapi({
      description:
        'Solo aparece cuando el valor fue heredado (fin de semana o feriado). En días con publicación real este campo no se incluye.',
    }),
    propagated_from: DateString.optional().openapi({
      description: 'Fecha origen de la propagación. Solo presente cuando `is_propagated` lo está.',
    }),
  })
  .openapi('SingleRate');

export type SingleRateOutput = z.infer<typeof SingleRate>;

/**
 * USD + EUR for the same date in a flat shape. The `propagated_currencies`
 * array surfaces which (if any) of the two values were carried forward — it
 * only appears when at least one currency was propagated.
 */
export const RatesPair = z
  .object({
    date: DateString,
    usd: z.number().positive().openapi({ example: 510.7873 }),
    eur: z.number().positive().openapi({ example: 598.12171255 }),
    propagated_currencies: z.array(CurrencyEnum).min(1).optional().openapi({
      description:
        'Solo aparece cuando alguna de las tasas fue propagada (heredada del último día hábil). Lista los códigos ISO de las monedas propagadas.',
    }),
  })
  .openapi('RatesPair');

export type RatesPairOutput = z.infer<typeof RatesPair>;

export const RangeQuery = z.object({
  from: DateString,
  to: DateString,
  currency: CurrencyOrAllEnum.optional().default('all'),
});

export const SingleCurrencyQuery = z.object({
  date: DateString.optional().openapi({
    description: 'Si se omite, devuelve la tasa más reciente disponible.',
  }),
});

export const ByDateParams = z.object({
  date: DateString,
});

export const RangeResponse = z
  .object({
    from: DateString,
    to: DateString,
    count: z.number().int().nonnegative(),
    rates: z.array(SingleRate),
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

export const RegisterKeyRequest = z
  .object({
    email: z
      .string()
      .email('El email debe tener un formato válido')
      .max(254)
      .openapi({ example: 'dev@example.com' }),
    name: z
      .string()
      .min(1)
      .max(120)
      .openapi({ example: 'Ana Pérez' }),
    purpose: z
      .string()
      .max(500)
      .optional()
      .openapi({
        example: 'Calculadora de remesas en mi e-commerce',
        description: 'Descripción opcional del uso planeado',
      }),
  })
  .openapi('RegisterKeyRequest');

export const RegisterKeyResponse = z
  .object({
    key: z.string().openapi({
      example: 'tbk_a1b2c3d4e5f6789012345678abcdefabcdefabcdefabcdef',
      description: 'La API key en texto plano. Guárdala AHORA — solo se muestra esta vez.',
    }),
    key_prefix: z.string().openapi({
      example: 'tbk_a1b2c3d4',
      description: 'Prefijo visible que identifica la key (sin exponer el secreto).',
    }),
    tier: z.string().openapi({ example: 'free' }),
    rate_limit_per_minute: z.number().int().positive().openapi({ example: 300 }),
    created_at: z.string().datetime(),
    usage: z.object({
      tip: z.string(),
    }),
  })
  .openapi('RegisterKeyResponse');

export const ApiKeyInfo = z
  .object({
    key_prefix: z.string().openapi({ example: 'tbk_a1b2c3d4' }),
    name: z.string(),
    email: z.string(),
    purpose: z.string().nullable(),
    tier: z.string(),
    created_at: z.string().datetime(),
    last_used_at: z.string().datetime().nullable(),
    request_count: z.number().int().nonnegative(),
  })
  .openapi('ApiKeyInfo');
