from telegram import Update
from telegram.ext import ContextTypes
from telegram.error import Forbidden
from firebase_manager import (
    obtener_usuarios_firebase, guardar_usuarios_firebase,
    eliminar_tasas_anteriores
)
from log_manager import logger
import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
ADMIN_ID = int(os.getenv("ADMIN_ID"))

# Constantes
MENSAJE_NO_AUTORIZADO = "⛔ No tienes permisos para usar este comando."

# --- /ping ---
async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("🚫 Este comando está reservado para el administrador.")
        return

    logger.info("✅ Comando /ping ejecutado correctamente por el admin.")
    await update.message.reply_text("🏓 Pong")

# --- /eliminar_bloqueados ---
async def eliminar_bloqueados(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text(MENSAJE_NO_AUTORIZADO)
        return

    usuarios = obtener_usuarios_firebase()
    activos = []
    eliminados = []

    async def verificar_usuario(uid):
        try:
            await context.bot.send_message(chat_id=uid, text="🔍 Verificación de actividad.")
            return uid, True
        except Forbidden:
            logger.warning(f"🚫 Usuario bloqueó al bot: {uid}")
            return uid, False
        except Exception as e:
            logger.error(f"❌ Error al verificar usuario {uid}: {e}")
            return uid, True  # asumimos activo por precaución

    resultados = await asyncio.gather(*(verificar_usuario(uid) for uid in usuarios))

    for uid, es_activo in resultados:
        if es_activo:
            activos.append(uid)
        else:
            eliminados.append(uid)

    guardar_usuarios_firebase(activos)

    if eliminados:
        fecha = datetime.now().strftime("%d-%m-%Y_%H-%M")
        nombre_archivo = f"bloqueados_{fecha}.txt"
        with open(nombre_archivo, "w", encoding="utf-8") as f:
            for uid in eliminados:
                f.write(str(uid) + "\n")
        logger.info(f"📝 Usuarios bloqueados registrados en {nombre_archivo}")

    mensaje = (
        f"✅ Limpieza completada.\n"
        f"👥 Usuarios activos: {len(activos)}\n"
        f"🚫 Usuarios eliminados: {len(eliminados)}"
    )
    await update.message.reply_text(mensaje)

# --- /limpiar_tasas ---
async def limpiar_tasas(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text(MENSAJE_NO_AUTORIZADO)
        return

    try:
        eliminadas = eliminar_tasas_anteriores()
        await update.message.reply_text(f"🧹 Se eliminaron {eliminadas} tasas antiguas correctamente.")
    except Exception as e:
        await update.message.reply_text(f"❌ Error al eliminar tasas: {e}")

# --- /log ---
from telegram.constants import ChatAction
from telegram.helpers import escape_markdown

async def ver_log(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text(MENSAJE_NO_AUTORIZADO)
        return

    ruta_log = "logs/bot.log"
    argumento = context.args[0] if context.args else ""

    try:
        if argumento.lower() == "archivo":
            await update.message.chat.send_action(action=ChatAction.UPLOAD_DOCUMENT)
            await update.message.reply_document(document=open(ruta_log, "rb"), filename="bot.log")
            return

        with open(ruta_log, "r", encoding="utf-8") as f:
            lineas = f.readlines()
            ultimas_lineas = lineas[-30:]
            texto = "".join(ultimas_lineas).strip()

        if not texto:
            await update.message.reply_text("📂 El archivo de log está vacío.")
            return

        if len(texto) > 4000:
            texto = texto[-4000:]

        # Escapar caracteres especiales para Markdown
        texto = escape_markdown(texto, version=2)
        await update.message.reply_text(f"📄 Últimas líneas del log:\n\n```{texto}```", parse_mode="MarkdownV2")

    except FileNotFoundError:
        await update.message.reply_text("❌ No se encontró el archivo de log.")
    except Exception as e:
        await update.message.reply_text(f"❌ Error al leer el log: {e}")
