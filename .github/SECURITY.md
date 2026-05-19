# Política de seguridad

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad de seguridad en `tasa-bcv-api`, **no abras un issue público**.

En su lugar:

1. Usa la función **[Report a vulnerability](https://github.com/Gisus07/tasa-bcv-api/security/advisories/new)** de GitHub Security Advisories.
2. Describe el problema, los pasos para reproducirlo, y el impacto que ves.
3. Te responderemos dentro de 72 horas.

## Qué consideramos vulnerabilidad

- Cualquier vector que permita acceso no autorizado al endpoint `POST /v1/admin/*`.
- Cualquier inyección que afecte la DB (SQL injection, etc.).
- Cualquier vector de DoS más severo que pasar el rate limit estándar.
- Cualquier exposición no intencionada del `ADMIN_TOKEN`, credenciales de DB, o datos privados.
- Cualquier configuración del Dockerfile o deploy que permita escalada de privilegios.

## Qué NO consideramos vulnerabilidad

- El sitio del BCV tiene un certificado SSL inválido (es un hecho del sitio fuente, no nuestro).
- La API es de lectura pública sin auth — no es un bug, es el diseño.
- Rate limiting es por IP — IPs compartidas pueden afectarse entre sí. Está documentado.

## Versiones soportadas

Solo la última versión publicada. Si encuentras una vulnerabilidad en una versión anterior, intenta reproducirla en `main` primero.
