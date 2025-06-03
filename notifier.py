import pytz
import asyncio
from telegram import Update
from telegram.ext import ContextTypes
from telegram.error import NetworkError
from firebase_manager import obtener_usuarios_firebase,obtener_intervencion_firebase, guardar_intervencion_firebase, obtener_tasa_usd_firebase
from bcv_checker import obtener_ultima_intervencion, obtener_tasa_usd_bcv_checker
from datetime import datetime, time, timedelta
from log_manager import logger
from firebase_manager import guardar_tasa_usd_firebase, obtener_intervencion_firebase

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
            f"💵 Tasa USD según BCV\n"
            f"📅 {fecha_mostrada}\n"
            f"💰 Bs./USD: {tasa}{eur_str}"
        )

    await update.message.reply_text(mensaje)

async def notificar_a_todos(bot, mensaje):
    usuarios = obtener_usuarios_firebase()
    for uid in usuarios:
        try:
            await bot.send_message(chat_id=uid, text=mensaje)
        except NetworkError as e:
            logger.warning(f"🌐 Error de red al notificar a {uid}. Reintentando en 3s...")
            await asyncio.sleep(3)
            try:
                await bot.send_message(chat_id=uid, text=mensaje)
            except Exception as e2:
                logger.error(f"❌ Segundo intento fallido para {uid}: {e2}")
        except Exception as e:
            logger.error(f"❌ Error inesperado al notificar a {uid}: {e}")

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
            usd = nueva["usd"]
            if isinstance(usd, dict):
                tasa = usd.get("tasa", "?")
                fecha_valor = usd.get("fecha_valor", "?")
                usd_texto = f"{tasa} (📅 {fecha_valor})"
            else:
                usd_texto = usd

            mensaje = (
                f"📢 Nueva Intervención Cambiaria Detectada\n"
                f"📆 Fecha: {nueva['fecha']}\n"
                f"🔢 Nº: {nueva['intervencion']}\n"
                f"💵 Tipo de Cambio Bs./USD: {usd_texto}\n"
                f"💰 Tipo de Cambio Bs./EUR: {nueva['monto']}"
            )

            mensaje += generar_firma()
            await notificar_a_todos(app.bot, mensaje)
            logger.info("✅ Se notificó a todos.")
        else:
            logger.info("📭 Sin cambios.")
        await asyncio.sleep(1800)

async def monitorear_entre_7y830(app):
    ha_reportado_espera = False  # Para evitar repetir el log antes de las 7:00

    while True:
        ahora = hora_local()
        hora_actual = ahora.time()
        inicio, fin = time(7, 0), time(8, 30)
        hoy = ahora.strftime("%d-%m-%Y")

        if inicio <= hora_actual <= fin:
            ha_reportado_espera = False  # Reset log una vez entre en franja
            await verificar_durante_franja(app, hoy)
            await asyncio.sleep(120)  # Cada 2 min durante la franja
        elif hora_actual > fin:
            await manejar_fin_franja()
            siguiente_inicio = ahora.replace(hour=7, minute=0, second=0, microsecond=0) + timedelta(days=1)
            await asyncio.sleep((siguiente_inicio - ahora).total_seconds())
        else:
            if not ha_reportado_espera:
                logger.info("🌅 Aún no es hora (antes de las 7:00 AM). Esperando...")
                ha_reportado_espera = True
            await asyncio.sleep(1800)  # Esperar 30 minutos antes de volver a revisar

# ------------------ FUNCIONES AUXILIARES ------------------

async def verificar_durante_franja(app, hoy):
    datos = cargar_datos()
    if datos.get("notificado", False):
        logger.info("🛑 Ya se notificó hoy. Esperando siguiente franja.")
        return

    logger.info("⏱️ Verificando BCV (franja 7:00–8:30 AM)...")
    nueva = obtener_intervencion_segura()
    if not es_intervencion_valida(nueva, datos, hoy):
        logger.info("📭 Sin cambios.")
        return

    procesar_nueva_intervencion(nueva)
    await notificar_intervencion(app, nueva)

def obtener_intervencion_segura():
    try:
        return obtener_ultima_intervencion()
    except Exception as e:
        logger.error(f"❌ Error al obtener datos del BCV: {e}")
        return None

def es_intervencion_valida(nueva, datos_actuales, hoy):
    return nueva and nueva["fecha"] != datos_actuales["fecha"] and nueva["fecha"] == hoy

def procesar_nueva_intervencion(nueva):
    nueva["notificado"] = True
    guardar_datos(nueva)

    fecha_real = fecha_destino_tasa(nueva["fecha"])
    if not obtener_tasa_usd_firebase(fecha_real):
        guardar_tasa_usd_firebase(fecha_real, nueva["usd"])
        logger.info(f"💾 Tasa guardada para {fecha_real}: {nueva['usd']}")
    else:
        logger.info(f"ℹ️ Tasa ya estaba guardada para {fecha_real}, no se sobrescribió.")

async def notificar_intervencion(app, nueva):
    usd = nueva["usd"]
    if isinstance(usd, dict):
        tasa = usd.get("tasa", "?")
        fecha_valor = usd.get("fecha_valor", "?")
        usd_texto = f"{tasa} (📅 {fecha_valor})"
    else:
        usd_texto = usd

    mensaje = (
        f"📢 Nueva Intervención Cambiaria Detectada\n"
        f"📆 Fecha: {nueva['fecha']}\n"
        f"🔢 Nº: {nueva['intervencion']}\n"
        f"💵 Tipo de Cambio Bs./USD: {usd_texto}\n"
        f"💰 Tipo de Cambio Bs./EUR: {nueva['monto']}"
    ) + generar_firma()

    await notificar_a_todos(app.bot, mensaje)
    logger.info("✅ Intervención detectada y notificada.")

async def manejar_fin_franja():
    datos = cargar_datos()
    if not datos.get("notificado", False):
        logger.info("📌 No hubo intervención hoy. Fin del monitoreo diario.")
    else:
        logger.info("🛑 Ya se notificó hoy. Descansando hasta mañana.")

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
