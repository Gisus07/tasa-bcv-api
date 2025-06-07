import asyncio
import pytz
from datetime import datetime, timedelta, time
from notifier import (
    notificar_a_todos, enviar_recordatorio_donacion, generar_firma,
    hora_local, cargar_datos, guardar_datos, fecha_destino_tasa
)
from log_manager import logger
from bcv_checker import obtener_tasa_usd_bcv_checker, obtener_ultima_intervencion
from firebase_manager import eliminar_tasas_anteriores, obtener_tasa_usd_firebase, guardar_tasa_usd_firebase

ZONA_VE = pytz.timezone("America/Caracas")
tareas_programadas = []
# --- INICIAR SCHEDULER MANUAL CON ASYNCIO ---
def iniciar_scheduler(app):
    global tareas_programadas
    tareas_programadas.clear()
    tareas = [
        ejecutar_a_medianoche(), ejecutar_a_las_8_30(app), 
        # ejecutar_a_las_10_00(),
        ejecutar_el_dia_1_a_media_noche(app), ejecutar_cada_lunes_a_00_30(),
        verificar_y_ejecutar_si_es_necesario(), ejecutar_alerta_tasa_diaria(app),
        monitorear_entre_7y830(app),
    ]
    for coro in tareas:
        tareas_programadas.append(asyncio.create_task(coro))
    logger.info("🗓️ Scheduler manual iniciado")

# --- FUNCIONES ASÍNCRONAS DE CONTROL DE TIEMPO ---
async def esperar_hora_objetivo(hora_obj):
    while True:
        ahora = datetime.now(ZONA_VE)
        ejec = ahora.replace(hour=hora_obj.hour, minute=hora_obj.minute, second=0, microsecond=0)
        if ahora >= ejec:
            ejec += timedelta(days=1)
        try:
            await asyncio.sleep((ejec - ahora).total_seconds())
            if datetime.now(ZONA_VE).time() >= hora_obj:
                return
        except asyncio.CancelledError:
            logger.info(f"Tarea cancelada para hora {hora_obj.strftime('%H:%M')}")
            raise

async def esperar_proxima_fecha_objetivo(condicion):
    while True:
        ahora = datetime.now(ZONA_VE)
        if condicion(ahora):
            return
        await asyncio.sleep(max((ahora + timedelta(minutes=1)).replace(second=0, microsecond=0) - ahora, timedelta()).total_seconds())


# --- EJECUCIONES PROGRAMADAS ---
async def ejecutar_a_medianoche():
    await ejecutar_en_hora("00:00", _reset_diario_y_obtener_tasa)

async def ejecutar_a_las_8_30(app):
    await ejecutar_en_hora("08:30", _enviar_recordatorio(app))

async def ejecutar_en_hora(hora_str, funcion):
    while True:
        try:
            await esperar_hora_objetivo(datetime.strptime(hora_str, "%H:%M").time())
            await funcion()
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            logger.info(f"Tarea ejecutada en {hora_str} cancelada.")
            break

async def ejecutar_el_dia_1_a_media_noche(app):
    await ejecutar_en_fecha(lambda d: d.day == 1 and d.hour == 0 and d.minute == 0, _recordatorio_donacion(app))

async def ejecutar_cada_lunes_a_00_30():
    await ejecutar_en_fecha(lambda d: d.weekday() == 0 and d.hour == 0 and d.minute == 30, _limpieza_semanal())

async def ejecutar_en_fecha(condicion, funcion):
    while True:
        try:
            await esperar_proxima_fecha_objetivo(condicion)
            await funcion()
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            logger.info("Tarea ejecutada por condición de fecha cancelada.")
            break

async def _reset_diario_y_obtener_tasa():
    datos = cargar_datos()
    hoy = hora_local().strftime("%d-%m-%Y")
    datos.update({"tasa_notificada": False})
    if datos.get("fecha") != hoy:
        datos.update({"notificado": False})
    guardar_datos(datos)
    logger.info("🔄 Estado reiniciado. Ejecutando obtención de tasa diaria.")
    await _obtener_tasa_diaria()()


