from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from notifier import notificar_a_todos
from log_manager import logger
from bcv_checker import obtener_tasa_usd_bcv_checker

def iniciar_scheduler(app):
    scheduler = AsyncIOScheduler(timezone="America/Caracas")  # Ajusta si deseas

    async def enviar_recordatorio():
        ahora = datetime.now().strftime("%d/%m/%Y %H:%M")
        mensaje = f"📢 Recordatorio automático:\n🕘 {ahora}\nNo se ha detectado una nueva intervención aún."
        await notificar_a_todos(app.bot, mensaje)
        logger.info("🕘 Recordatorio diario enviado")

    async def obtener_tasa_diaria():
        logger.info("⏰ Ejecutando obtención de tasa a las 00:00")
        try:
            resultado = obtener_tasa_usd_bcv_checker()  # Llamamos a la función sin desempaquetar los valores
            if resultado == "Error":
                logger.error("❌ No se pudo obtener la tasa a las 00:00.")
            else:
                logger.info(f"✅ Tasa obtenida a las 00:00: {resultado}")  # Registramos el resultado
        except Exception as e:
            logger.error(f"❌ Error al obtener la tasa: {e}")

    # Agregar el trabajo de recordatorio diario a las 8:30 AM
    scheduler.add_job(enviar_recordatorio, trigger="cron", hour=8, minute=30)

    # Agregar el trabajo para obtener la tasa del día a las 00:00
    scheduler.add_job(obtener_tasa_diaria, trigger="cron", hour=0, minute=0)

    scheduler.start()
    logger.info("🗓️ Scheduler diario activado")
