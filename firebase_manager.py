from firebase_config import db

# 🔹 USUARIOS
def guardar_usuarios(lista_ids):
    doc_ref = db.collection("datos").document("usuarios")
    doc_ref.set({"ids": lista_ids})

def obtener_usuarios():
    doc_ref = db.collection("datos").document("usuarios")
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict().get("ids", [])
    return []

# 🔹 INTERVENCIÓN
def guardar_intervencion(data):
    doc_ref = db.collection("datos").document("intervencion")
    doc_ref.set(data)

def obtener_intervencion():
    doc_ref = db.collection("datos").document("intervencion")
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return {}

# 🔹 TASA USD
def guardar_tasa_usd(fecha, valor):
    doc_ref = db.collection("tasas_usd").document(fecha)
    doc_ref.set({"valor": valor})

def obtener_tasa_usd(fecha):
    doc_ref = db.collection("tasas_usd").document(fecha)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict().get("valor")
    return None
