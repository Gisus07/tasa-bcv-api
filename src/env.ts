import { z } from 'zod';

const booleanFromString = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal('')])
  .transform((v) => v === 'true' || v === '1');

const cronExpression = z
  .string()
  .min(1)
  .regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/, 'Expected a 5-field cron expression');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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

  CRON_DAILY_AT: cronExpression.default('0 0 * * 1-5'),
  CRON_RETRY_AT: cronExpression.default('0 8 * * 1-5'),

  RUN_BACKFILL_ON_BOOT: booleanFromString.default('false'),

  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),

  /**
   * Number of trusted reverse-proxy hops in front of the app. Used to pick the
   * real client IP from the right of X-Forwarded-For. Railway's edge = 1.
   */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

  ADMIN_TOKEN: z.string().min(32).optional(),
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
