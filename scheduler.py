import asyncio
import pytz
from datetime import datetime, timedelta, time
from notifier import notificar_a_todos, enviar_recordatorio_donacion, generar_firma, hora_local, cargar_datos, guardar_datos, fecha_destino_tasa
from log_manager import logger
from bcv_checker import obtener_tasa_usd_bcv_checker, obtener_ultima_intervencion
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
        monitorear_entre_7y830(app), # Nueva tarea programada
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
            logger.info("⚡ Ejecutando tarea de medianoche (obtener tasa diaria y resetear estados)...")

            # --- NUEVA LÓGICA DE RESETEO DIARIO ---
            datos = cargar_datos()
            hoy = hora_local().strftime("%d-%m-%Y")
            # Solo resetea si la fecha guardada es de un día anterior, para iniciar el nuevo día "limpio"
            # Reseteo diario a medianoche
            datos["tasa_notificada"] = False  # Siempre se reinicia
            if datos.get("fecha") != hoy:
                datos["notificado"] = False
                logger.info("🔄 Bandera 'notificado' reseteada (nueva fecha detectada).")

            guardar_datos(datos)
            logger.info("🔄 Bandera 'tasa_notificada' reiniciada para el nuevo día.")

            # --- FIN LÓGICA DE RESETEO ---

            await _obtener_tasa_diaria()() # Esto podría actualizar tasa_notificada a True si ya existe la tasa

            await asyncio.sleep(60) 
        except asyncio.CancelledError:
            logger.info("Tarea 'ejecutar_a_medianoche' cancelada.")
            break

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
            ahora = hora_local()
            hoy_str = ahora.strftime("%d-%m-%Y")
            estado = cargar_datos()

            # 🔁 Reparar inconsistencia si fecha anterior tiene tasa_notificada en True
            if estado.get("fecha") != hoy_str:
                estado["tasa_notificada"] = False
                guardar_datos(estado)
                logger.info("🔁 Reinicio forzado de 'tasa_notificada' por nueva fecha.")

            if not estado.get("tasa_notificada", False):
                if ahora.time() >= time(7, 0):  # Ya pasaron las 07:00
                    datos = obtener_tasa_usd_firebase(hoy_str)
                    if datos:
                        mensaje = (
                            f"💵 Tasa oficial del día {hoy_str}:\n"
                            f"• USD: {datos.get('valor', '?')} Bs.\n"
                            f"• EUR: {datos.get('valorEur', '?')} Bs."
                        )
                        try:
                            await notificar_a_todos(app.bot, mensaje)
                            estado["tasa_notificada"] = True
                            estado["fecha"] = hoy_str  # opcional para consistencia
                            guardar_datos(estado)
                            logger.info("📨 Notificación de tasa diaria enviada con éxito (ejecución inmediata).")
                        except Exception as e:
                            logger.error(f"❌ Error al enviar la tasa del día: {e}")
                    else:
                        logger.warning(f"⚠️ No hay datos de tasa para hoy {hoy_str}.")
                else:
                    await esperar_hora_objetivo(time(7, 0))
                    continue
            else:
                logger.info("🔕 La tasa diaria ya fue notificada.")
            break
        except asyncio.CancelledError:
            logger.info("Tarea 'ejecutar_alerta_tasa_diaria' cancelada.")
            break

# --- Verificación de tasa pendiente (si se omitió a las 00:00) ---
async def verificar_y_ejecutar_si_es_necesario(app):
    intentos_fallidos = 0
    while True:
        try:
            ahora = datetime.now(ZONA_VE)
            hoy = ahora.strftime("%d-%m-%Y")

            if _tasa_ya_registrada(hoy):
                logger.info("🛑 Tasa ya registrada correctamente. Finalizando verificación retroactiva.")
                break

            logger.warning("⚠️ No se ejecutó correctamente la tasa a las 00:00 o no está registrada. Intentando ejecutarla ahora.")

            try:
                await _obtener_tasa_diaria()()
                
                # 🩹 Corrección: asegurar tasa_notificada = False en Firebase tras guardar tasa
                datos = cargar_datos()
                datos["tasa_notificada"] = False
                guardar_datos(datos)
                logger.info("📤 Estado actualizado en Firebase con tasa_notificada=False (verificación retroactiva)")

                intentos_fallidos += 1

            except Exception as e:
                logger.error(f"❌ Error al ejecutar verificación retroactiva: {e}")
                intentos_fallidos += 1

            if intentos_fallidos >= 5:
                logger.error("❌ Se alcanzó el límite de intentos fallidos. Deteniendo verificación retroactiva.")
                break

            await asyncio.sleep(300)

        except asyncio.CancelledError:
            logger.info("Tarea 'verificar_y_ejecutar_si_es_necesario' cancelada.")
            break

# --- FUNCIONES ENVUELTAS Y MOVIDAS DE NOTIFIER ---

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

# ------------------ FUNCIONES AUXILIARES MOVIDAS ------------------

