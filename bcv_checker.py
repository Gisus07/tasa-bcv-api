import requests
from bs4 import BeautifulSoup
from datetime import datetime
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
    """
    url = "https://www.bcv.org.ve/"
    try:
        # Desactivamos la verificación SSL con verify=False
        response = requests.get(url, verify=False)
        soup = BeautifulSoup(response.text, "html.parser")
        tasa_div = soup.select_one("#dolar strong")

        if tasa_div:
            tasa_usd = tasa_div.text.strip().replace("Bs.", "").replace(",", ".")
            hoy = datetime.now().strftime("%d-%m-%Y")

            # Redondear la tasa a 2 decimales
            tasa_usd = round(float(tasa_usd), 2)  # Convierte a float y redondea a 2 decimales

            # Verificar si la tasa ya está guardada en Firebase
            tasa_guardada = obtener_tasa_usd_firebase(hoy)

            if not tasa_guardada:  # Si no está guardada, la guardamos
                guardar_tasa_usd_firebase(hoy, tasa_usd)
                logger.info(f"✅ Tasa obtenida y guardada: {tasa_usd}")
            else:
                logger.info(f"✅ Tasa ya está guardada: {tasa_guardada}")

            return str(tasa_usd)  # Devolver la tasa como string con 2 decimales
        else:
            logger.warning("❌ No se pudo obtener la tasa del BCV.")
            return "No disponible"
    except Exception as e:
        logger.error(f"❌ Error al obtener la tasa USD: {e}")
        return "No disponible"
