from telegram import BotCommand, BotCommandScopeDefault, BotCommandScopeChat
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from telegram.error import NetworkError, TelegramError
from donaciones import donar, manejar_opciones, recibir_monto
from subs_manager import start, stop
from notifier import ultimo, tasa_actual, verificar_bcv_periodicamente, monitorear_entre_7y830
from scheduler import iniciar_scheduler
from log_manager import logger
from limpiar_tasas import limpiar_tasas
from notifier import notificar_a_todos
from dotenv import load_dotenv
import os
import asyncio
import httpx

load_dotenv()
TOKEN = os.getenv("BOT_TOKEN")
# TOKEN = os.getenv("TEST_BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))

tareas_background = []

async def setup_bot(app):
    comandos_publicos = [
        BotCommand("start", "Suscribirse a alertas del BCV"),
        BotCommand("stop", "Cancelar suscripción"),
        BotCommand("ultimo", "Ver última intervención cambiaria"),
        BotCommand("tasa", "Mostrar tasa USD según BCV"),
        BotCommand("donar", "Mostrar métodos de donación")
    ]
    comandos_admin = comandos_publicos + [
        BotCommand("limpiar_tasas", "(Admin) Limpiar tasas antiguas")
    ]
    await app.bot.set_my_commands(comandos_publicos, scope=BotCommandScopeDefault())
    await app.bot.set_my_commands(comandos_admin, scope=BotCommandScopeChat(chat_id=ADMIN_ID))

    try:
        mensaje_inicio = "✅ El bot vuelve a estar operativo.\n"
        await notificar_a_todos(app.bot, mensaje_inicio)
        logger.info("📢 Notificación de encendido enviada correctamente")
    except Exception as e:
        logger.error(f"❌ Error al enviar notificación de encendido: {e}")

    iniciar_scheduler(app)
    tareas_background.append(asyncio.create_task(verificar_bcv_periodicamente(app)))
    tareas_background.append(asyncio.create_task(monitorear_entre_7y830(app)))
    logger.info("✅ Bot iniciado y en espera")

async def cerrar_bot(app):
    logger.info("⏹️ Cerrando tareas...")
    try:
        mensaje = "⚠️ El bot ha sido detenido temporalmente por mantenimiento. Pronto volverá a estar disponible."
        await notificar_a_todos(app.bot, mensaje)
        logger.info("📴 Notificación de apagado enviada correctamente")
    except Exception as e:
        logger.error(f"❌ Error al enviar notificación de apagado: {e}")
    for tarea in tareas_background:
        tarea.cancel()
    await asyncio.gather(*tareas_background, return_exceptions=True)
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
    while True:
        try:
            app = ApplicationBuilder().token(TOKEN).post_init(lambda app: setup_bot(app)).post_stop(cerrar_bot).build()

            app.add_handler(CommandHandler("start", start))
            app.add_handler(CommandHandler("stop", stop))
            app.add_handler(CommandHandler("ultimo", ultimo))
            app.add_handler(CommandHandler("tasa", tasa_actual))
            app.add_handler(CommandHandler("donar", donar))
            app.add_handler(CallbackQueryHandler(manejar_opciones))
            app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, recibir_monto))
            app.add_handler(CommandHandler("limpiar_tasas", limpiar_tasas))

            app.add_error_handler(manejar_errores)

            app.run_polling()
        except httpx.RemoteProtocolError as e:
            logger.error(f"🔁 Error crítico: {e}. Reintentando en 60 segundos...")
            asyncio.run(asyncio.sleep(60))
        except Exception as e:
            logger.critical(f"🔥 Error inesperado en el ciclo principal: {e}")
            break

if __name__ == "__main__":
    main()
