import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from firebase_manager import guardar_tasa_usd_firebase, obtener_tasa_usd_firebase
from log_manager import logger
import urllib3

# Desactivar la advertencia de SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def obtener_ultima_intervencion():
    """
    Obtiene la última intervención cambiaria desde la página del BCV y la tasa de USD.
    """
    url = "https://www.bcv.org.ve/politica-cambiaria/intervencion-cambiaria"
    try:
        # Desactivamos la verificación SSL con verify=False
        response = requests.get(url, verify=False)
        soup = BeautifulSoup(response.text, "html.parser")
        fila = soup.select_one("table tbody tr")

        if fila:
            columnas = fila.find_all("td")
            if len(columnas) >= 3:
                fecha_intervencion = columnas[0].get_text(strip=True)
                hoy = datetime.now().strftime("%d-%m-%Y")

                # Obtener tasa USD desde Firebase
                tasa_usd = obtener_tasa_usd_firebase(fecha_intervencion)

                if not tasa_usd and fecha_intervencion == hoy:
                    tasa_usd = obtener_tasa_usd_bcv_checker()  # Si no hay tasa, hacemos scraping y actualizamos

                # Convertir el monto a float, limpiando cualquier carácter no numérico como comas
                monto = columnas[2].get_text(strip=True).replace(",", ".")  # Eliminar comas si existen
                monto_float = float(monto)  # Convertir a float

                return {
                    "fecha": fecha_intervencion,
                    "intervencion": columnas[1].get_text(strip=True),
                    "monto": monto_float,  # Guardar monto como float
                    "usd": tasa_usd
                }
    except Exception as e:
        logger.error(f"❌ Error al obtener la intervención: {e}")
    return None


def obtener_tasa_usd_bcv_checker():
    """
    Obtiene la tasa USD del BCV y la guarda en Firebase si no está disponible.
    Para sábado y domingo, usa la tasa correspondiente al viernes anterior.
    """
    url = "https://www.bcv.org.ve/"
    try:
        hoy_dt = datetime.now()
        dia_semana = hoy_dt.weekday()  # 0 = lunes, 6 = domingo

        # Si es sábado (5) o domingo (6), restamos días hasta obtener viernes (4)
        if dia_semana == 5:  # sábado
            fecha_ref = hoy_dt - timedelta(days=1)
        elif dia_semana == 6:  # domingo
            fecha_ref = hoy_dt - timedelta(days=2)
        else:
            fecha_ref = hoy_dt

        fecha_formateada = fecha_ref.strftime("%d-%m-%Y")

        # Verificar si la tasa ya está guardada en Firebase
        tasa_guardada = obtener_tasa_usd_firebase(fecha_formateada)
        if tasa_guardada:
            logger.info(f"📌 Tasa recuperada desde Firebase ({fecha_formateada}): {tasa_guardada}")
            return str(tasa_guardada)

        # Si no está guardada, intentamos obtenerla desde la web
        response = requests.get(url, verify=False)
        soup = BeautifulSoup(response.text, "html.parser")
        tasa_div = soup.select_one("#dolar strong")

        if tasa_div:
            tasa_usd = tasa_div.text.strip().replace("Bs.", "").replace(",", ".")
            tasa_usd = round(float(tasa_usd), 2)

            guardar_tasa_usd_firebase(fecha_formateada, tasa_usd)
            logger.info(f"✅ Tasa obtenida y guardada ({fecha_formateada}): {tasa_usd}")
            return str(tasa_usd)
        else:
            logger.warning("❌ No se pudo encontrar la tasa en la página del BCV.")
            return "No disponible"

    except Exception as e:
        logger.error(f"❌ Error al obtener la tasa USD: {e}")
        return "No disponible"
