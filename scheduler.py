import asyncio
import pytz
from datetime import datetime, timedelta
from notifier import notificar_a_todos, enviar_recordatorio_donacion
from log_manager import logger
from bcv_checker import obtener_tasa_usd_bcv_checker
from firebase_manager import eliminar_tasas_anteriores, obtener_tasa_usd_firebase, guardar_tasa_usd_firebase

ZONA_VE = pytz.timezone("America/Caracas")

# Lista global para mantener un registro de las tareas en segundo plano
# Es importante que esta lista esté accesible para la función de cierre.
tareas_programadas = []

# --- INICIAR SCHEDULER MANUAL CON ASYNCIO ---
def iniciar_scheduler(app):
    global tareas_programadas # Asegúrate de usar la variable global

    # Limpia la lista de tareas_programadas si ya contiene elementos (para evitar duplicados en reinicios)
    # Aunque la idea es que solo se llame una vez.
    tareas_programadas.clear() 

    tareas_a_crear = [
        ejecutar_a_medianoche(app),
        ejecutar_a_las_8_30(app),
        ejecutar_a_las_10_00(app),
        ejecutar_el_dia_1_a_media_noche(app),
        ejecutar_cada_lunes_a_00_30(),
        verificar_y_ejecutar_si_es_necesario(app), # Asegúrate de pasar 'app' si lo necesita
        ejecutar_alerta_tasa_diaria(app),
    ]
    for tarea_coro in tareas_a_crear:
        task = asyncio.create_task(tarea_coro)
        tareas_programadas.append(task)
    logger.info("🗓️ Scheduler manual iniciado")

# --- FUNCIONES ASÍNCRONAS DE CONTROL DE TIEMPO ---
async def esperar_hora_objetivo(hora_objetivo):
    while True:
        ahora = datetime.now(ZONA_VE)
        # Calcula el tiempo hasta la próxima hora objetivo
        proxima_ejecucion = ahora.replace(hour=hora_objetivo.hour, minute=hora_objetivo.minute, second=0, microsecond=0)
        if ahora >= proxima_ejecucion: # Si la hora objetivo ya pasó hoy, programar para mañana
            proxima_ejecucion += timedelta(days=1)
        
        tiempo_espera = (proxima_ejecucion - ahora).total_seconds()
        
        logger.debug(f"Esperando hasta {proxima_ejecucion.strftime('%H:%M')} ({tiempo_espera:.2f} segundos)")
        try:
            await asyncio.sleep(tiempo_espera) # Espera directamente al momento
            # Verifica si la hora actual es la hora objetivo para ejecutar
            ahora_despues_espera = datetime.now(ZONA_VE)
            if ahora_despues_espera.hour == hora_objetivo.hour and ahora_despues_espera.minute == hora_objetivo.minute:
                return
        except asyncio.CancelledError:
            logger.info(f"Tarea 'esperar_hora_objetivo' para {hora_objetivo.strftime('%H:%M')} cancelada.")
            raise # Re-lanza la excepción para que la tarea que la llamó también se cancele

async def esperar_proxima_fecha_objetivo(condicion):
    while True:
        ahora = datetime.now(ZONA_VE)
        if condicion(ahora):
            return
        # Espera hasta el siguiente minuto para re-evaluar la condición
        proximo_minuto = (ahora + timedelta(minutes=1)).replace(second=0, microsecond=0)
        tiempo_espera = (proximo_minuto - ahora).total_seconds()
        try:
            await asyncio.sleep(tiempo_espera if tiempo_espera > 0 else 60) # Espera al menos 60 segundos si ya pasó el minuto
        except asyncio.CancelledError:
            logger.info(f"Tarea 'esperar_proxima_fecha_objetivo' cancelada.")
            raise # Re-lanza la excepción para que la tarea que la llamó también se cancele


# --- EJECUCIONES PROGRAMADAS ---
async def ejecutar_a_medianoche(app):
    while True:
        try:
            await esperar_hora_objetivo(datetime.strptime("00:00", "%H:%M").time())
            logger.info("⚡ Ejecutando tarea de medianoche (obtener tasa diaria)...")
            await _obtener_tasa_diaria()()
            # Espera un tiempo para evitar múltiples ejecuciones en el mismo minuto
            await asyncio.sleep(60) 
        except asyncio.CancelledError:
            logger.info("Tarea 'ejecutar_a_medianoche' cancelada.")
            break # Sale del bucle while True

