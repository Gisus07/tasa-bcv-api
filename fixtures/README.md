# Fixtures

Archivos oficiales del BCV usados para tests deterministas del parser y la ingesta.

## Archivos

| Archivo | Fuente | Contenido | Validación conocida |
|---|---|---|---|
| `2_1_1_tdc.xlsx` | [bcv.org.ve/sites/default/files/indicadores_sector_externo/2_1_1_tdc.xlsx](https://www.bcv.org.ve/sites/default/files/indicadores_sector_externo/2_1_1_tdc.xlsx) | Histórico oficial USD/Bs diario desde 2016. Hoja por año. Columnas: FECHA, COMPRA, VENTA. | `14/05/2026 → 510.78730` (VENTA) |
| `2_1_2b26_otrasmonedas.xls` | [bcv.org.ve/sites/default/files/EstadisticasGeneral/2_1_2b26_otrasmonedas.xls](https://www.bcv.org.ve/sites/default/files/EstadisticasGeneral/2_1_2b26_otrasmonedas.xls) | EUR (y otras monedas) trimestre II 2026. Una hoja con FECHA + COMPRA + VENTA por moneda. | `14/05/2026 → 598.12171255` (EUR VENTA) |

## Regla canónica

**Solo la columna `VENTA` es la tasa oficial publicada.** La columna `COMPRA` no se usa.

## Refresh

Estos archivos se actualizan ocasionalmente cuando el BCV cambia el formato o se necesita probar contra datos más recientes. La descarga es read-only contra el sitio público.

```bash
curl -k -L https://www.bcv.org.ve/sites/default/files/indicadores_sector_externo/2_1_1_tdc.xlsx \
  -o fixtures/2_1_1_tdc.xlsx
```

El sitio del BCV tiene SSL inválido — `-k` es necesario.
