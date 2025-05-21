from telegram import BotCommand
from telegram.ext import ApplicationBuilder, CommandHandler
from telegram.ext import CallbackQueryHandler, MessageHandler, filters
from donaciones import donar, manejar_opciones, recibir_monto
from subs_manager import start, stop
from notifier import ultimo, tasa_actual, verificar_bcv_periodicamente, monitorear_entre_7y830
from scheduler import iniciar_scheduler
from log_manager import logger
from dotenv import load_dotenv
import os
import asyncio
from limpiar_tasas import limpiar_tasas

load_dotenv()
TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))

# Guardar referencias a las tareas para cancelarlas al apagar
tareas_background = []

async def setup_bot(app, loop):
    comandos = [
        BotCommand("start", "Suscribirse a alertas del BCV"),
        BotCommand("stop", "Cancelar suscripción"),
        BotCommand("ultimo", "Ver última intervención cambiaria"),
        BotCommand("tasa", "Mostrar tasa USD según BCV"),
        BotCommand("donar", "Mostrar métodos de donación")
    ]

    if int(ADMIN_ID) == int(app.bot.id):  # solo para asegurar visibilidad (Telegram limita visibilidad en menú para comandos admin)
        comandos.append(BotCommand("limpiar_tasas", "(Admin) Limpiar tasas antiguas"))

    await app.bot.set_my_commands(comandos)
    iniciar_scheduler(app, loop)

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
    loop = asyncio.get_event_loop()
    app = ApplicationBuilder().token(TOKEN).post_init(lambda app: setup_bot(app, loop)).post_shutdown(cerrar_bot).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("stop", stop))
    app.add_handler(CommandHandler("ultimo", ultimo))
    app.add_handler(CommandHandler("tasa", tasa_actual))
    app.add_handler(CommandHandler("donar", donar))
    app.add_handler(CallbackQueryHandler(manejar_opciones))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, recibir_monto))
    app.add_handler(CommandHandler("limpiar_tasas", limpiar_tasas))

    app.run_polling()

if __name__ == "__main__":
    main()