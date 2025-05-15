from telegram import BotCommand
from telegram.ext import ApplicationBuilder, CommandHandler
from subs_manager import start, stop, cargar_usuarios
from bcv_checker import obtener_ultima_intervencion
from notifier import ultimo, tasa_actual, verificar_bcv_periodicamente, monitorear_entre_7y830, ping
from scheduler import iniciar_scheduler
from log_manager import logger
from dotenv import load_dotenv
import os
import asyncio

load_dotenv()
TOKEN = os.getenv("BOT_TOKEN")

def main():
    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("stop", stop))
    app.add_handler(CommandHandler("ultimo", ultimo))
    app.add_handler(CommandHandler("tasa", tasa_actual))

    async def setup():
        await app.bot.set_my_commands([
            BotCommand("start", "Suscribirse a alertas del BCV"),
            BotCommand("stop", "Cancelar suscripción"),
            BotCommand("ultimo", "Ver última intervención cambiaria"),
            BotCommand("tasa", "Mostrar tasa USD según BCV")
        ])
        iniciar_scheduler(app)
        asyncio.create_task(verificar_bcv_periodicamente(app))
        asyncio.create_task(monitorear_entre_7y830(app))

    try:
        asyncio.get_event_loop().run_until_complete(setup())
        logger.info("✅ Bot iniciado y en espera")
        app.run_polling()
    except KeyboardInterrupt:
        logger.info("🛑 Bot detenido manualmente por el usuario")

if __name__ == "__main__":
    main()