async def ejecutar_a_las_8_30(app):
    while True:
        try:
            await esperar_hora_objetivo(datetime.strptime("08:30", "%H:%M").time())
            logger.info("⚡ Ejecutando tarea de las 08:30 (enviar recordatorio)...")
            await _enviar_recordatorio(app)()
            await asyncio.sleep(60) 
        except asyncio.CancelledError:
            logger.info("Tarea 'ejecutar_a_las_8_30' cancelada.")
            break

async def ejecutar_a_las_10_00(app):
    while True:
        try:
            await esperar_hora_objetivo(datetime.strptime("10:00", "%H:%M").time())
            logger.info("⚡ Ejecutando tarea de las 10:00 (obtener tasa diaria)...")
            await _obtener_tasa_diaria()()
            await asyncio.sleep(60) 
        except asyncio.CancelledError:
            logger.info("Tarea 'ejecutar_a_las_10_00' cancelada.")
            break

async def ejecutar_el_dia_1_a_media_noche(app):
    while True:
        try:
            # Condición para el día 1 a medianoche
            await esperar_proxima_fecha_objetivo(lambda ahora: ahora.day == 1 and ahora.hour == 0 and ahora.minute == 0)
            logger.info("⚡ Ejecutando tarea del día 1 (recordatorio donación)...")
            await _recordatorio_donacion(app)()
            await asyncio.sleep(60) # Espera para no repetir en el mismo minuto
        except asyncio.CancelledError:
            logger.info("Tarea 'ejecutar_el_dia_1_a_media_noche' cancelada.")
            break

async def ejecutar_cada_lunes_a_00_30():
    while True:
        try:
            # Condición para cada lunes a las 00:30
            await esperar_proxima_fecha_objetivo(lambda ahora: ahora.weekday() == 0 and ahora.hour == 0 and ahora.minute == 30)
            logger.info("⚡ Ejecutando tarea de limpieza semanal...")
            await _limpieza_semanal()()
            await asyncio.sleep(60) # Espera para no repetir en el mismo minuto
        except asyncio.CancelledError:
            logger.info("Tarea 'ejecutar_cada_lunes_a_00_30' cancelada.")
            break

async def ejecutar_alerta_tasa_diaria(app):
    while True:
        try:
            await esperar_hora_objetivo(datetime.strptime("07:00", "%H:%M").time())
            logger.info("⚡ Ejecutando tarea de alerta de tasa diaria...")
            hoy = datetime.now(ZONA_VE).strftime("%d-%m-%Y")
            datos = obtener_tasa_usd_firebase(hoy)
            if datos:
                mensaje = (
                    f"💵 Tasa oficial del día {hoy}:\n"
                    f"• USD: {datos.get('valor', '?')} Bs.\n"
                    f"• EUR: {datos.get('valorEur', '?')} Bs."
                )
                try:
                    # Asumiendo que notificar_a_todos ya escapa el mensaje si usa MarkdownV2
                    await notificar_a_todos(app.bot, mensaje) 
                    logger.info("📨 Notificación de tasa diaria enviada con éxito.")
                except Exception as e:
                    logger.error(f"❌ Error al enviar la tasa del día: {e}")
            else:
                logger.warning(f"⚠️ No hay datos de tasa para hoy {hoy}.")
            await asyncio.sleep(60) # Espera para no repetir en el mismo minuto
        except asyncio.CancelledError:
            logger.info("Tarea 'ejecutar_alerta_tasa_diaria' cancelada.")
            break

