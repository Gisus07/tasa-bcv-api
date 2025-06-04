from firebase_config import db
import pytz
from datetime import datetime, timedelta
from google.cloud import firestore

ZONA_VE = pytz.timezone("America/Caracas")

# 🔹 USUARIOS
def guardar_usuarios_firebase(lista_ids):
    doc_ref = db.collection("datos").document("usuarios")
    doc_ref.set({"ids": lista_ids})

def obtener_usuarios_firebase():
    doc_ref = db.collection("datos").document("usuarios")
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict().get("ids", [])
    return []

def eliminar_usuario_firebase(uid):
    doc_ref = db.collection("datos").document("usuarios")
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        lista = data.get("ids", [])
        if uid in lista:
            lista.remove(uid)
            doc_ref.set({"ids": lista})

# 🔹 INTERVENCIÓN
def guardar_intervencion_firebase(data):
    doc_ref = db.collection("datos").document("intervencion")
    doc_ref.set(data)

def obtener_intervencion_firebase():
    doc_ref = db.collection("datos").document("intervencion")
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return {}

# 🔹 TASA USD
def guardar_tasa_usd_firebase(fecha, valor):
    doc_ref = db.collection("tasas_usd").document(fecha)
    doc_ref.set({"valor": valor})

def obtener_tasa_usd_firebase(fecha):
    doc_ref = db.collection("tasas_usd").document(fecha)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict().get("valor")
    return None

# 🔹 ELIMINAR tasas_usd de la semana anterior
def eliminar_tasas_anteriores():
    hoy = datetime.now(ZONA_VE)
    lunes_actual = hoy - timedelta(days=hoy.weekday())  # lunes de esta semana (aware)
    eliminadas = 0

    tasas_ref = db.collection("tasas_usd")
    documentos = tasas_ref.stream()

    for doc in documentos:
        try:
            fecha_naive = datetime.strptime(doc.id, "%d-%m-%Y")
            fecha = ZONA_VE.localize(fecha_naive)  # convertir a aware
            if fecha.date() < lunes_actual.date():
                doc.reference.delete()
                eliminadas += 1
        except Exception as e:
            print(f"⚠️ Error al procesar fecha {doc.id}: {e}")
            continue

    return eliminadas
