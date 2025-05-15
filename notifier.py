import json
import asyncio
from telegram import Update
from telegram.ext import ContextTypes
from subs_manager import cargar_usuarios
from bcv_checker import obtener_ultima_intervencion

DATA_FILE = "data.json"

def cargar_datos():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"fecha": "", "intervencion": "", "monto": ""}

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
    else:
        msg = "⚠️ No se pudo obtener la información del BCV."
    await update.message.reply_text(msg)

async def notificar_a_todos(bot, mensaje):
    usuarios = cargar_usuarios()
    for uid in usuarios:
        try:
            await bot.send_message(chat_id=uid, text=mensaje)
        except Exception as e:
            print(f"❌ Error al notificar a {uid}: {e}")

async def verificar_bcv_periodicamente(app):
    while True:
        print("⏱️ Verificando BCV...")
        nueva = obtener_ultima_intervencion()
        actual = cargar_datos()

        if nueva and nueva["fecha"] != actual["fecha"]:
            guardar_datos(nueva)
            mensaje = (
                f"📢 Nueva Intervención Cambiaria\n"
                f"📆 Fecha: {nueva['fecha']}\n"
                f"🔢 Nº: {nueva['intervencion']}\n"
                f"💰 Monto: {nueva['monto']} millones USD"
            )
            await notificar_a_todos(app.bot, mensaje)
            print("✅ Se notificó a todos.")
        else:
            print("📭 Sin cambios.")
        await asyncio.sleep(1800)
