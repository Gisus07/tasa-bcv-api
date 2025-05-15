# Imagen base oficial de Python
FROM python:3.11-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos del proyecto
COPY . .

# Instala las dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Define variable de entorno (si lo deseas)
ENV TZ=America/Caracas

# Expone el puerto (no requerido para bot, solo referencia)
EXPOSE 80

# Comando para ejecutar el bot
CMD ["python", "bot.py"]