async def ejecutar_alerta_tasa_diaria(app):
    try:
        ahora = hora_local()
        hoy_str = ahora.strftime("%d-%m-%Y")
        estado = cargar_datos()

        # Reiniciar bandera si cambió la fecha
        if estado.get("fecha") != hoy_str:
            estado["tasa_notificada"] = False
            guardar_datos(estado)
            logger.info("🔁 Reinicio forzado de 'tasa_notificada' por nueva fecha.")

        # Verificar si ya se notificó o aún no es hora
        if estado.get("tasa_notificada"):
            logger.info("🔕 La tasa diaria ya fue notificada.")
            return

        if ahora.time() < time(7, 0):
            await esperar_hora_objetivo(time(7, 0))

        # Intentar obtener y notificar la tasa
        datos = obtener_tasa_usd_firebase(hoy_str)
        if datos:
            mensaje = (
                f"💵 Tasa oficial del día {hoy_str}:\n"
                f"• USD: {datos.get('valor', '?')} Bs.\n"
                f"• EUR: {datos.get('valorEur', '?')} Bs."
            )
            try:
                await notificar_a_todos(app.bot, mensaje)
                estado.update({"tasa_notificada": True, "fecha": hoy_str})
                guardar_datos(estado)
                logger.info("📨 Notificación de tasa diaria enviada con éxito.")
            except Exception as e:
                logger.error(f"❌ Error al enviar la tasa del día: {e}")
        else:
            logger.warning(f"⚠️ No hay datos de tasa para hoy {hoy_str}.")

    except asyncio.CancelledError:
        logger.info("Tarea 'ejecutar_alerta_tasa_diaria' cancelada.")


# --- Verificación de tasa pendiente (si se omitió a las 00:00) ---
async def verificar_y_ejecutar_si_es_necesario():
    intentos = 0
    while intentos < 5:
        try:
            hoy = datetime.now(ZONA_VE).strftime("%d-%m-%Y")
            if obtener_tasa_usd_firebase(hoy):
                logger.info("🛑 Tasa ya registrada. No es necesario verificar.")
                break

            logger.warning("⚠️ Tasa del día no registrada. Intentando ejecución manual...")
            await _obtener_tasa_diaria()()
            datos = cargar_datos()
            datos["tasa_notificada"] = False
            guardar_datos(datos)
            logger.info("📤 Estado actualizado: tasa_notificada=False")
            intentos += 1
            await asyncio.sleep(300)
        except Exception as e:
            logger.error(f"❌ Error al verificar retroactivamente: {e}")
            intentos += 1
            await asyncio.sleep(300)
        except asyncio.CancelledError:
            logger.info("Tarea 'verificar_y_ejecutar_si_es_necesario' cancelada.")
            break

async def monitorear_entre_7y830(app):
    ha_reportado_espera = False
    while True:
        ahora = hora_local()
        hora_actual = ahora.time()
        inicio, fin = time(7, 0), time(8, 30)
        hoy = ahora.strftime("%d-%m-%Y")

        if inicio <= hora_actual <= fin:
            ha_reportado_espera = False
            await verificar_durante_franja(app, hoy)
            await asyncio.sleep(120)
        elif hora_actual > fin:
            await manejar_fin_franja()
            siguiente_inicio = ahora.replace(hour=7, minute=0, second=0, microsecond=0) + timedelta(days=1)
            await asyncio.sleep((siguiente_inicio - ahora).total_seconds())
        else:
            if not ha_reportado_espera:
                logger.info("🌅 Aún no es hora (antes de las 7:00 AM). Esperando...")
                ha_reportado_espera = True
            await asyncio.sleep(1800)

async def verificar_durante_franja(app, hoy):
    datos = cargar_datos()
    if datos.get("notificado") and datos.get("fecha") == hoy:
        logger.info(f"🛑 Intervención del {hoy} ya notificada.")
        return

    logger.info("⏱️ Verificando intervención cambiaria BCV...")
    nueva = obtener_ultima_intervencion()

    if nueva and nueva["fecha"] != datos.get("fecha") and nueva["fecha"] == hoy:
        logger.info("🎉 ¡Intervención detectada!")
        nueva["notificado"] = True
        guardar_datos(nueva)

        fecha_real = fecha_destino_tasa(nueva["fecha"])
        if not obtener_tasa_usd_firebase(fecha_real):
            guardar_tasa_usd_firebase(fecha_real, nueva["usd"])
            logger.info(f"💾 Tasa guardada para {fecha_real}.")

        await notificar_intervencion(app, nueva)
    else:
        if datos.get("fecha") != hoy:
            datos.update({"fecha": hoy, "notificado": True})
            guardar_datos(datos)
            logger.info(f"✅ Sin intervención. Estado actualizado para {hoy}.")
        else:
            logger.info("📭 Sin cambios relevantes en intervención.")

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
        usd_texto = f"{usd.get('valor') or usd.get('tasa') or '?'} (📅 {usd.get('fecha_valor', '?')})"
    else:
        usd_texto = usd

    mensaje = (
        f"📢 Nueva Intervención Cambiaria Detectada\n"
        f"📆 Fecha: {nueva['fecha']}\n"
        f"🔢 Nº: {nueva['intervencion']}\n"
        f"💵 Tipo de Cambio Bs./USD: {usd_texto}\n"
        f"💰 Tipo de Cambio Bs./EUR: {nueva.get('monto', '?')}"
    ) + generar_firma()

    await notificar_a_todos(app.bot, mensaje)
    logger.info("✅ Intervención notificada exitosamente.")

