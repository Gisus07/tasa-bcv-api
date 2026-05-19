# Contribuir a `tasa-bcv-api`

Gracias por tu interés. Antes de abrir un PR:

## Antes de empezar

1. **Para cambios menores** (typos, fixes pequeños): abre el PR directo.
2. **Para cambios grandes** (nueva funcionalidad, refactor, cambios de stack): abre primero un issue describiendo la propuesta. Evitamos así trabajo perdido.

## Setup

Sigue la sección "Desarrollo local" del [README](../README.md). Necesitas Node 22+, pnpm y Postgres (puede ser via Docker).

## Estilo de código

- TypeScript estricto (`tsconfig.json` lo aplica).
- `pnpm typecheck` y `pnpm test` deben pasar en CI.
- Sigue el estilo de los archivos vecinos. No introduzcas nuevos formatters/linters sin discutirlo primero.
- Mantén las funciones pequeñas y enfocadas. Si una función pasa de ~80 líneas o tiene más de 4 niveles de indentación, probablemente puede dividirse.

## Tests

- Los parsers y la lógica de quirks tienen tests con fixtures reales. Si tocas el parser o agregas una fuente nueva, **agrega un test que valide un valor canónico conocido** (ver `parser.usd.test.ts` para el patrón).
- Los tests de DB que dependen de Postgres están marcados con `describe.skip` esperando una migración a `testcontainers`. Si vas a tocar la capa de DB y tienes Docker, puedes habilitar testcontainers en tu fork.

## Commit messages

Estilo libre, pero útil:

- Imperativo en presente: "Add X", "Fix Y", no "Added X".
- Una línea de resumen <72 caracteres, luego cuerpo opcional explicando el porqué.
- Si fixea un issue, menciónalo: `Fixes #N`.

## Licencia

Al contribuir aceptas que tu código se publica bajo [AGPL-3.0-or-later](../LICENSE).
