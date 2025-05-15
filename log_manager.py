import logging
import os
import sys
from logging.handlers import RotatingFileHandler

# Crear carpeta de logs si no existe
os.makedirs("logs", exist_ok=True)

# Solo eliminar emojis (caracteres fuera de BMP de Unicode)
def eliminar_emojis(texto):
    return ''.join(c for c in texto if c <= '\uFFFF')

class SafeConsoleHandler(logging.StreamHandler):
    def emit(self, record):
        try:
            record.msg = eliminar_emojis(str(record.msg))
        except Exception:
            pass
        super().emit(record)

logger = logging.getLogger("BCVBot")
logger.setLevel(logging.INFO)

# Log a archivo (con todo completo, incluidos emojis)
file_handler = RotatingFileHandler("logs/bot.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
file_formatter = logging.Formatter('%(asctime)s | %(levelname)s | %(message)s')
file_handler.setFormatter(file_formatter)

# Log a consola (sin emojis, pero con acentos)
stream_handler = SafeConsoleHandler(sys.stdout)
stream_formatter = logging.Formatter('%(message)s')
stream_handler.setFormatter(stream_formatter)

logger.addHandler(file_handler)
logger.addHandler(stream_handler)
