import { setTimeout as sleep } from 'node:timers/promises';
import { Agent, request } from 'undici';
import { UpstreamUnavailableError } from '../../lib/errors.js';
import { logger } from '../../logger.js';

/**
 * The BCV website is served with an invalid (self-signed / mis-chained) TLS
 * certificate. The legacy Python bot worked around this with `verify=False`;
 * we mirror that here with a dedicated undici dispatcher that disables
 * certificate verification only for these requests.
 */
const insecureDispatcher = new Agent({
  connect: { rejectUnauthorized: false },
  // Reasonable timeouts; BCV is occasionally slow under load.
  headersTimeout: 30_000,
  bodyTimeout: 60_000,
});

const DEFAULT_HEADERS: Record<string, string> = {
  // Use a desktop UA. BCV does not actively block scrapers, but some
  // intermediaries strip empty/abusive UAs.
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) tasa-bcv-api/0.1.0',
  Accept: '*/*',
  'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
};

export interface FetchOptions {
  /** Treat 404 as a soft miss (returns null instead of throwing). */
  allow404?: boolean;
  /** Override default headers. */
  headers?: Record<string, string>;
  /** Abort the request after this many ms (in addition to dispatcher timeouts). */
  signal?: AbortSignal;
}

export interface FetchResult {
  body: Buffer;
  contentType: string | undefined;
  lastModified: string | undefined;
}

/** Network-level codes that warrant a retry. 4xx is handled separately below. */
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENETUNREACH',
  'ENETDOWN',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const RETRY_BACKOFF_MS = [500, 1500, 4000];

/** GETs a URL from the BCV site with retries on transient failures. */
export async function fetchBcv(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult | null> {
  let response;
  let attempt = 0;
  const log = logger().child({ component: 'bcv-client', url });

  while (true) {
    try {
      response = await request(url, {
        method: 'GET',
        dispatcher: insecureDispatcher,
        headers: { ...DEFAULT_HEADERS, ...options.headers },
        signal: options.signal,
        // NB: undici@7 removed the `throwOnError` option from request(); the
        // default behaviour is to resolve regardless of status, which is what
        // we want (we inspect statusCode ourselves below).
      });
      break;
    } catch (err) {
      const e = err as { code?: string; cause?: unknown; errors?: unknown } & Error;
      const cause = e.cause as { code?: string; message?: string } | undefined;
      const code = e.code ?? cause?.code;

      const canRetry =
        attempt < RETRY_BACKOFF_MS.length &&
        (code === undefined || RETRYABLE_CODES.has(code) || RETRYABLE_CODES.has(cause?.code ?? ''));

      if (!canRetry) {
        throw new UpstreamUnavailableError(`Network error fetching ${url}`, {
          message: e.message,
          code: e.code,
          causeMessage: cause?.message,
          causeCode: cause?.code,
          attempts: attempt + 1,
          aggregatedErrors: Array.isArray(e.errors)
            ? (e.errors as Error[]).map((sub) => ({
                message: sub.message,
                code: (sub as { code?: string }).code,
              }))
            : undefined,
          stack: e.stack?.split('\n').slice(0, 5).join('\n'),
        });
      }

      const delay = RETRY_BACKOFF_MS[attempt]!;
      log.warn(
        { attempt: attempt + 1, nextDelayMs: delay, code, message: e.message },
        'transient BCV fetch failure; retrying',
      );
      await sleep(delay);
      attempt++;
    }
  }

  const { statusCode, headers, body } = response;

  if (statusCode === 404 && options.allow404) {
    body.destroy();
    return null;
  }
  if (statusCode >= 400) {
    body.destroy();
    throw new UpstreamUnavailableError(
      `BCV returned HTTP ${statusCode} for ${url}`,
      { statusCode, url },
    );
  }

  const buf = Buffer.from(await body.arrayBuffer());
  return {
    body: buf,
    contentType: pickHeader(headers['content-type']),
    lastModified: pickHeader(headers['last-modified']),
  };
}

function pickHeader(h: string | string[] | undefined): string | undefined {
  if (Array.isArray(h)) return h[0];
  return h;
}

/** Test-only: closes the shared dispatcher. */
export async function disposeBcvClient(): Promise<void> {
  await insecureDispatcher.close();
}
