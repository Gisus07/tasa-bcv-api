import { OpenAPIHono } from '@hono/zod-openapi';
import { ratesLatest } from './rates.latest.js';
import { ratesByDate } from './rates.byDate.js';
import { ratesRange } from './rates.range.js';
import { ratesUsd } from './rates.usd.js';
import { ratesEur } from './rates.eur.js';
import { lastUpdated } from './lastUpdated.js';
import { adminTriggerIngest } from './admin.triggerIngest.js';

/** Mounts every v1 route under a single OpenAPIHono so they share the spec. */
export function buildV1(): OpenAPIHono {
  const v1 = new OpenAPIHono();
  // IMPORTANT: register specific routes (rates/latest, rates/range, rates/usd,
  // rates/eur, last-updated, admin/*) BEFORE the catch-all `/rates/{date}` to
  // keep static paths from being captured as date params.
  v1.route('/', ratesLatest);
  v1.route('/', ratesRange);
  v1.route('/', ratesUsd);
  v1.route('/', ratesEur);
  v1.route('/', lastUpdated);
  v1.route('/', adminTriggerIngest);
  v1.route('/', ratesByDate);
  return v1;
}
