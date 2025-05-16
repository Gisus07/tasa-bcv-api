import pytz
import os
import json
import asyncio
from telegram import Update
from telegram.ext import ContextTypes
from firebase_manager import obtener_usuarios,obtener_intervencion, guardar_intervencion, obtener_tasa_usd
from bcv_checker import obtener_ultima_intervencion
from datetime import datetime, time, timedelta
from log_manager import logger

ZONA_VE = pytz.timezone("America/Caracas")

def hora_local():
    return datetime.now(ZONA_VE)

def obtener_tasa_usd_hoy():
    try:
        hoy = hora_local()
        hoy_str = hoy.strftime("%d-%m-%Y")
        valor = obtener_tasa_usd(hoy_str)

        return valor or "No disponible", hoy_str, hoy_str

    except Exception as e:
        logger.error(f"❌ Error al obtener tasa desde Firestore: {e}")
        return "Error", None, None

def cargar_datos():
    datos = obtener_intervencion()
    return datos if datos else {
        "fecha": "",
        "intervencion": "",
        "usd": "",
        "monto": "",
        "notificado": False
    }

def guardar_datos(datos):
    guardar_intervencion(datos)

async def ultimo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        datos = obtener_ultima_intervencion()
    except Exception as e:
        logger.error(f"❌ Error al obtener datos del BCV: {e}")
        datos = None

    if datos:
        guardar_datos({**datos, "notificado": False})
        msg = (
            f"📆 Fecha: {datos['fecha']}\n"
            f"🔢 Nº Intervención: {datos['intervencion']}\n"
            f"💵 Tipo de Cambio Bs./USD: {datos['usd']}\n"
            f"💰 Tipo de Cambio Bs./EUR: {datos['monto']}"
        )
    else:
        msg = "⚠️ No se pudo obtener la información del BCV."
    await update.message.reply_text(msg)

async def tasa_actual(update: Update, context: ContextTypes.DEFAULT_TYPE):
    valor, fecha_mostrada, _ = obtener_tasa_usd_hoy()

    if valor in ["No disponible", "Error"]:
        mensaje = f"⚠️ No se pudo obtener la tasa del día {fecha_mostrada or 'actual'}"
    else:
        mensaje = (
            f"💵 Tasa USD según BCV\n"
            f"📅 {fecha_mostrada}\n"
            f"💰 Bs./USD: {valor}"
        )

    await update.message.reply_text(mensaje)

async def notificar_a_todos(bot, mensaje):
    usuarios = obtener_usuarios()
    for uid in usuarios:
        try:
            await bot.send_message(chat_id=uid, text=mensaje)
        except Exception as e:
            logger.warning(f"❌ Error al notificar a {uid}: {e}")

async def verificar_bcv_periodicamente(app):
    while True:
        logger.info("⏱️ Verificando BCV (frecuencia periódica)...")
        try:
            nueva = obtener_ultima_intervencion()
        except Exception as e:
            logger.error(f"❌ Error al obtener datos del BCV: {e}")
            nueva = None

        actual = cargar_datos()
        hoy = hora_local().strftime("%d-%m-%Y")
        if nueva and nueva["fecha"] != actual["fecha"] and nueva["fecha"] == hoy:
            guardar_datos({**nueva, "notificado": True})
            mensaje = (
                f"📢 Nueva Intervención Cambiaria Detectada\n"
                f"📆 Fecha: {nueva['fecha']}\n"
                f"🔢 Nº: {nueva['intervencion']}\n"
                f"💵 Tipo de Cambio Bs./USD: {nueva['usd']}\n"
                f"💰 Tipo de Cambio Bs./EUR: {nueva['monto']}"
            )
            await notificar_a_todos(app.bot, mensaje)
            logger.info("✅ Se notificó a todos.")
        else:
            logger.info("📭 Sin cambios.")
        await asyncio.sleep(1800)  # 30 minutos

async def monitorear_entre_7y830(app):
    while True:
        ahora = hora_local()
        hora_actual = ahora.time()

        inicio = time(7, 0)
        fin = time(8, 30)

        datos_actuales = cargar_datos()
        ya_notificado_hoy = datos_actuales.get("notificado", False)
        hoy = hora_local().strftime("%d-%m-%Y")

        if inicio <= hora_actual <= fin and not ya_notificado_hoy:
            logger.info("⏱️ Verificando BCV (franja 7:00–8:30 AM)...")
            try:
                nueva = obtener_ultima_intervencion()
            except Exception as e:
                logger.error(f"❌ Error al obtener datos del BCV: {e}")
                nueva = None

            if nueva and nueva["fecha"] != datos_actuales["fecha"] and nueva["fecha"] == hoy:
                nueva["notificado"] = True
                guardar_datos(nueva)

                mensaje = (
                    f"📢 Nueva Intervención Cambiaria Detectada\n"
                    f"📆 Fecha: {nueva['fecha']}\n"
                    f"🔢 Nº Intervención: {nueva['intervencion']}\n"
                    f"💵 Tipo de Cambio Bs./USD: {nueva['usd']}\n"
                    f"💰 Tipo de Cambio Bs./EUR: {nueva['monto']}"
                )
                await notificar_a_todos(app.bot, mensaje)
                logger.info("✅ Intervención detectada y notificada.")
            else:
                logger.info("📭 Sin cambios.")
            await asyncio.sleep(120)

        elif hora_actual > fin:
            if not ya_notificado_hoy:
                logger.info("📌 No hubo intervención hoy. Fin del monitoreo diario.")
            else:
                logger.info("🛑 Ya se notificó hoy. Descansando hasta mañana.")

            siguiente_inicio = hora_local().replace(hour=7, minute=0, second=0, microsecond=0) + timedelta(days=1)
            delta = (siguiente_inicio - ahora).total_seconds()
            await asyncio.sleep(delta)

        else:
            logger.info("🌅 Aún no es hora (antes de las 7:00 AM). Esperando...")
            await asyncio.sleep(60)

async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE):
    print("✅ Entró al comando /ping")
    await update.message.reply_text("🏓 Pong")
