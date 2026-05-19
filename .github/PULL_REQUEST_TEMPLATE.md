## Resumen

<!-- Una o dos líneas explicando qué cambia y por qué. -->

## Tipo de cambio

- [ ] Bug fix
- [ ] Nueva funcionalidad
- [ ] Refactor (sin cambio de comportamiento)
- [ ] Docs
- [ ] CI / build / tooling
- [ ] Otro:

## Cómo probarlo

<!-- Pasos concretos: comandos a correr, endpoints a llamar, datos esperados. -->

```bash
# ejemplo
pnpm test
pnpm dev
curl http://localhost:3000/v1/rates/latest
```

## Checklist

- [ ] `pnpm typecheck` pasa
- [ ] `pnpm test` pasa (incluyendo tests nuevos si aplica)
- [ ] Docs actualizadas si cambia la API pública (Zod schemas → OpenAPI se regenera solo)
- [ ] No introduce dependencias nuevas innecesarias
- [ ] El cambio no rompe la respuesta JSON pública (o si lo hace, esto es V2)
