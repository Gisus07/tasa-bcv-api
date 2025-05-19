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
    """
    Obtiene la tasa USD del BCV verificando la 'fecha valor' real desde el sitio.
    Guarda la tasa en Firebase si no ha sido registrada.
    """
    url = "https://www.bcv.org.ve/"
    try:
        response = requests.get(url, verify=False)
        soup = BeautifulSoup(response.text, "html.parser")

        # 1. Extraer la tasa USD
        tasa_div = soup.select_one("#dolar strong")
        if not tasa_div:
            logger.warning("❌ No se encontró el valor de la tasa.")
            return "No disponible"

        tasa_usd = tasa_div.text.strip().replace("Bs.", "").replace(",", ".")
        tasa_usd = round(float(tasa_usd), 2)

        # 2. Extraer la fecha valor
        span_fecha = soup.select_one(".date-display-single")
        if not span_fecha:
            logger.warning("❌ No se encontró la fecha valor.")
            return "No disponible"

        texto_fecha = span_fecha.text.strip()  # Ej: "Lunes, 19 Mayo 2025"
        match = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", texto_fecha)

        if not match:
            logger.warning(f"⚠️ No se pudo parsear la fecha valor desde: {texto_fecha}")
            return "No disponible"

        dia, mes_texto, anio = match.groups()
        meses = {
            "Enero": "01", "Febrero": "02", "Marzo": "03",
            "Abril": "04", "Mayo": "05", "Junio": "06",
            "Julio": "07", "Agosto": "08", "Septiembre": "09",
            "Octubre": "10", "Noviembre": "11", "Diciembre": "12"
        }

        mes = meses.get(mes_texto.capitalize())
        if not mes:
            logger.warning(f"❌ Mes no reconocido: {mes_texto}")
            return "No disponible"

        fecha_valor = f"{dia.zfill(2)}-{mes}-{anio}"

        # 3. Validar que la fecha valor sea igual a la fecha actual del sistema
        fecha_actual = datetime.now().strftime("%d-%m-%Y")
        if fecha_valor != fecha_actual:
            logger.warning(f"⛔ Fecha valor '{fecha_valor}' no coincide con la fecha actual '{fecha_actual}'. No se guarda la tasa.")
            return "No disponible"


        # 4. Guardar si es nueva
        guardar_tasa_usd_firebase(fecha_valor, tasa_usd)
        logger.info(f"✅ Tasa guardada para {fecha_valor}: {tasa_usd}")
        return str(tasa_usd)

    except Exception as e:
        logger.error(f"❌ Error al obtener la tasa USD: {e}")
        return "No disponible"
