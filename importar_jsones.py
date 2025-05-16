import json
from firebase_manager import guardar_usuarios, guardar_intervencion, guardar_tasa_usd

# 🔹 Importar usuarios
try:
    with open("usuarios.json", "r", encoding="utf-8") as f:
        ids = json.load(f)
    guardar_usuarios(ids)
    print(f"✅ Usuarios importados: {len(ids)}")
except Exception as e:
    print(f"⚠️ Error al importar usuarios: {e}")

# 🔹 Importar última intervención
try:
    with open("datos.json", "r", encoding="utf-8") as f:
        intervencion = json.load(f)
    guardar_intervencion(intervencion)
    print(f"✅ Intervención importada: {intervencion}")
except Exception as e:
    print(f"⚠️ Error al importar intervención: {e}")

# 🔹 Importar tasas USD
try:
    with open("tasas_usd.json", "r", encoding="utf-8") as f:
        tasas = json.load(f)
    for fecha, valor in tasas.items():
        print(f"📤 Insertando: {fecha} → {valor}")
        guardar_tasa_usd(fecha, valor)
    print(f"✅ Tasas importadas: {len(tasas)} registros.")
except Exception as e:
    print(f"❌ Error al importar tasas: {e}")
