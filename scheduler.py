import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from notifier import notificar_a_todos, enviar_recordatorio_donacion
from log_manager import logger
from bcv_checker import obtener_tasa_usd_bcv_checker
from firebase_manager import eliminar_tasas_anteriores, obtener_tasa_usd_firebase, guardar_tasa_usd_firebase
import pytz

ZONA_VE = pytz.timezone("America/Caracas")

def iniciar_scheduler(app, loop):
    scheduler = AsyncIOScheduler(timezone=ZONA_VE)

    async def enviar_recordatorio():
        try:
            ahora = datetime.now(ZONA_VE).strftime("%d/%m/%Y %H:%M")
            mensaje = f"\U0001F4E2 Recordatorio automático:\n\U0001F559 {ahora}\nNo se ha detectado una nueva intervención aún."
            await notificar_a_todos(app.bot, mensaje)
            logger.info("\U0001F559 Recordatorio diario enviado con éxito")
        except Exception as e:
            logger.error(f"❌ Error al enviar recordatorio diario: {e}")

    async def obtener_tasa_diaria():
        try:
            hoy = datetime.now(ZONA_VE).strftime("%d-%m-%Y")
            tasa_guardada = obtener_tasa_usd_firebase(hoy)

            if tasa_guardada is not None:
                logger.info(f"🔁 La tasa del {hoy} ya está registrada: {tasa_guardada}")
                return

            logger.info(f"⏳ Tasa del día {hoy} no encontrada. Obteniendo desde BCV...")
            nueva_tasa = obtener_tasa_usd_bcv_checker()

            if nueva_tasa == "Error":
                logger.warning("⚠️ No se pudo obtener la tasa desde el checker.")
            else:
                try:
                    valor_numerico = float(nueva_tasa.replace(",", "."))
                    guardar_tasa_usd_firebase(hoy, valor_numerico)
                    logger.info(f"✅ Tasa del día {hoy} registrada: {valor_numerico}")
                except ValueError:
                    logger.error(f"❌ La tasa obtenida no es un número válido: '{nueva_tasa}'")

        except Exception as e:
            logger.error(f"❌ Error en obtener_tasa_diaria: {e}")

    async def limpieza_semanal():
        try:
            eliminadas = eliminar_tasas_anteriores()
            logger.info(f"🧹 Limpieza semanal completada: {eliminadas} tasas eliminadas.")
        except Exception as e:
            logger.error(f"❌ Error durante la limpieza semanal: {e}")

    async def recordatorio_donacion():
        try:
            await enviar_recordatorio_donacion(app.bot)
            logger.info("💸 Recordatorio de donación mensual enviado")
        except Exception as e:
            logger.error(f"❌ Error al enviar recordatorio de donación: {e}")

    # Programar tareas
    scheduler.add_job(lambda: asyncio.run_coroutine_threadsafe(enviar_recordatorio(), loop),
                      trigger="cron", hour=8, minute=30,
                      misfire_grace_time=60, coalesce=True)

    scheduler.add_job(lambda: asyncio.run_coroutine_threadsafe(obtener_tasa_diaria(), loop),
                      trigger="cron", hour=0, minute=0,
                      misfire_grace_time=300, coalesce=True)

    # Ejecución adicional de respaldo a las 10:00 AM
    scheduler.add_job(lambda: asyncio.run_coroutine_threadsafe(obtener_tasa_diaria(), loop),
                      trigger="cron", hour=10, minute=0,
                      misfire_grace_time=600, coalesce=True)

    scheduler.add_job(lambda: asyncio.run_coroutine_threadsafe(recordatorio_donacion(), loop),
                      trigger="cron", day=1, hour=0, minute=0,
                      misfire_grace_time=120, coalesce=True)

    scheduler.add_job(lambda: asyncio.run_coroutine_threadsafe(limpieza_semanal(), loop),
                      trigger="cron", day_of_week="mon", hour=0, minute=30,
                      misfire_grace_time=120, coalesce=True)

    scheduler.start()
    logger.info("🗓️ Scheduler diario activado")

    # Verificar y guardar tasa del día al iniciar el bot
    asyncio.run_coroutine_threadsafe(obtener_tasa_diaria(), loop)
