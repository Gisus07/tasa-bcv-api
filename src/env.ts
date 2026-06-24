import { z } from 'zod';

const booleanFromString = z
  .union([
    z.literal('true'),
    z.literal('false'),
    z.literal('1'),
    z.literal('0'),
    z.literal(''),
  ])
  .transform((v) => v === 'true' || v === '1');

const cronExpression = z
  .string()
  .min(1)
  .regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/, 'Expected a 5-field cron expression');

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  TZ: z.string().default('America/Caracas'),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().url(),

  BCV_USD_URL: z
    .string()
    .url()
    .default(
      'https://www.bcv.org.ve/sites/default/files/indicadores_sector_externo/2_1_1_tdc.xlsx',
    ),
  BCV_EUR_URL_TEMPLATE: z
    .string()
    .min(1)
    .default(
      'https://www.bcv.org.ve/sites/default/files/EstadisticasGeneral/2_1_2{trim}{yy}_otrasmonedas.xls',
    ),

  /**
   * Daily ingest at 23:00 Caracas (Mon-Fri). By then the BCV has published the
   * next business day's rate, so the daily captures it and propagates the gap
   * forward up to the day before that future rate — covering weekends and
   * holidays in one shot. Running at 00:00 missed the future rate and left
   * weekends unpropagated until the next weekday cron.
   */
  CRON_DAILY_AT: cronExpression.default('0 23 * * 1-5'),
  CRON_RETRY_AT: cronExpression.default('0 8 * * 1-5'),
  /** Parallel (Binance P2P) snapshot — hourly, every day (it's a 24/7 market). */
  CRON_PARALLEL_AT: cronExpression.default('0 * * * *'),
  /** Intervention check — every 2 min in the 7-9 AM Caracas window (Mon-Fri). */
  CRON_INTERVENTION_AT: cronExpression.default('*/2 7-9 * * 1-5'),

  RUN_BACKFILL_ON_BOOT: booleanFromString.default('false'),

  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),

  /**
   * Number of trusted reverse-proxy hops in front of the app. Used to pick the
   * real client IP from the right of X-Forwarded-For. Railway's edge = 1.
   */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

  ADMIN_TOKEN: z.string().min(32).optional(),

  /** Public base URL advertised in the OpenAPI `servers` block. */
  PUBLIC_BASE_URL: z
    .string()
    .url()
    .default('https://tasa-bcv-api-production.up.railway.app'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function env(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
