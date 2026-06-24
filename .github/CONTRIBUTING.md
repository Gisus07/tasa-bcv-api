# Contribuir a `tasa-bcv-api`

Gracias por tu interés. Antes de abrir un PR:

## Antes de empezar

1. **Para cambios menores** (typos, fixes pequeños): abre el PR directo.
2. **Para cambios grandes** (nueva funcionalidad, refactor, cambios de stack): abre primero un issue describiendo la propuesta. Evitamos así trabajo perdido.

## Setup

Sigue la sección "Desarrollo local" del [README](../README.md). Necesitas Node 22+, pnpm y Postgres (puede ser via Docker).

## Estilo de código

- TypeScript estricto (`tsconfig.json` lo aplica).
- El repo usa **ESLint** (con `typescript-eslint`) y **Prettier**. Antes de subir:
  - `pnpm lint` — corrige lo autofixable y reporta el resto.
  - `pnpm format` — aplica el formato de Prettier.
- En CI deben pasar `pnpm lint:ci`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` y `pnpm build`.
- **Git hooks** (`.githooks`): se activan solos al instalar (`pnpm install` ejecuta el script `prepare`). `pre-commit` valida el formato; `pre-push` corre lint + typecheck. Activación manual: `git config core.hooksPath .githooks`.
- Sigue el estilo de los archivos vecinos. Mantén las funciones pequeñas y enfocadas. Si una función pasa de ~80 líneas o tiene más de 4 niveles de indentación, probablemente puede dividirse.

## Tests

- Los parsers y la lógica de quirks tienen tests con fixtures reales. Si tocas el parser o agregas una fuente nueva, **agrega un test que valide un valor canónico conocido** (ver `parser.usd.test.ts` para el patrón).
- Los tests de DB usan **Testcontainers** (un Postgres efímero); necesitas Docker para correrlos. Se ejecutan en serie (`fileParallelism: false` en `vitest.config.ts`) porque comparten un único contenedor. Si tocas la capa de DB, agrega o actualiza el test correspondiente.

## Commit messages

Estilo libre, pero útil:

- Imperativo en presente: "Add X", "Fix Y", no "Added X".
- Una línea de resumen <72 caracteres, luego cuerpo opcional explicando el porqué.
- Si fixea un issue, menciónalo: `Fixes #N`.

## Licencia

Al contribuir aceptas que tu código se publica bajo [AGPL-3.0-or-later](../LICENSE).
