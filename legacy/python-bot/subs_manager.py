from telegram import Update
from telegram.ext import ContextTypes
from firebase_manager import obtener_usuarios_firebase, guardar_usuarios_firebase

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    usuarios = obtener_usuarios_firebase()
    if user_id not in usuarios:
        usuarios.append(user_id)
        guardar_usuarios_firebase(usuarios)
        await update.message.reply_text("✅ Te has suscrito a las alertas del BCV.")
    else:
        await update.message.reply_text("📌 Ya estás suscrito. Usa /stop para darte de baja.")

async def stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    usuarios = obtener_usuarios_firebase()
    if user_id in usuarios:
        usuarios.remove(user_id)
        guardar_usuarios_firebase(usuarios)
        await update.message.reply_text("❌ Te has dado de baja de las alertas.")
    else:
        await update.message.reply_text("🔍 No estabas suscrito.")
