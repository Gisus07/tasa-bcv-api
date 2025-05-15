import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
import requests
from bs4 import BeautifulSoup

def obtener_ultima_intervencion():
    url = "https://www.bcv.org.ve/politica-cambiaria/intervencion-cambiaria"
    response = requests.get(url, verify=False)
    soup = BeautifulSoup(response.text, "html.parser")
    fila = soup.select_one("table tbody tr")

    if fila:
        columnas = fila.find_all("td")
        if len(columnas) >= 3:
            return {
                "fecha": columnas[0].get_text(strip=True),
                "intervencion": columnas[1].get_text(strip=True),
                "monto": columnas[2].get_text(strip=True)
            }
    return None