async def manejar_fin_franja():
    datos = cargar_datos()
    hoy = hora_local().strftime("%d-%m-%Y")
    datos["tasa_notificada"] = True
    guardar_datos(datos)
    logger.info(f"💾 Fin de monitoreo: tasa_notificada={datos['tasa_notificada']} para {hoy}")

# --- FUNCIONES ENVOLTORIO ---
def _enviar_recordatorio(app):
    async def inner():
        hoy_para_comparacion = hora_local().strftime("%d-%m-%Y")
        datos = cargar_datos()
        fecha_valor = datos.get("usd", {}).get("fecha_valor", "")
        if datos.get("tasa_notificada", False) and fecha_valor == hoy_para_comparacion:
            logger.info(f"🚫 No se envía recordatorio a las 08:30 AM. La tasa del día {hoy_para_comparacion} ya fue notificada o procesada.")
            return

        ahora_mensaje = datetime.now(ZONA_VE).strftime("%d/%m/%Y %H:%M")
        mensaje = (
            f"📢 Recordatorio automático:\n"
            f"🕘 {ahora_mensaje}\n"
            f"No se ha detectado una nueva intervención."
        )
        try:
            await notificar_a_todos(app.bot, mensaje)
            logger.info("📢 Recordatorio diario enviado con éxito")
            datos["tasa_notificada"] = True
            guardar_datos(datos)
        except Exception as e:
            logger.error(f"❌ Error al enviar recordatorio diario: {e}")
    return inner

def _recordatorio_donacion(app):
    async def inner():
        try:
            await enviar_recordatorio_donacion(app.bot)
            logger.info("💸 Recordatorio de donación mensual enviado")
        except Exception as e:
            logger.error(f"❌ Error al enviar recordatorio de donación: {e}")
    return inner

def _limpieza_semanal():
    async def inner():
        try:
            eliminadas = eliminar_tasas_anteriores()
            logger.info(f"🧹 Limpieza semanal completada: {eliminadas} tasas eliminadas.")
        except Exception as e:
            logger.error(f"❌ Error durante la limpieza semanal: {e}")
    return inner

def _obtener_tasa_diaria():
    async def inner():
        hoy = datetime.now(ZONA_VE).date()

        try:
            resultado = obtener_tasa_usd_bcv_checker()

            if not isinstance(resultado, dict):
                logger.warning("⛔ Resultado inválido desde el BCV.")
                return

            fecha_valor_str = resultado["fecha_valor"]
            fecha_valor = datetime.strptime(fecha_valor_str, "%d-%m-%Y").date()

            # Guardar tasa si no existe
            if not obtener_tasa_usd_firebase(fecha_valor_str):
                guardar_tasa_usd_firebase(fecha_valor_str, {
                    "fecha_valor": fecha_valor_str,
                    "valor": resultado["valor"],
                    "valorEur": resultado["valorEur"]
                })
                logger.info(
                    f"✅ Tasa oficial guardada para {fecha_valor_str}: "
                    f"{resultado['valor']} USD, {resultado['valorEur']} EUR"
                )
            else:
                logger.info(f"✅ Tasa ya registrada para {fecha_valor_str}")

            # Si la fecha publicada es futura, propagar la última tasa conocida
            if fecha_valor > hoy:
                tasa_anterior = _buscar_tasa_anterior(hoy)
                if not tasa_anterior:
                    logger.warning("⚠️ No se encontró una tasa anterior para propagar.")
                    return

                _propagar_tasa(hoy, fecha_valor, tasa_anterior)

        except Exception as e:
            logger.error(f"❌ Error en obtener_tasa_diaria: {e}")

    return inner

# Función auxiliar para buscar tasa anterior
def _buscar_tasa_anterior(hoy):
    for delta in range(1, 8):
        fecha_anterior = hoy - timedelta(days=delta)
        fecha_anterior_str = fecha_anterior.strftime("%d-%m-%Y")
        datos = obtener_tasa_usd_firebase(fecha_anterior_str)
        if isinstance(datos, dict) and "valor" in datos:
            return {
                "fecha_valor": fecha_anterior_str,
                "valor": datos["valor"],
                "valorEur": datos.get("valorEur", "No disponible")
            }
    return None

# Función auxiliar para propagar tasa anterior a días intermedios
def _propagar_tasa(inicio, fin, tasa):
    dias_intermedios = (fin - inicio).days
    for i in range(dias_intermedios):
        fecha = inicio + timedelta(days=i)
        fecha_str = fecha.strftime("%d-%m-%Y")
        if not obtener_tasa_usd_firebase(fecha_str):
            guardar_tasa_usd_firebase(fecha_str, {
                "fecha_valor": tasa["fecha_valor"],
                "valor": tasa["valor"],
                "valorEur": tasa["valorEur"]
            })
            logger.info(
                f"🕒 Tasa propagada para {fecha_str} usando la del {tasa['fecha_valor']}"
            )
