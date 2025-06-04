from telegram import Update
from telegram.ext import ContextTypes
from telegram.error import Forbidden
from firebase_manager import obtener_usuarios_firebase, guardar_usuarios_firebase
from log_manager import logger
import os
from datetime import datetime
import asyncio

ADMIN_ID = int(os.getenv("ADMIN_ID"))

async def eliminar_bloqueados(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("⛔ No tienes permisos para usar este comando.")
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
            return uid, True  # asumimos que sigue activo por precaución

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
