import re
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
    url = "https://www.bcv.org.ve/"
    try:
        response = requests.get(url, verify=False)
        soup = BeautifulSoup(response.text, "html.parser")

        # Extraer tasa USD
        usd_strong = soup.select_one("#dolar strong")
        if not usd_strong:
            logger.warning("❌ No se encontró el valor de la tasa USD.")
            return None

        tasa_str = usd_strong.text.strip().replace(",", ".")
        tasa_float = round(float(tasa_str), 2)

        # Extraer fecha valor desde atributo content
        fecha_span = soup.select_one(".date-display-single")
        if not fecha_span or "content" not in fecha_span.attrs:
            logger.warning("❌ No se encontró la fecha valor.")
            return None

        fecha_iso = fecha_span["content"].split("T")[0]
        fecha_valor = datetime.strptime(fecha_iso, "%Y-%m-%d").strftime("%d-%m-%Y")

        return {
            "fecha_valor": fecha_valor,
            "tasa": tasa_float
        }

    except Exception as e:
        logger.error(f"❌ Error al obtener la tasa USD: {e}")
        return None
