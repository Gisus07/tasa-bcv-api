# Changelog

Todas las novedades notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

> Las entradas anteriores a `0.4.0` se reconstruyeron a partir del historial de
> git y de las notas de GitHub Releases.

## [1.1.0](https://github.com/Gisus07/tasa-bcv-api/compare/v1.0.0...v1.1.0) (2026-06-24)


### Features

* add code-quality tooling — ESLint, Prettier, git hooks, CHANGELOG ([#30](https://github.com/Gisus07/tasa-bcv-api/issues/30)) ([2a46af8](https://github.com/Gisus07/tasa-bcv-api/commit/2a46af8675b1f1d7e33aab5ab03a1b49f70e2690))


### Bug Fixes

* **deps:** patch transitive undici 7.x and vite advisories ([#35](https://github.com/Gisus07/tasa-bcv-api/issues/35)) ([ed621bb](https://github.com/Gisus07/tasa-bcv-api/commit/ed621bb5c5ff196a77ad57a2801becfe8b1d716d))
* resolve Dependabot security alerts ([#31](https://github.com/Gisus07/tasa-bcv-api/issues/31)) ([f89e3d0](https://github.com/Gisus07/tasa-bcv-api/commit/f89e3d0795e14a54d3c4912831084f2688a9b60b))

## [Sin publicar]

### Añadido

- Tooling de calidad de código: **ESLint 9** (flat config + `typescript-eslint`,
  type-checked) y **Prettier**, con scripts `lint`, `lint:ci`, `format` y
  `format:check`.
- **Git hooks** sin dependencias (`.githooks`, vía `core.hooksPath`): `pre-commit`
  valida el formato y `pre-push` corre lint + typecheck. Se activan solos al
  instalar mediante el script `prepare`.
- Pasos de **Lint** y **Check formatting** en el workflow de CI.
- Este archivo `CHANGELOG.md`.

## [1.0.0] - 2026-05-24

### Añadido

- **Intervención cambiaria del BCV** como serie de datos independiente: endpoints
  `GET /v1/intervention/latest` y `GET /v1/intervention/history`
  (`currency_pair: "EUR/VES"`), tabla `interventions` y captura cada ~2 min en la
  franja 7–9 AM (lun–vie), guiada por la propagación de tasas (omite feriados y
  fines de semana).
- Seed histórico de las intervenciones desde 2019 (~526 filas) al arranque si la
  tabla está vacía, más el job `pnpm jobs:intervention-backfill`.

Con esto la API queda completa en su alcance v1: tasa oficial BCV (USD/EUR), tasa
paralela (Binance P2P) e intervención cambiaria.

## [0.4.0] - 2026-05-24

### Cambiado

- Rediseño de la captura de tasas oficiales: el job diario pasa a las **23:00**
  (hora Caracas), cuando el BCV ya publicó la fecha-valor del próximo día hábil.
- **Propagación anticipada**: se rellenan fines de semana y feriados hasta el día
  anterior a la próxima tasa real, sin consultar al BCV en días no hábiles.

### Corregido

- `GET /v1/rates/latest` ahora devuelve siempre la fecha de hoy (antes podía
  quedarse en el último día propagado por el cron).

## [0.3.1] - 2026-05-23

### Cambiado

- `GET /v1/parallel/latest` pasa a ser **en vivo**: consulta Binance al vuelo con
  caché en memoria de 30 s y cae al último snapshot almacenado si la fuente falla.

## [0.3.0] - 2026-05-23

### Añadido

- **Tasa paralela USDT/VES** desde Binance P2P (mediana del top-10 de ofertas):
  endpoints `GET /v1/parallel/{latest,history,daily}`, tabla `parallel_rates` y
  snapshot horario. El histórico se construye desde el lanzamiento (no se propaga).

## [0.2.1] - 2026-05-23

### Corregido

- `GET /v1/rates/latest` devuelve la tasa vigente **hoy** y no la del día siguiente
  ya publicada por el BCV.
- Corrección de la propagación de la serie USD (días que heredaban una fecha de
  origen incorrecta).

## [0.2.0] - 2026-05-19

### Seguridad

- Rate-limit propio en el registro de API keys y manejo robusto de
  `X-Forwarded-For` mediante `TRUSTED_PROXY_HOPS` (evita el bypass por spoofing).

### Cambiado

- Endpoint de liveness `GET /health/live` separado del readiness `GET /health`.
- Ventana de propagación adaptativa, índices de base de datos depurados y FK con
  `ON DELETE CASCADE`.
- Migración de los tests de base de datos de `pg-mem` a **Testcontainers**.

## [0.1.0] - 2026-05-19

### Añadido

- Primera versión pública: **API REST del histórico oficial de tasas BCV USD/EUR**
  (`GET /v1/rates/{latest,usd,eur,:date}`, rango e info de última actualización).
- Scraping del BCV con `undici` (tolera el certificado SSL inválido) y parseo de
  XLS/XLSX con SheetJS; cron diario, rate limiting, API keys y documentación
  OpenAPI con Scalar.
- Cobertura histórica: USD desde 2016-01-04 y EUR desde 2020-03-27.

[Sin publicar]: https://github.com/Gisus07/tasa-bcv-api/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Gisus07/tasa-bcv-api/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/Gisus07/tasa-bcv-api/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/Gisus07/tasa-bcv-api/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Gisus07/tasa-bcv-api/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/Gisus07/tasa-bcv-api/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Gisus07/tasa-bcv-api/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Gisus07/tasa-bcv-api/releases/tag/v0.1.0
