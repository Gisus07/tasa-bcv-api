import os
from firebase_admin import credentials, firestore, initialize_app
from dotenv import load_dotenv

load_dotenv()
clave = os.getenv("FIREBASE_KEY", "firebase_key.json")

cred = credentials.Certificate(clave)
initialize_app(cred)
db = firestore.client()
