import time
from telegram import BotCommand, BotCommandScopeDefault, BotCommandScopeChat
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from telegram.error import NetworkError, TelegramError
from donaciones import donar, manejar_opciones, recibir_monto
from subs_manager import start, stop
from notifier import ultimo, tasa_actual
from scheduler import iniciar_scheduler
from log_manager import logger
from dotenv import load_dotenv
import os
import asyncio
import httpx
from scheduler import tareas_programadas
from admin_commands import ping, eliminar_bloqueados, limpiar_tasas, ver_log

load_dotenv()
TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))

async def setup_bot(app):
    comandos_publicos = [
        BotCommand("start", "Suscribirse a alertas del BCV"),
        BotCommand("stop", "Cancelar suscripción"),
        BotCommand("ultimo", "Ver última intervención cambiaria"),
        BotCommand("tasa", "Mostrar tasa USD según BCV"),
        BotCommand("donar", "Mostrar métodos de donación")
    ]
    comandos_admin = comandos_publicos + [
    BotCommand("eliminar_bloqueados", "(Admin) Eliminar usuarios que bloquearon al bot"),
    BotCommand("limpiar_tasas", "(Admin) Limpiar tasas antiguas"),
    BotCommand("ping", "(Admin) Verificar si el bot está activo"),
    BotCommand("log", "(Admin) Ver últimas líneas del log")
    ]
    await app.bot.set_my_commands(comandos_publicos, scope=BotCommandScopeDefault())
    await app.bot.set_my_commands(comandos_admin, scope=BotCommandScopeChat(chat_id=ADMIN_ID))

    try:
        logger.info("📢 Notificación de encendido enviada correctamente")
    except Exception as e:
        logger.error(f"❌ Error al enviar notificación de encendido: {e}")

    iniciar_scheduler(app)
    logger.info("✅ Bot iniciado y en espera")

async def cerrar_bot(app):
    logger.info("⏹️ Cerrando tareas...")
    
    try:
        logger.info("📴 Notificación de apagado enviada correctamente")
    except Exception as e:
        logger.error(f"❌ Error al enviar notificación de apagado: {e}")
    
    if tareas_programadas:
        for tarea in tareas_programadas:
            if not tarea.done():
                tarea.cancel()
        
        resultados = await asyncio.gather(*tareas_programadas, return_exceptions=True)
        for res in resultados:
            if isinstance(res, asyncio.CancelledError):
                logger.debug("✅ Tarea cancelada exitosamente.")
            elif res is not None:
                logger.error(f"❌ Excepción inesperada al cerrar tarea: {res}")
    else:
        logger.info("ℹ️ No hay tareas programadas para cerrar.")

    logger.info("✅ Tareas cerradas correctamente.")

async def manejar_errores(update, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"❌ Excepción no capturada: {context.error}")
    if isinstance(context.error, httpx.RemoteProtocolError):
        logger.warning("🌐 Desconexión inesperada del servidor de Telegram (RemoteProtocolError).")
    elif isinstance(context.error, NetworkError):
        logger.warning("🌐 Error de red detectado. Es probable que Telegram esté temporalmente inaccesible.")
    elif isinstance(context.error, TelegramError):
        logger.warning(f"⚠️ Error de Telegram: {context.error}")

def main():
    try:
        app = ApplicationBuilder().token(TOKEN).post_init(lambda app: setup_bot(app)).post_stop(cerrar_bot).build()

        app.add_handler(CommandHandler("start", start))
        app.add_handler(CommandHandler("stop", stop))
        app.add_handler(CommandHandler("ultimo", ultimo))
        app.add_handler(CommandHandler("tasa", tasa_actual))
        app.add_handler(CommandHandler("donar", donar))
        app.add_handler(CommandHandler("eliminar_bloqueados", eliminar_bloqueados))
        app.add_handler(CallbackQueryHandler(manejar_opciones))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, recibir_monto))
        app.add_handler(CommandHandler("limpiar_tasas", limpiar_tasas))
        app.add_handler(CommandHandler("ping", ping))
        app.add_handler(CommandHandler("log", ver_log))

        app.add_error_handler(manejar_errores)

        app.run_polling()
    except (httpx.RemoteProtocolError, NetworkError, TelegramError) as e:
        logger.error(f"🔁 Error de red o Telegram: {e}. Reintentando en 60 segundos...")
        time.sleep(60)
        main()
    except Exception as e:
        logger.critical(f"🔥 Error inesperado en el ciclo principal: {e}")

if __name__ == "__main__":
    main()
