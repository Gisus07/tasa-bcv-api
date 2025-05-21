from telegram import Update
from telegram.ext import ContextTypes
from firebase_manager import eliminar_tasas_anteriores
from dotenv import load_dotenv
import os

load_dotenv()
ADMIN_ID = int(os.getenv("ADMIN_ID"))

async def limpiar_tasas(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("⛔ No tienes permisos para usar este comando.")
        return

    try:
        eliminadas = eliminar_tasas_anteriores()
        await update.message.reply_text(f"🧹 Se eliminaron {eliminadas} tasas antiguas correctamente.")
    except Exception as e:
        await update.message.reply_text(f"❌ Error al eliminar tasas: {e}")
