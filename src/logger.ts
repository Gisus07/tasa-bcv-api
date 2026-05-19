import { pino } from 'pino';
import { env } from './env.js';

function build() {
  const { NODE_ENV, LOG_LEVEL } = env();
  const isDev = NODE_ENV === 'development';

  return pino({
    level: LOG_LEVEL,
    base: { service: 'tasa-bcv-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        }
      : undefined,
  });
}

let cached: ReturnType<typeof build> | undefined;

export function logger() {
  if (!cached) cached = build();
  return cached;
}
