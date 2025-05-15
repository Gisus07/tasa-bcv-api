import logging
import os
from logging.handlers import RotatingFileHandler

# Asegura carpeta de logs
os.makedirs("logs", exist_ok=True)

# Configura logger
logger = logging.getLogger("BCVBot")
logger.setLevel(logging.INFO)

# Rotating log (máx 1MB, mantiene hasta 3 archivos)
handler = RotatingFileHandler("logs/bot.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
formatter = logging.Formatter('%(asctime)s | %(levelname)s | %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
