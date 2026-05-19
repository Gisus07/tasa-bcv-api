/**
 * Spanish → English translations for the OpenAPI document.
 *
 * The codebase keeps every user-facing string in Spanish (matches the primary
 * audience). At runtime, `/openapi-en.json` produces the same spec with every
 * known Spanish string replaced by its English equivalent.
 *
 * When you add or change a Spanish description in a route or schema, add the
 * matching entry here. Untranslated strings pass through unchanged, so the
 * worst-case failure mode is a mixed-language doc — not a crash.
 */
export const ES_TO_EN: Record<string, string> = {
  // ===== schemas/common.ts =====
  'Fecha ISO YYYY-MM-DD': 'ISO date YYYY-MM-DD',
  'Código ISO 4217 de la moneda': 'ISO 4217 currency code',
  'Filtro de moneda; "all" devuelve ambas': 'Currency filter; "all" returns both',
  'La fecha 2030-01-01 está en el futuro.': 'Date 2030-01-01 is in the future.',
  'La fecha debe estar en formato YYYY-MM-DD y ser un día válido del calendario gregoriano':
    'Date must be in YYYY-MM-DD format and a real Gregorian calendar day',

  // ===== schemas/rates.ts =====
  'Tasa de venta oficial publicada por el BCV': 'Official sell rate published by BCV',
  'Solo aparece cuando el valor fue heredado (fin de semana o feriado). En días con publicación real este campo no se incluye.':
    'Only appears when the value was inherited (weekend or holiday). On days with an actual publication this field is omitted.',
  'Fecha origen de la propagación. Solo presente cuando `is_propagated` lo está.':
    'Origin date for the propagation. Only present when `is_propagated` is.',
  'Solo aparece cuando alguna de las tasas fue propagada (heredada del último día hábil). Lista los códigos ISO de las monedas propagadas.':
    'Only appears when at least one of the rates was propagated (inherited from the previous business day). Lists the ISO codes of the propagated currencies.',
  'Si se omite, devuelve la tasa más reciente disponible.':
    'If omitted, returns the most recent available rate.',
  'Cuando es true, espera a que la ingesta termine antes de responder.':
    'When true, waits for the ingest to finish before responding.',

  // ===== OpenAPI info =====
  'API REST pública del histórico oficial de tasas de cambio del Banco Central de Venezuela (BCV) para USD/VES y EUR/VES. Las tasas se actualizan diariamente a las 00:00 America/Caracas (lun–vie). Las fechas de fin de semana y feriados devuelven tasas propagadas con `is_propagated: true`.':
    'Public REST API for the official Banco Central de Venezuela (BCV) exchange rate history (USD/VES and EUR/VES). Rates are updated daily at 00:00 America/Caracas (Mon–Fri). Weekend and holiday dates return propagated rates with `is_propagated: true`.',

  // ===== tags =====
  'Consultas de tasas de cambio': 'Exchange rate queries',
  'Estado y metadatos': 'Health and metadata',
  'Endpoints administrativos (requieren bearer token)':
    'Administrative endpoints (require bearer token)',

  // ===== routes/v1/rates.latest.ts =====
  'Últimas tasas USD y EUR': 'Most recent USD and EUR rates',
  'Devuelve la tasa publicada más reciente para USD y EUR. Cada moneda puede tener su propia fecha si una se actualizó después que la otra.':
    'Returns the most recent published rate for USD and EUR. Each currency may have its own date if one was updated after the other.',
  'Aún no hay tasas disponibles (ejecutar backfill o daily)':
    'No rates available yet (run backfill or daily)',

  // ===== routes/v1/rates.byDate.ts =====
  'Tasas USD y EUR para una fecha específica': 'USD and EUR rates for a specific date',
  'Devuelve ambas monedas para la fecha indicada. Fines de semana y feriados se devuelven con `propagated_currencies` indicando qué monedas se heredaron del último día hábil.':
    'Returns both currencies for the given date. Weekends and holidays come back with `propagated_currencies` indicating which currencies were inherited from the previous business day.',
  'Tasas para la fecha solicitada': 'Rates for the requested date',
  'Fecha fuera de rango o anterior al histórico disponible':
    'Date out of range or before the available history',
  'No hay tasas para esa fecha (datos aún no ingresados)':
    'No rates for that date (data not yet ingested)',

  // ===== routes/v1/rates.range.ts =====
  'Tasas históricas dentro de un rango (máx 365 días)':
    'Historical rates within a date range (max 365 days)',
  'Devuelve cada registro disponible dentro de `[from, to]`, opcionalmente filtrado por moneda. Los días propagados se incluyen con `is_propagated: true`.':
    'Returns every available record within `[from, to]`, optionally filtered by currency. Propagated days are included with `is_propagated: true`.',
  'Tasas dentro del rango solicitado': 'Rates within the requested range',
  'Rango inválido, demasiado grande, o fecha fuera de límites':
    'Invalid range, range too large, or date out of bounds',

  // ===== routes/v1/rates.usd.ts =====
  'Tasa USD (la más reciente por defecto, o para una fecha dada)':
    'USD rate (latest by default, or for a given date)',
  'Tasa USD': 'USD rate',
  'No se encontró tasa USD': 'No USD rate found',

  // ===== routes/v1/rates.eur.ts =====
  'Tasa EUR (la más reciente por defecto, o para una fecha dada)':
    'EUR rate (latest by default, or for a given date)',
  'Tasa EUR': 'EUR rate',
  'No se encontró tasa EUR': 'No EUR rate found',

  // ===== routes/v1/lastUpdated.ts =====
  'Timestamp de la última ingesta exitosa': 'Timestamp of the last successful ingest',
  'Útil para monitoreo. Si este valor no avanza durante >36h, el job diario probablemente está fallando.':
    'Useful for monitoring. If this value stops advancing for >36 h, the daily job is probably broken.',
  'Detalles del último run exitoso': 'Details of the last successful run',

  // ===== routes/v1/admin.triggerIngest.ts =====
  'Dispara una ingesta diaria manualmente': 'Manually trigger a daily ingest',
  'Endpoint protegido con bearer token que fuerza un daily-update sin esperar al cron. Útil cuando el run programado falla o para refrescar tras un deploy. Devuelve 202 porque el job corre en background.':
    'Bearer-token-protected endpoint that forces a daily-update without waiting for the cron. Useful when the scheduled run failed or to refresh after a deploy. Returns 202 because the job runs in the background.',
  'Job iniciado (o finalizado, si `await=true`)': 'Job started (or finished, if `await=true`)',
  'Token admin faltante o inválido': 'Missing or invalid admin token',

  // ===== routes/health.ts =====
  'Comprobación de disponibilidad de la API y conectividad con la base de datos':
    'API liveness and database reachability check',
  'La API y la base de datos están disponibles': 'The API and the database are reachable',
  'La base de datos no está disponible': 'The database is unreachable',
};

/**
 * Deep-walks a JSON-ish value and replaces every string that appears as a key
 * in `map`. Pure: never mutates the input. Used to produce the EN spec from
 * the canonical ES spec.
 */
export function translateSpec(input: unknown, map: Record<string, string>): unknown {
  function walk(node: unknown): unknown {
    if (typeof node === 'string') return map[node] ?? node;
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  }
  return walk(input);
}
