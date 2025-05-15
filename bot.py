from telegram import BotCommand
from telegram.ext import ApplicationBuilder, CommandHandler
from subs_manager import start, stop, cargar_usuarios
from bcv_checker import obtener_ultima_intervencion
from notifier import ultimo, verificar_bcv_periodicamente
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

    async def setup():
        await app.bot.set_my_commands([
            BotCommand("start", "Suscribirse a alertas del BCV"),
            BotCommand("stop", "Cancelar suscripción"),
            BotCommand("ultimo", "Ver última intervención cambiaria")
        ])
        iniciar_scheduler(app)  # 👈 MUÉVELO AQUÍ
        asyncio.create_task(verificar_bcv_periodicamente(app))

    asyncio.get_event_loop().run_until_complete(setup())
    logger.info("✅ Bot iniciado y en espera")
    app.run_polling()

if __name__ == "__main__":
    main()
