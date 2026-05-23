import { OpenAPIHono } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ratesLatest } from './rates.latest.js';
import { ratesByDate } from './rates.byDate.js';
import { ratesRange } from './rates.range.js';
import { ratesUsd } from './rates.usd.js';
import { ratesEur } from './rates.eur.js';
import { lastUpdated } from './lastUpdated.js';
import { parallelLatest } from './parallel.latest.js';
import { parallelHistory } from './parallel.history.js';
import { parallelDaily } from './parallel.daily.js';
import { adminTriggerIngest } from './admin.triggerIngest.js';
import { adminReingest } from './admin.reingest.js';
import { adminKeysList } from './admin.keys.list.js';
import { adminKeysRevoke } from './admin.keys.revoke.js';
import { keysRegister } from './keys.register.js';
import { keysMe } from './keys.me.js';
import { keysMeUsage } from './keys.me.usage.js';

/** Mounts every v1 route under a single OpenAPIHono so they share the spec. */
export function buildV1(): OpenAPIHono {
  const v1 = new OpenAPIHono({ defaultHook: defaultZodHook });
  // IMPORTANT: register specific routes (rates/latest, rates/range, rates/usd,
  // rates/eur, last-updated, admin/*) BEFORE the catch-all `/rates/{date}` to
  // keep static paths from being captured as date params.
  v1.route('/', ratesLatest);
  v1.route('/', ratesRange);
  v1.route('/', ratesUsd);
  v1.route('/', ratesEur);
  v1.route('/', lastUpdated);
  v1.route('/', parallelLatest);
  v1.route('/', parallelHistory);
  v1.route('/', parallelDaily);
  v1.route('/', keysRegister);
  v1.route('/', keysMeUsage);
  v1.route('/', keysMe);
  v1.route('/', adminTriggerIngest);
  v1.route('/', adminReingest);
  v1.route('/', adminKeysList);
  v1.route('/', adminKeysRevoke);
  v1.route('/', ratesByDate);
  return v1;
}
