FROM python:3.11-slim

WORKDIR /app

# Copiar archivos del bot
COPY . .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Ejecutar el bot
CMD ["python", "bot.py"]
