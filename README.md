# tasa-bcv-api

> API REST pública y gratuita con el histórico oficial de tasas USD/VES y EUR/VES del Banco Central de Venezuela.

[![status](https://img.shields.io/badge/status-live-brightgreen)](https://tasa-bcv-api-production.up.railway.app/docs)
[![CI](https://github.com/Gisus07/tasa-bcv-api/actions/workflows/ci.yml/badge.svg)](https://github.com/Gisus07/tasa-bcv-api/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Gisus07/tasa-bcv-api?color=blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-22%20LTS-brightgreen)](https://nodejs.org/)
[![Last commit](https://img.shields.io/github/last-commit/Gisus07/tasa-bcv-api)](https://github.com/Gisus07/tasa-bcv-api/commits/main)
[![Legacy bot](https://img.shields.io/badge/v0--legacy-Telegram%20Bot-lightgrey)](https://github.com/Gisus07/tasa-bcv-api/tree/v0-legacy-python-bot)

---

## 🟢 En producción

```
https://tasa-bcv-api-production.up.railway.app
```

- 📚 **Docs interactivas:** [/docs](https://tasa-bcv-api-production.up.railway.app/docs)
- 📄 **OpenAPI spec:** [/openapi.json](https://tasa-bcv-api-production.up.railway.app/openapi.json)
- ❤️ **Healthcheck:** [/health](https://tasa-bcv-api-production.up.railway.app/health)

**Ejemplos rápidos** (datos reales en vivo):

```bash
# Última tasa publicada
curl https://tasa-bcv-api-production.up.railway.app/v1/rates/latest

# Tasa de un día específico
curl https://tasa-bcv-api-production.up.railway.app/v1/rates/2026-05-14
# → USD 510.7873 / EUR 598.12171255

# Rango histórico
curl "https://tasa-bcv-api-production.up.railway.app/v1/rates/range?from=2026-05-01&to=2026-05-19&currency=USD"

# Solo USD del día
curl https://tasa-bcv-api-production.up.railway.app/v1/rates/usd
```

---

## ¿Por qué existe?

Venezuela no tiene una API oficial del BCV. Cada equipo termina escribiendo su propio scraper para obtener la tasa del Bolívar contra USD y EUR, lo que:

- **Duplica trabajo** en toda la industria local de software.
- **Se rompe** cada vez que el BCV cambia algo en su HTML.
- **No expone histórico** — solo la tasa del día.
- **Bloquea integraciones** con e-commerce, calculadoras de remesas, ERPs, exchanges, etc.

Este proyecto es una **API REST pública, gratuita y mantenida** que resuelve eso de una vez.

## 🚀 Lo que ofrece

| Capacidad | Detalle |
|---|---|
| Tasa del día | USD/VES y EUR/VES actualizadas automáticamente a las 00:00 Caracas (lun-vie) |
| Histórico completo | USD desde **enero 2016**, EUR desde **marzo 2020** (los archivos oficiales del BCV) |
| Rangos de fechas | Hasta 365 días por request, ideal para análisis y gráficos |
| Sin scraping | Las fuentes son los XLS oficiales del BCV + un scraping mínimo de la homepage para la tasa del día |
| Propagación inteligente | Fines de semana y feriados heredan la última tasa hábil — el campo `propagated_currencies` lo señala |
| Documentación bilingüe | `/docs` en español por defecto, `/docs/en` en inglés, auto-detect por `Accept-Language` |
| Code samples integrados | Snippets listos en curl, JavaScript, TypeScript, Python, PHP y Go en la doc |
| API keys gratuitas | Registro abierto en `/v1/keys/register` para subir el límite a 300 req/min |
| Rate limit por tier | 30 req/min sin key, 300 req/min con key registrada |

## 📡 Endpoints (v1)

| Método | Path | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | – | Liveness + DB check |
| `GET` | `/docs`, `/docs/es`, `/docs/en` | – | Documentación interactiva (Scalar). Auto-detect de idioma. |
| `GET` | `/openapi.json`, `/openapi-en.json` | – | Especificación OpenAPI 3.1 (ES/EN) |
| `GET` | `/v1/rates/latest` | opcional | Últimas tasas USD y EUR |
| `GET` | `/v1/rates/{date}` | opcional | Tasas USD y EUR para una fecha (`YYYY-MM-DD`) |
| `GET` | `/v1/rates/range?from&to&currency` | opcional | Rango histórico (max 365 días) |
| `GET` | `/v1/rates/usd?date=` | opcional | Solo USD (latest si omites `date`) |
| `GET` | `/v1/rates/eur?date=` | opcional | Solo EUR |
| `GET` | `/v1/last-updated` | – | Timestamp del último ingest exitoso |
| `POST` | `/v1/keys/register` | – | Registrar API key (gratis, instantáneo) |
| `GET` | `/v1/keys/me` | **key** | Metadata de mi key |
| `GET` | `/v1/keys/me/usage?days=` | **key** | Histograma diario de uso |
| `DELETE` | `/v1/keys/me` | **key** | Auto-revoke de la key |
| `POST` | `/v1/admin/trigger-ingest` | **admin** | Disparar ingest manual |
| `GET` | `/v1/admin/keys` | **admin** | Listar todas las keys |
| `POST` | `/v1/admin/keys/{id}/revoke` | **admin** | Revocar key específica |

> **Auth**: "opcional" = la API key sube tu rate limit pero no es obligatoria. "key" = requiere `Authorization: Bearer tbk_...`. "admin" = requiere `Authorization: Bearer $ADMIN_TOKEN`.

## ⚠️ Sobre el histórico pre-redenominación

El **1 de octubre de 2021** el BCV redenominó el bolívar eliminando 6 ceros: `1.000.000 Bs.S → 1 Bs.D`. La API devuelve **el valor exacto que el BCV publicó en cada época**, sin transformaciones. Esto significa que las tasas anteriores a octubre 2021 están en la escala antigua (Bolívar Soberano).

Ejemplo:

| Fecha | USD/VES | EUR/VES | Escala |
|---|---|---|---|
| 2020-03-27 | 73,830.16 | 81,349.03 | Bs.S (Soberano) |
| 2022-01-03 | 4.59 | 5.21 | Bs.D (Digital) |
| 2026-05-14 | 510.79 | 598.12 | Bs.D (Digital) |

Para comparar tasas pre y post-redenominación, divide los valores antiguos entre 1,000,000.

## 🛠️ Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | [Hono](https://hono.dev/) + [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) |
| Validación | [Zod](https://zod.dev/) |
| DB | PostgreSQL 16 + [Drizzle ORM](https://orm.drizzle.team/) |
| HTTP / Scraping | [undici](https://undici.nodejs.org/) + [cheerio](https://cheerio.js.org/) |
| Parseo XLS | [SheetJS](https://sheetjs.com/) |
| Scheduling | [node-cron](https://github.com/node-cron/node-cron) (TZ America/Caracas) |
| Rate limit | [`hono-rate-limiter`](https://github.com/rhinobase/hono-rate-limiter) |
| Logger | [pino](https://getpino.io/) |
| Docs UI | [Scalar](https://scalar.com/) |
| Tests | [vitest](https://vitest.dev/) |
| Deploy | [Railway](https://railway.com/) |

## 👨‍💻 Desarrollo local

Requisitos: Node 22+, pnpm, Docker (para Postgres local).

```bash
# Setup
git clone https://github.com/Gisus07/tasa-bcv-api.git
cd tasa-bcv-api
pnpm install
cp .env.example .env  # editar DATABASE_URL y ADMIN_TOKEN

# Postgres local con Docker
docker run -d --name tasa-bcv-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tasa_bcv_api postgres:16

# Migraciones + backfill inicial
pnpm db:migrate
pnpm jobs:backfill

# Run
pnpm dev
```

Comandos útiles:

```bash
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest run
pnpm jobs:backfill      # carga histórica USD + EUR
pnpm jobs:daily         # ingest manual del día
pnpm build              # compila a dist/
```

## 📜 Versión anterior

Este repo nació como un **bot de Telegram** ([@IntervencionBCVbot](https://t.me/IntervencionBCVbot)) que notificaba intervenciones cambiarias del BCV. Operó desde su creación como proyecto académico hasta **agosto de 2025**, cuando cumplió su propósito.

El código del bot está preservado en:

- **Tag**: [`v0-legacy-python-bot`](https://github.com/Gisus07/tasa-bcv-api/releases/tag/v0-legacy-python-bot)
- **Branch**: [`legacy/python-bot`](https://github.com/Gisus07/tasa-bcv-api/tree/legacy/python-bot)
- **Carpeta**: [`legacy/python-bot/`](./legacy/python-bot/) (en `main`)

## 🤝 Contribuciones

Issues y PRs son bienvenidos. Lee [CONTRIBUTING.md](.github/CONTRIBUTING.md) si vas a abrir un PR.

Si encuentras una vulnerabilidad de seguridad, no abras un issue público — lee [SECURITY.md](.github/SECURITY.md).

## 📄 Licencia

Distribuido bajo [AGPL-3.0-or-later](LICENSE). El código es libre. Si despliegas una versión modificada como servicio público, debes publicar tus cambios bajo la misma licencia.

> No estamos afiliados al Banco Central de Venezuela. Las tasas son obtenidas de los datos oficiales que el BCV publica en su sitio web.
