import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from notifier import notificar_a_todos, enviar_recordatorio_donacion
from log_manager import logger
from bcv_checker import obtener_tasa_usd_bcv_checker
from firebase_manager import eliminar_tasas_anteriores

def iniciar_scheduler(app, loop):
    scheduler = AsyncIOScheduler(timezone="America/Caracas")

    async def enviar_recordatorio():
        try:
            ahora = datetime.now().strftime("%d/%m/%Y %H:%M")
            mensaje = f"📢 Recordatorio automático:\n🕘 {ahora}\nNo se ha detectado una nueva intervención aún."
            await notificar_a_todos(app.bot, mensaje)
            logger.info("🕘 Recordatorio diario enviado con éxito")
        except Exception as e:
            logger.error(f"❌ Error al enviar recordatorio diario: {e}")

    async def obtener_tasa_diaria():
        try:
            logger.info("⏰ Ejecutando obtención de tasa a las 00:00")
            resultado = obtener_tasa_usd_bcv_checker()
            if resultado == "Error":
                logger.warning("⚠️ No se pudo obtener la tasa a las 00:00.")
            else:
                logger.info(f"✅ Tasa obtenida correctamente: {resultado}")
        except Exception as e:
            logger.error(f"❌ Error al obtener la tasa: {e}")

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
    scheduler.add_job(enviar_recordatorio, trigger="cron", hour=8, minute=30,
                      misfire_grace_time=60, coalesce=True)

    scheduler.add_job(obtener_tasa_diaria, trigger="cron", hour=0, minute=0,
                      misfire_grace_time=60, coalesce=True)

    scheduler.add_job(lambda: asyncio.run_coroutine_threadsafe(recordatorio_donacion(), loop),
                      trigger="cron", day=1, hour=0, minute=0,
                      misfire_grace_time=120, coalesce=True)

    scheduler.add_job(lambda: asyncio.run_coroutine_threadsafe(limpieza_semanal(), loop),
                      trigger="cron", day_of_week="mon", hour=0, minute=30,
                      misfire_grace_time=120, coalesce=True)

    scheduler.start()
    logger.info("🗓️ Scheduler diario activado")
