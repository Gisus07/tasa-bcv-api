import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import json
import os

def cargar_tasas_usd_local():
    try:
        with open("tasas_usd.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def obtener_ultima_intervencion():
    url = "https://www.bcv.org.ve/politica-cambiaria/intervencion-cambiaria"
    response = requests.get(url, verify=False)
    soup = BeautifulSoup(response.text, "html.parser")
    fila = soup.select_one("table tbody tr")

    if fila:
        columnas = fila.find_all("td")
        if len(columnas) >= 3:
            fecha_intervencion = columnas[0].get_text(strip=True)
            hoy = datetime.now().strftime("%d-%m-%Y")

            tasas_usd = cargar_tasas_usd_local()
            usd_rate = tasas_usd.get(fecha_intervencion)

            if not usd_rate and fecha_intervencion == hoy:
                usd_rate = obtener_tasa_usd()
            elif not usd_rate:
                usd_rate = "N/D"

            return {
                "fecha": fecha_intervencion,
                "intervencion": columnas[1].get_text(strip=True),
                "monto": columnas[2].get_text(strip=True),
                "usd": usd_rate
            }
    return None

def obtener_tasa_usd():
    if not os.path.exists(TASA_FILE):
        return "No disponible", None, None

    try:
        with open(TASA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        hoy = datetime.now()
        hoy_str = hoy.strftime("%d-%m-%Y")
        dow = hoy.weekday()

        # Regla BCV
        if dow == 0:  # Lunes
            tasa_fecha = (hoy + timedelta(days=1)).strftime("%d-%m-%Y")
        elif dow == 1:  # Martes
            tasa_fecha = (hoy + timedelta(days=1)).strftime("%d-%m-%Y")
        elif dow == 2:  # Miércoles
            tasa_fecha = (hoy + timedelta(days=1)).strftime("%d-%m-%Y")
        elif dow == 3:  # Jueves
            tasa_fecha = (hoy + timedelta(days=1)).strftime("%d-%m-%Y")
        elif dow == 4:  # Viernes
            tasa_fecha = (hoy + timedelta(days=3)).strftime("%d-%m-%Y")
        elif dow == 5:  # Sábado
            tasa_fecha = (hoy + timedelta(days=2)).strftime("%d-%m-%Y")
        elif dow == 6:  # Domingo
            tasa_fecha = (hoy + timedelta(days=1)).strftime("%d-%m-%Y")
            
        logger.info(f"🔍 Buscando tasa para fecha clave: {tasa_fecha}, hoy: {hoy_str}")

        valor = data.get(tasa_fecha)

        if valor:
            return valor, hoy_str, tasa_fecha
        else:
            return "No disponible", hoy_str, tasa_fecha

    except Exception as e:
        logger.error(f"❌ Error al leer tasas_usd.json: {e}")
        return "Error", None, None
