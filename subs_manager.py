import json
from telegram import Update
from telegram.ext import ContextTypes

USUARIOS_FILE = "usuarios.json"

def cargar_usuarios():
    try:
        with open(USUARIOS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def guardar_usuarios(lista):
    with open(USUARIOS_FILE, "w", encoding="utf-8") as f:
        json.dump(lista, f)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    usuarios = cargar_usuarios()
    if user_id not in usuarios:
        usuarios.append(user_id)
        guardar_usuarios(usuarios)
        await update.message.reply_text("✅ Te has suscrito a las alertas del BCV.")
    else:
        await update.message.reply_text("📌 Ya estás suscrito. Usa /stop para darte de baja.")

async def stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    usuarios = cargar_usuarios()
    if user_id in usuarios:
        usuarios.remove(user_id)
        guardar_usuarios(usuarios)
        await update.message.reply_text("❌ Te has dado de baja de las alertas.")
    else:
        await update.message.reply_text("🔍 No estabas suscrito.")
