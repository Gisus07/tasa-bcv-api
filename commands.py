from telegram import Update
from telegram.ext import ContextTypes
from bcv_checker import obtener_ultima_intervencion
from log_manager import logger
import json

DATA_FILE = "data.json"

def guardar_datos(datos):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(datos, f)

async def ultimo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    datos = obtener_ultima_intervencion()
    if datos:
        guardar_datos(datos)
        msg = (
            f"📆 Fecha: {datos['fecha']}\n"
            f"🔢 Nº Intervención: {datos['intervencion']}\n"
            f"💰 Tipo de Cambio Bs./EUR: {datos['monto']}"
        )
        logger.info(f"/ultimo ejecutado por {update.effective_user.id}")
    else:
        msg = "⚠️ No se pudo obtener la información del BCV."
        logger.warning("Fallo al obtener datos en /ultimo")

    await update.message.reply_text(msg)
