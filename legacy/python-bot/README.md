# Legacy: Bot de Telegram (archivado)

> Este código está archivado. Operó desde su creación hasta agosto de 2025 y cumplió su propósito original. El repo continúa su evolución como una API REST pública — ver el [README raíz](../../README.md).

## ¿Qué hacía este bot?

Bot de Telegram ([@IntervencionBCVbot](https://t.me/IntervencionBCVbot)) que:

- Monitoreaba el sitio del BCV en tiempo real (7:00–8:30 AM Caracas).
- Notificaba a usuarios suscritos cuando se publicaba una nueva intervención cambiaria.
- Permitía consultar tasa USD/EUR del día (`/tasa`), última intervención (`/ultimo`).
- Aceptaba donaciones por Pago Móvil, Binance, PayPal y Wally.

## Stack

- Python 3.11 + `python-telegram-bot 20.8`
- Web scraping con `requests` + `BeautifulSoup4` (SSL inválido tolerado)
- Persistencia en Google Cloud Firestore
- Scheduling con `asyncio` + `pytz` (zona America/Caracas)
- Deploy en Docker

## Referencias preservadas

Aunque este código ya no se mantiene, su lógica sigue siendo referencia para el reescrito en TypeScript:

| Archivo Python | Lógica relevante |
|---|---|
| `bcv_checker.py` | Scraping de bcv.org.ve (homepage + `/politica-cambiaria/intervencion-cambiaria`) |
| `notifier.py:30` `fecha_destino_tasa()` | Regla de aplicación: viernes → lunes, otros días → día siguiente |
| `scheduler.py:367,381` `_buscar_tasa_anterior` / `_propagar_tasa` | Propagación de tasa anterior cuando hay gaps (fines de semana, feriados) |

## Para correr este código (referencia)

No recomendado salvo para experimentar localmente. Requería:

- Credenciales Firebase (`firebase_key.json`)
- Token de bot de Telegram en `.env`
- Variables de configuración de donaciones

```bash
docker build -t bot-bcv .
docker run --env-file .env bot-bcv
```