async def verificar_durante_franja(app, hoy):
    datos = cargar_datos()
    fecha_datos_guardados = datos.get("fecha", "") # Renombrado para mayor claridad

    # 1. Si ya se notificó una intervención (nueva o heredada) para HOY, salimos.
    #    'datos.get("notificado", False)' se refiere a la última intervención procesada.
    #    Si esa última intervención fue de hoy y ya se notificó, significa que ya hicimos nuestro trabajo.
    if datos.get("notificado", False) and fecha_datos_guardados == hoy:
        logger.info(f"🛑 Intervención del día {hoy} ya notificada (o procesada). Esperando siguiente franja.")
        return

    logger.info("⏱️ Verificando BCV (franja 7:00–8:30 AM)...")
    nueva_intervencion_bcv = obtener_intervencion_segura()

    # 2. Verificar si hay una NUEVA intervención del BCV para HOY
    if es_intervencion_valida(nueva_intervencion_bcv, datos, hoy):
        logger.info("🎉 ¡Nueva Intervención BCV detectada para hoy!")
        procesar_nueva_intervencion(nueva_intervencion_bcv) # Esto actualiza datos.json y Firebase
        await notificar_intervencion(app, nueva_intervencion_bcv)
    else:
        # 3. Si NO hay nueva intervención para HOY, pero estamos en la franja y es la primera vez que lo notamos hoy.
        #    Esto se refiere a la lógica que quieres cambiar: si no hubo nueva,
        #    queremos marcar que la situación del día YA FUE VERIFICADA y "notificada" internamente.
        #    La condición "fecha_datos_guardados != hoy" asegura que solo lo hagamos si el registro
        #    guardado es de un día anterior.
        if fecha_datos_guardados != hoy:
            # Actualizar los datos guardados para el día actual con la información "antigua"
            # y marcarla como notificada para hoy.
            # Esto evita que el recordatorio de las 8:30 AM se envíe y que este monitoreo se repita sin fin.
            datos_para_actualizar = datos.copy() # Hacemos una copia para no modificar el original directamente
            datos_para_actualizar["fecha"] = hoy # Importante: actualizamos la fecha a HOY
            # Si el BCV no ha publicado, asumimos que la tasa vigente es la última conocida
            # y la marcamos como "notificada" para hoy en el estado local.
            datos_para_actualizar["notificado"] = True
            guardar_datos(datos_para_actualizar)
            logger.info(f"✅ No hay nueva intervención para hoy {hoy}. Estado actualizado para el día actual (no se enviará recordatorio).")
            # Podrías opcionalmente aquí enviar una notificación simple que diga "No hay nueva intervención".
            # Pero la idea es que el recordatorio de las 8:30 ya no se envíe.
        else:
            logger.info("📭 Sin cambios (o ya procesado para hoy con información anterior).")

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
        tasa = usd.get("valor") or usd.get("tasa") or "?"
        fecha_valor = usd.get("fecha_valor", "?")
        usd_texto = f"{tasa} (📅 {fecha_valor})"
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
    logger.info("✅ Intervención detectada y notificada.")

async def manejar_fin_franja():
    datos = cargar_datos()

    # Al final de la franja, si ya se notificó una intervención hoy (por el monitoreo)
    # o si la fecha de los datos guardados ya es hoy (indicando que se procesó la ausencia de intervencion)
    # entonces marcamos que la tasa del día ya está "resuelta" para fines de recordatorio.
    if datos.get("notificado", False) and datos.get("fecha", "") == hora_local().strftime("%d-%m-%Y"):
        logger.info("🛑 Ya se notificó una intervención hoy. Descansando hasta mañana.")
        datos["tasa_notificada"] = True # Marcamos que la "tasa del día" ya fue manejada
    else:
        # Si no hubo intervención NUEVA Y no se ha notificado nada para hoy,
        # significa que la franja terminó y no hubo.
        # Aquí podríamos decidir si enviar un aviso de "no hay intervención"
        # y luego marcar tasa_notificada = True.
        logger.info("📌 No hubo intervención hoy. Fin del monitoreo diario.")
        # Opcional: Aquí podrías enviar un mensaje diciendo "No hubo nueva intervención hoy"
        # y luego marcar tasa_notificada = True para evitar el recordatorio de las 8:30.
        # Por ahora, simplemente la marcamos como True si no hubo para que el recordatorio de las 8:30 no se envíe.
        datos["tasa_notificada"] = True # Marcamos que la situación de la tasa ya está "resuelta" para hoy.

    # Este reseteo debe ser al inicio de un *nuevo* día, no al final de la franja del día actual.
    # Lo movería a la medianoche.
    # datos["tasa_notificada"] = False # <-- ¡Cuidado con esto! Esto lo resetea para el *próximo* ciclo.
                                      #    Debería resetearse a medianoche del día siguiente.
    guardar_datos(datos)
    logger.info(f"💾 Estado guardado en manejar_fin_franja: tasa_notificada={datos['tasa_notificada']}")

# --- FUNCIONES ENVOLTORIO ---
# (Mantienen su estructura, pero es importante que las funciones internas sean `async`)

def _enviar_recordatorio(app):
    async def inner():
        hoy_para_comparacion = hora_local().strftime("%d-%m-%Y")
        datos = cargar_datos() # Cargar los datos más recientes
        
        fecha_valor = datos.get("usd", {}).get("fecha_valor", "")
        # Verificar si la "tasa del día" ya fue notificada (por la franja de monitoreo o la de medianoche)
        # o si ya se procesó la intervención de hoy.
        # Usamos 'tasa_notificada' para esto, que ahora será gestionada por 'manejar_fin_franja'.
        if datos.get("tasa_notificada", False) and fecha_valor == hoy_para_comparacion:
            logger.info(f"🚫 No se envía recordatorio a las 08:30 AM. La tasa del día {hoy_para_comparacion} ya fue notificada o procesada.")
            return

        # Aquí la lógica original para enviar el recordatorio si no se cumplió la condición de arriba
        ahora_mensaje = datetime.now(ZONA_VE).strftime("%d/%m/%Y %H:%M")
        mensaje = (
            f"📢 Recordatorio automático:\n"
            f"🕘 {ahora_mensaje}\n"
            f"No se ha detectado una nueva intervención."
        )
        try:
            await notificar_a_todos(app.bot, mensaje)
            logger.info("📢 Recordatorio diario enviado con éxito")
            # Después de enviar el recordatorio, marcamos que la tasa del día ya está notificada
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