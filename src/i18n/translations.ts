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
  // ===== parallel (Binance P2P, v0.3.0) =====
  'Tasa paralela en vivo (Binance P2P, USDT/VES)': 'Live parallel rate (Binance P2P, USDT/VES)',
  'Tasa paralela actual ("dólar Binance", USDT/VES) consultada en vivo desde Binance P2P (cache de 30s). Mediana del top-10 de ofertas. `buy` = Bs para comprar 1 USDT, `sell` = al vender, `average` = referencia. Si Binance no responde, devuelve el último snapshot horario almacenado.':
    'Current parallel rate ("Binance dollar", USDT/VES) fetched live from Binance P2P (30s cache). Median of the top-10 ads. `buy` = Bs to buy 1 USDT, `sell` = when selling, `average` = reference. If Binance is unreachable, returns the last stored hourly snapshot.',
  'Tasa paralela actual': 'Current parallel rate',
  'Sin datos (Binance no responde y no hay snapshots aún)': 'No data (Binance unreachable and no snapshots yet)',
  'Histórico horario de la tasa paralela': 'Hourly history of the parallel rate',
  'Snapshots horarios de la tasa paralela (Binance P2P) en un rango de fechas (YYYY-MM-DD). Máximo 31 días por request; para rangos mayores usa /v1/parallel/daily.':
    'Hourly snapshots of the parallel rate (Binance P2P) over a date range (YYYY-MM-DD). Max 31 days per request; for larger ranges use /v1/parallel/daily.',
  'Snapshots horarios en el rango': 'Hourly snapshots in the range',
  'Rango inválido o mayor a 31 días': 'Invalid range or larger than 31 days',
  'Agregación diaria (OHLC) de la tasa paralela': 'Daily (OHLC) aggregation of the parallel rate',
  'Velas diarias (open/high/low/close + promedio) de la tasa paralela, agregadas por día del calendario de Caracas. Ideal para gráficas largas. Máximo 365 días por request.':
    'Daily candles (open/high/low/close + average) of the parallel rate, aggregated by Caracas calendar day. Ideal for long charts. Max 365 days per request.',
  'Velas diarias en el rango': 'Daily candles in the range',
  'Rango inválido o mayor a 365 días': 'Invalid range or larger than 365 days',
  'Bs para comprar 1 USDT (mediana top-10)': 'Bs to buy 1 USDT (median of top-10)',
  'Bs al vender 1 USDT (mediana top-10)': 'Bs when selling 1 USDT (median of top-10)',

  // ===== intervention (BCV, v1.0.0) =====
  'Última intervención cambiaria del BCV': 'Latest BCV exchange intervention',
  'Última intervención cambiaria publicada por el BCV, con su tipo de cambio en Bs./EUR. Es una serie INDEPENDIENTE de la tasa oficial USD/EUR. Para saber si hubo intervención hoy, compara el campo `date` con la fecha actual. Solo ocurre en días hábiles; no se propaga.':
    'Latest exchange intervention published by the BCV, with its rate in Bs./EUR. It is an INDEPENDENT series from the official USD/EUR rate. To check whether there was an intervention today, compare the `date` field with the current date. It only happens on business days; it is not propagated.',
  'Última intervención registrada': 'Latest recorded intervention',
  'Aún no hay intervenciones registradas': 'No interventions recorded yet',
  'Histórico de intervenciones cambiarias': 'History of exchange interventions',
  'Intervenciones cambiarias del BCV (tipo de cambio Bs./EUR) en un rango de fechas (YYYY-MM-DD). Máximo 366 días por request. Solo aparecen los días en que el BCV efectivamente intervino.':
    'BCV exchange interventions (rate in Bs./EUR) over a date range (YYYY-MM-DD). Max 366 days per request. Only days on which the BCV actually intervened appear.',
  'Intervenciones en el rango': 'Interventions in the range',
  'Rango inválido o mayor a 366 días': 'Invalid range or larger than 366 days',
  'Tipo de cambio de la intervención, Bs. por EUR': 'Intervention exchange rate, Bs. per EUR',

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
  'API REST pública del histórico oficial de tasas de cambio del Banco Central de Venezuela (BCV) para USD/VES y EUR/VES. Las tasas se actualizan diariamente a las 23:00 America/Caracas (lun–vie). Las fechas de fin de semana y feriados devuelven tasas propagadas con `is_propagated: true`.':
    'Public REST API for the official Banco Central de Venezuela (BCV) exchange rate history (USD/VES and EUR/VES). Rates are updated daily at 23:00 America/Caracas (Mon–Fri). Weekend and holiday dates return propagated rates with `is_propagated: true`.',

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

  // ===== routes/v1/keys.* =====
  'Gestión de API keys del tier Free': 'Free-tier API key management',
  'Crear una API key del tier Free (gratis)': 'Create a Free-tier API key',
  'Auto-registro público. Devuelve la API key en texto plano UNA SOLA VEZ. Guárdala — no la podemos mostrar de nuevo, solo el prefijo visible. La key da derecho a 300 req/min (vs 30 req/min sin key). Sin verificación de email por ahora — si abusan, se revoca.':
    'Public self-registration. Returns the API key in plaintext ONLY ONCE. Save it — we can\'t show it again, only the visible prefix. The key grants 300 req/min (vs 30 req/min without a key). No email verification for now — abusers get revoked.',
  'API key creada. Guarda `key` ahora mismo — solo se muestra una vez.':
    'API key created. Save `key` right now — it is shown only once.',
  'Entrada inválida (email mal formado, campos faltantes, etc.)':
    'Invalid input (malformed email, missing fields, etc.)',
  'La API key en texto plano. Guárdala AHORA — solo se muestra esta vez.':
    'The plaintext API key. Save it NOW — shown only this time.',
  'Prefijo visible que identifica la key (sin exponer el secreto).':
    'Visible prefix that identifies the key (without exposing the secret).',
  'Descripción opcional del uso planeado': 'Optional description of the intended use',
  'El email debe tener un formato válido': 'Email must have a valid format',
  'Info de mi API key': 'Info about my API key',
  'Devuelve metadata de la key que se está usando para autenticar la llamada: prefijo visible, nombre, email, tier, fecha de creación, última vez usada y request count.':
    'Returns metadata for the key authenticating the call: visible prefix, name, email, tier, creation date, last used timestamp, and request count.',
  'Información de la API key': 'API key information',
  'Falta API key o es inválida': 'Missing or invalid API key',

  // ===== admin keys list / revoke =====
  'Listar todas las API keys (activas y revocadas)':
    'List every API key (active and revoked)',
  'Devuelve metadata de todas las keys ordenadas por fecha de creación descendente. Limitado a 100 por respuesta. No incluye la key en texto plano — solo el prefijo visible y el resto de campos.':
    'Returns metadata for every key ordered by creation date descending. Capped at 100 per response. Does not include the plaintext key — only the visible prefix and the other fields.',
  'Listado de keys': 'Keys listing',
  'Revocar una API key por ID': 'Revoke an API key by ID',
  'Soft-delete: marca la key como revocada (`revoked_at = now()`). La key revocada deja de autenticar de inmediato — siguientes requests con ella devuelven 401. Operación idempotente: revocar una key ya revocada responde 404 NOT_FOUND.':
    'Soft-delete: marks the key as revoked (`revoked_at = now()`). The revoked key stops authenticating immediately — subsequent requests with it return 401. Idempotent: revoking an already-revoked key returns 404 NOT_FOUND.',
  'Key revocada': 'Key revoked',
  'Key no encontrada o ya estaba revocada': 'Key not found or already revoked',

  // ===== auto-revoke =====
  'Revocar mi propia API key': 'Revoke my own API key',
  'El dueño de la key se auto-revoca. La key deja de funcionar de inmediato — siguientes requests con ella devuelven 401. Operación idempotente y final: una vez revocada, no se puede reactivar; hay que registrar una nueva.':
    'The key owner self-revokes. The key stops working immediately — subsequent requests with it return 401. Idempotent and final: once revoked it cannot be reactivated; a new one must be registered.',

  // ===== NotFound + generic error messages =====
  'Aún no hay tasas disponibles. Ejecuta el backfill o el job diario primero.':
    'No rates available yet. Run the backfill or daily job first.',
  'Recurso no encontrado': 'Resource not found',
  'Credenciales faltantes o inválidas': 'Missing or invalid credentials',
  'Demasiadas solicitudes': 'Too many requests',
  'Demasiadas solicitudes. Por favor reduce el ritmo.':
    'Too many requests. Please slow down.',
  'Base de datos no disponible': 'Database is unreachable',
  'Entrada inválida': 'Invalid input',
  'Error interno del servidor': 'Internal server error',
  'Solicitud fallida': 'Request failed',

  // ===== usage histogram =====
  'Histograma diario de uso de mi API key': 'Daily usage histogram for my API key',
  'Devuelve el conteo de requests por día en la ventana solicitada (default 30 días). Los días sin requests no aparecen — el cliente debe asumir 0 para los faltantes si necesita una serie completa. Ideal para gráficas de uso semanales o mensuales.':
    'Returns the request count per day within the requested window (default 30 days). Days with no requests are absent — clients should assume 0 for missing ones if a full series is needed. Ideal for weekly or monthly usage charts.',
  'Histograma diario': 'Daily histogram',
  'Días hacia atrás a incluir (1-365). Default 30.':
    'Days back to include (1-365). Default 30.',
  'Ventana solicitada': 'Window requested',
  'Suma de requests en la ventana (no incluye días sin uso, esos no se almacenan).':
    'Sum of requests in the window (days without traffic are not stored).',
  'Días con uso, ordenados de más reciente a más antiguo. Días sin uso no aparecen.':
    'Days with traffic, ordered most recent first. Days without traffic are absent.',
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