# --- Verificación de tasa pendiente (si se omitió a las 00:00) ---
async def verificar_y_ejecutar_si_es_necesario(app): # Asegúrate de pasar 'app'
    while True:
        try:
            ahora = datetime.now(ZONA_VE)
            # Solo corre esta verificación una vez al día o en momentos clave si es necesario
            # Por simplicidad, la haremos cada 5 minutos durante todo el día para ver si se omitió la medianoche
            # Puedes ajustar la lógica para que sea menos frecuente si es necesario.
            
            hoy = ahora.strftime("%d-%m-%Y")
            if not _tasa_ya_registrada(hoy):
                # Esto es para asegurar que si el bot se reinicia y la tasa de medianoche no se grabó,
                # se intente obtenerla.
                logger.warning("⚠️ No se ejecutó correctamente la tasa a las 00:00 o no está registrada. Intentando ejecutarla ahora.")
                try:
                    await _obtener_tasa_diaria()()
                except Exception as e:
                    logger.error(f"❌ Error al ejecutar verificación retroactiva: {e}")
            
            # Ajusta el tiempo de espera según la frecuencia deseada para esta verificación
            await asyncio.sleep(300) # Espera 5 minutos antes de volver a verificar
        except asyncio.CancelledError:
            logger.info("Tarea 'verificar_y_ejecutar_si_es_necesario' cancelada.")
            break

# --- FUNCIONES ENVOLTORIO ---
# (Mantienen su estructura, pero es importante que las funciones internas sean `async`)

def _enviar_recordatorio(app):
    async def inner():
        ahora = datetime.now(ZONA_VE).strftime("%d/%m/%Y %H:%M")
        mensaje = f"📢 Recordatorio automático:\n🕘 {ahora}\nNo se ha detectado una nueva intervención aún."
        try:
            await notificar_a_todos(app.bot, mensaje)
            logger.info("📢 Recordatorio diario enviado con éxito")
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
            resultado = obtener_tasa_usd_bcv_checker() # ← función que devuelve valor y valorEur
            if not isinstance(resultado, dict):
                logger.warning("⛔ Resultado inválido desde el BCV.")
                return

            fecha_valor_str = resultado["fecha_valor"]
            fecha_valor = datetime.strptime(fecha_valor_str, "%d-%m-%Y").date()

            # Guardar la nueva tasa solo para la fecha valor oficial
            if not obtener_tasa_usd_firebase(fecha_valor_str):
                guardar_tasa_usd_firebase(fecha_valor_str, {
                    "fecha_valor": fecha_valor_str,
                    "valor": resultado["valor"],
                    "valorEur": resultado["valorEur"]
                })
                logger.info(f"✅ Tasa oficial guardada para {fecha_valor_str}: {resultado['valor']} USD, {resultado['valorEur']} EUR")
            else:
                logger.info(f"✅ Tasa ya registrada para {fecha_valor_str}")

            # Si la fecha valor es futura, rellenar días entre hoy y fecha_valor
            if fecha_valor > hoy:
                tasa_anterior = None
                for delta in range(1, 8):
                    fecha_anterior = hoy - timedelta(days=delta)
                    fecha_anterior_str = fecha_anterior.strftime("%d-%m-%Y")
                    anterior_data = obtener_tasa_usd_firebase(fecha_anterior_str)
                    if isinstance(anterior_data, dict) and "valor" in anterior_data:
                        tasa_anterior = {
                            "valor": anterior_data["valor"],
                            "valorEur": anterior_data.get("valorEur", "No disponible"),
                            "fecha_valor": fecha_anterior_str
                        }
                        break

                if not tasa_anterior:
                    logger.warning("⚠️ No se encontró una tasa anterior para propagar.")
                    return

                # Rellenar días intermedios con la tasa anterior
                dias_intermedios = (fecha_valor - hoy).days
                for i in range(dias_intermedios):
                    fecha_intermedia = hoy + timedelta(days=i)
                    fecha_intermedia_str = fecha_intermedia.strftime("%d-%m-%Y")

                    if not obtener_tasa_usd_firebase(fecha_intermedia_str):
                        guardar_tasa_usd_firebase(fecha_intermedia_str, {
                            "fecha_valor": tasa_anterior["fecha_valor"],
                            "valor": tasa_anterior["valor"],
                            "valorEur": tasa_anterior["valorEur"]
                        })
                        logger.info(
                            f"🕒 Tasa propagada para {fecha_intermedia_str} usando la del {tasa_anterior['fecha_valor']}"
                        )

        except Exception as e:
            logger.error(f"❌ Error en obtener_tasa_diaria: {e}")

    return inner

def _tasa_ya_registrada(hoy):
    tasa = obtener_tasa_usd_firebase(hoy)
    if tasa:
        logger.info(f"🔁 La tasa del {hoy} ya está registrada: {tasa}")
        return True
    logger.info(f"⏳ Tasa del día {hoy} no encontrada. Obteniendo desde BCV...")
    return False