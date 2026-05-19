# tasa-bcv-api

> API REST pública y abierta para consultar el histórico oficial de tasas de cambio USD/EUR publicadas por el Banco Central de Venezuela (BCV).

[![status](https://img.shields.io/badge/status-in%20development-yellow)](#)
[![license](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![previous version](https://img.shields.io/badge/v0--legacy-Telegram%20Bot-lightgrey)](https://github.com/jrodrigues-dev/bot-intervencion-bcv/tree/v0-legacy-python-bot)

## ¿Qué es esto?

Venezuela no cuenta con una API oficial del BCV para consultar las tasas de cambio oficiales del Bolívar frente al USD y al EUR. Cada equipo de desarrollo termina escribiendo su propio scraper, lo cual:

- Duplica trabajo en toda la industria local.
- Se rompe cada vez que el BCV cambia algo en su sitio.
- No expone histórico, solo la tasa del día.

Este proyecto resuelve eso ofreciendo una **API REST pública, gratuita y mantenida** que sirve:

- Tasa oficial del día (USD y EUR).
- Tasa de cualquier fecha histórica (desde 2016 para USD, 2024 para EUR).
- Rangos históricos para análisis.
- Documentación OpenAPI/Swagger.

La fuente son los archivos oficiales que el BCV publica en su sección de estadísticas — no scraping del HTML cambiante.

## Estado

🚧 **En construcción.** Este repo está siendo reconstruido desde cero a partir de la base de un bot de Telegram previo (ver sección "Versión anterior").

Para seguir el progreso, ver el [plan de implementación](https://github.com/jrodrigues-dev/bot-intervencion-bcv).

## Stack

- TypeScript + Hono sobre Node.js 22 LTS
- PostgreSQL 16 + Drizzle ORM
- OpenAPI auto-generado con `@hono/zod-openapi` + Scalar UI
- Deploy en Railway

## Versión anterior

Este repo nació como un **bot de Telegram** que notificaba intervenciones cambiarias del BCV. Operó hasta agosto de 2025 cuando cumplió su propósito original (proyecto académico). El código completo del bot está preservado:

- Tag: [`v0-legacy-python-bot`](https://github.com/jrodrigues-dev/bot-intervencion-bcv/tree/v0-legacy-python-bot)
- Branch: `legacy/python-bot`
- Carpeta: [`legacy/python-bot/`](./legacy/python-bot/)

## Licencia

[AGPL-3.0](LICENSE). El código es libre. Si despliegas una modificación como servicio público, debes publicar tus cambios.

No estamos afiliados al Banco Central de Venezuela.
