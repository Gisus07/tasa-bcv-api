import pytz
import asyncio
from telegram import Update
from telegram.ext import ContextTypes
from telegram.error import Forbidden, TelegramError
from firebase_manager import obtener_usuarios_firebase,obtener_intervencion_firebase, guardar_intervencion_firebase, obtener_tasa_usd_firebase
from bcv_checker import obtener_ultima_intervencion, obtener_tasa_usd_bcv_checker
from datetime import datetime, time, timedelta
from log_manager import logger
from firebase_manager import guardar_tasa_usd_firebase, obtener_intervencion_firebase, eliminar_usuario_firebase

ZONA_VE = pytz.timezone("America/Caracas")

def hora_local():
    return datetime.now(ZONA_VE)

def generar_firma():
    ahora = datetime.now(ZONA_VE)
    fecha_firma = ahora.strftime("%Y%m%d\-%H%M")  # <- escapa el guion
    return f"\n\n🔏 \\`BCV\\-BOT/{fecha_firma}\\`"

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
        data = obtener_tasa_usd_firebase(hoy_str)

        # Si no encontramos la tasa, hacemos scraping desde el BCV
        if not data:
            logger.info(f"Tasa de {hoy_str} no encontrada en Firebase. Intentando obtenerla desde el BCV...")
            resultado = obtener_tasa_usd_bcv_checker()  # ← función nueva que devuelve USD y EUR

            if isinstance(resultado, dict):
                fecha_valor = resultado.get("fecha_valor")

                if fecha_valor == hoy_str:
                    try:
                        valor_usd = float(resultado.get("valor"))
                        valor_eur = float(resultado.get("valorEur"))

                        doc_data = {
                            "fecha_valor": fecha_valor,
                            "valor": valor_usd,
                            "valorEur": valor_eur
                        }

                        guardar_tasa_usd_firebase(hoy_str, doc_data)
                        logger.info(f"✅ Tasa del día {hoy_str} registrada: {doc_data}")
                        data = doc_data
                    except (ValueError, TypeError):
                        logger.error(f"❌ Error al convertir las tasas: {resultado}")
                else:
                    logger.warning(f"⛔ La fecha valor '{fecha_valor}' no coincide con hoy '{hoy_str}'. No se guarda la tasa.")
        
        # Extraer valores para retorno
        if isinstance(data, dict):
            valor = data.get("valor", "No disponible")
            valorEur = data.get("valorEur", "No disponible")
        else:
            valor = data
            valorEur = "No disponible"

        return valor, hoy_str, valorEur, hoy_str

    except Exception as e:
        logger.error(f"❌ Error al obtener o guardar la tasa desde Firestore o BCV: {e}")
        return "Error", None, None, None

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
        datos = obtener_intervencion_firebase()
        if not datos:
            datos = obtener_ultima_intervencion()
            if datos:
                guardar_datos({**datos, "notificado": False})
    except Exception as e:
        logger.error(f"❌ Error al obtener datos de Firebase o BCV: {e}")
        datos = None

    if datos:
        usd = datos.get("usd", "?")
        print(f"USD obtenido: {usd}")
        if isinstance(usd, dict):
            tasa = usd.get("valor", "?")
            fecha_valor = usd.get("fecha_valor", "?")
            usd_texto = f"{tasa} (📅 {fecha_valor})"
        else:
            usd_texto = usd

        msg = (
            f"📆 Fecha: {datos.get('fecha', '?')}\n"
            f"🔢 Nº Intervención: {datos.get('intervencion', '?')}\n"
            f"💵 Tipo de Cambio Bs./USD: {usd_texto}\n"
            f"💰 Tipo de Cambio Bs./EUR: {datos.get('monto', '?')}"
        )
    else:
        msg = "⚠️ No se pudo obtener la información del BCV."

    msg += generar_firma()
    await update.message.reply_text(msg)

async def tasa_actual(update: Update, context: ContextTypes.DEFAULT_TYPE):
    valor, fecha_mostrada, valorEur, _ = obtener_tasa_usd_hoy()

    if valor in ["No disponible", "Error"]:
        mensaje = f"⚠️ No se pudo obtener la tasa del día {fecha_mostrada or 'actual'}"
    else:
        if isinstance(valor, dict):
            tasa = valor.get("valor", "?")
        else:
            tasa = valor

        # Validar si valorEur es numérico
        try:
            valor_eur_valido = float(valorEur)
            eur_str = f"\n💰 Bs./EUR: {valor_eur_valido}"
        except (ValueError, TypeError):
            eur_str = ""

        mensaje = (
            f"💵 Tasa oficial del día {fecha_mostrada}\n"
            f"💰 Bs./USD: {tasa}{eur_str}"
        )

    await update.message.reply_text(mensaje)

async def notificar_a_todos(bot, mensaje: str):
    usuarios = obtener_usuarios_firebase()
    if not usuarios:
        logger.warning("⚠️ No hay usuarios registrados para notificar.")
        return

    async def notificar(uid):
        try:
            await bot.send_message(chat_id=uid, text=mensaje)
        except Forbidden:
            logger.warning(f"🚫 Usuario {uid} bloqueó al bot. Eliminando de la base.")
            eliminar_usuario_firebase(uid)
        except TelegramError as e:
            logger.error(f"❌ Error de Telegram al notificar a {uid}: {e}")
        except Exception as e:
            logger.error(f"❌ Error inesperado al notificar a {uid}: {e}")

    try:
        await asyncio.gather(*(notificar(uid) for uid in usuarios))
        logger.info(f"✅ Notificación enviada a {len(usuarios)} usuarios.")
    except Exception as e:
        logger.error(f"❌ Error en la ejecución paralela de notificaciones: {e}")

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