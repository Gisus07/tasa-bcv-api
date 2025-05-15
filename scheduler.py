from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from notifier import notificar_a_todos
from log_manager import logger

def iniciar_scheduler(app):
    scheduler = AsyncIOScheduler(timezone="America/Caracas")  # Ajusta si deseas

    async def enviar_recordatorio():
        ahora = datetime.now().strftime("%d/%m/%Y %H:%M")
        mensaje = f"📢 Recordatorio automático:\n🕘 {ahora}\nNo se ha detectado una nueva intervención aún."
        await notificar_a_todos(app.bot, mensaje)
        logger.info("🕘 Recordatorio diario enviado")

    scheduler.add_job(enviar_recordatorio, trigger="cron", hour=8, minute=30)
    scheduler.start()
    logger.info("🗓️ Scheduler diario activado")
