from telegram import BotCommand
from telegram.ext import ApplicationBuilder, CommandHandler
from subs_manager import start, stop
from notifier import ultimo, tasa_actual, verificar_bcv_periodicamente, monitorear_entre_7y830
from scheduler import iniciar_scheduler
from log_manager import logger
from dotenv import load_dotenv
import os
import asyncio

load_dotenv()
TOKEN = os.getenv("BOT_TOKEN")

# Guardar referencias a las tareas para cancelarlas al apagar
tareas_background = []

async def setup_bot(app):
    await app.bot.set_my_commands([
        BotCommand("start", "Suscribirse a alertas del BCV"),
        BotCommand("stop", "Cancelar suscripción"),
        BotCommand("ultimo", "Ver última intervención cambiaria"),
        BotCommand("tasa", "Mostrar tasa USD según BCV")
    ])
    iniciar_scheduler(app)

    # Crear tareas y guardarlas para cancelación posterior
    tareas_background.append(asyncio.create_task(verificar_bcv_periodicamente(app)))
    tareas_background.append(asyncio.create_task(monitorear_entre_7y830(app)))
    logger.info("✅ Bot iniciado y en espera")

async def cerrar_bot(app):
    logger.info("⏹️ Cerrando tareas...")
    for tarea in tareas_background:
        tarea.cancel()
    await asyncio.gather(*tareas_background, return_exceptions=True)
    logger.info("✅ Tareas cerradas correctamente.")

def main():
    app = ApplicationBuilder().token(TOKEN).post_init(setup_bot).post_shutdown(cerrar_bot).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("stop", stop))
    app.add_handler(CommandHandler("ultimo", ultimo))
    app.add_handler(CommandHandler("tasa", tasa_actual))

    app.run_polling()

if __name__ == "__main__":
    main()
