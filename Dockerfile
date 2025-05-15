FROM python:3.11-slim

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r requirements.txt
RUN chmod +x entrypoint.sh

ENV TZ=America/Caracas
EXPOSE 80

ENTRYPOINT ["./entrypoint.sh"]
