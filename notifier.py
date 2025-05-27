import pytz
import asyncio
from telegram import Update
from telegram.ext import ContextTypes
from firebase_manager import obtener_usuarios_firebase,obtener_intervencion_firebase, guardar_intervencion_firebase, obtener_tasa_usd_firebase
from bcv_checker import obtener_ultima_intervencion, obtener_tasa_usd_bcv_checker
from datetime import datetime, time, timedelta
from log_manager import logger
from firebase_manager import guardar_tasa_usd_firebase

ZONA_VE = pytz.timezone("America/Caracas")

def hora_local():
    return datetime.now(ZONA_VE)

def generar_firma():
    ahora = datetime.now(ZONA_VE)
    fecha_firma = ahora.strftime("%Y%m%d\-%H%M")  # <- escapa el guion
    return f"\n\n🔏 Firma digital: \\`BCV\\-BOT/{fecha_firma}\\`"

def escape_markdown_v2(texto: str) -> str:
    caracteres_escapables = r"_*[]()~`>#+-=|{}.!\\"
    for c in caracteres_escapables:
        texto = texto.replace(c, f"\\{c}")
    return texto

def fecha_destino_tasa(fecha_anuncio: str) -> str:
    # Entrada: "dd-mm-yyyy"
    dia, mes, anio = map(int, fecha_anuncio.split("-"))
    fecha = datetime(anio, mes, dia)
    dia_semana = fecha.weekday()  # lunes = 0 ... domingo = 6

    if dia_semana == 4:  # Viernes
        destino = fecha + timedelta(days=3)  # Lunes siguiente
    else:
        destino = fecha + timedelta(days=1)  # Día siguiente

    return destino.strftime("%d-%m-%Y")

def obtener_tasa_usd_hoy():
    try:
        hoy = hora_local()
        hoy_str = hoy.strftime("%d-%m-%Y")

        # Intentamos obtener la tasa desde Firebase
        valor = obtener_tasa_usd_firebase(hoy_str)

        # Si no encontramos la tasa en Firebase, la obtenemos del BCV
        if not valor:
            logger.info(f"Tasa de {hoy_str} no encontrada en Firebase. Intentando obtenerla desde el BCV...")
            resultado = obtener_tasa_usd_bcv_checker()
            if isinstance(resultado, dict) and resultado.get("fecha_valor") == hoy_str:
                valor = resultado.get("tasa")

        return valor or "No disponible", hoy_str, hoy_str

    except Exception as e:
        logger.error(f"❌ Error al obtener tasa desde Firestore o BCV: {e}")
        return "Error", None, None

def cargar_datos():
    datos = obtener_intervencion_firebase()
    return datos if datos else {
        "fecha": "",
        "intervencion": "",
        "usd": "",
        "monto": "",
        "notificado": False
    }

def guardar_datos(datos):
    guardar_intervencion_firebase(datos)

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
    msg += generar_firma()
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
    usuarios = obtener_usuarios_firebase()
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
            fecha_real = fecha_destino_tasa(nueva["fecha"])
            guardar_tasa_usd_firebase(fecha_real, nueva["usd"])
            logger.info(f"💾 Tasa guardada para {fecha_real}: {nueva['usd']}")
            mensaje = (
                f"📢 Nueva Intervención Cambiaria Detectada\n"
                f"📆 Fecha: {nueva['fecha']}\n"
                f"🔢 Nº: {nueva['intervencion']}\n"
                f"💵 Tipo de Cambio Bs./USD: {nueva['usd']}\n"
                f"💰 Tipo de Cambio Bs./EUR: {nueva['monto']}"
            )
            mensaje += generar_firma()
            await notificar_a_todos(app.bot, mensaje)
            logger.info("✅ Se notificó a todos.")
        else:
            logger.info("📭 Sin cambios.")
        await asyncio.sleep(1800)

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
                fecha_real = fecha_destino_tasa(nueva["fecha"])
                if not obtener_tasa_usd_firebase(fecha_real):
                    guardar_tasa_usd_firebase(fecha_real, nueva["usd"])
                    logger.info(f"💾 Tasa guardada para {fecha_real}: {nueva['usd']}")
                else:
                    logger.info(f"ℹ️ Tasa ya estaba guardada para {fecha_real}, no se sobrescribió.")

                logger.info(f"💾 Tasa guardada para {fecha_real}: {nueva['usd']}")
                mensaje = (
                    f"📢 Nueva Intervención Cambiaria Detectada\n"
                    f"📆 Fecha: {nueva['fecha']}\n"
                    f"🔢 Nº Intervención: {nueva['intervencion']}\n"
                    f"💵 Tipo de Cambio Bs./USD: {nueva['usd']}\n"
                    f"💰 Tipo de Cambio Bs./EUR: {nueva['monto']}"
                )
                mensaje += generar_firma()
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

async def enviar_recordatorio_donacion(bot):
    try:
        mensaje = (
            "¿Te ha sido útil este bot? Puedes apoyarlo con una donación ❤️\n\n"
            "👉 Usa el comando /donar para ver las opciones disponibles.\n"
            "¡Gracias por tu apoyo!"
        )
        await notificar_a_todos(bot, mensaje)
        logger.info("🎁 Recordatorio de donación enviado a todos.")
    except Exception as e:
        logger.error(f"❌ Error al enviar recordatorio de donación: {e}")
