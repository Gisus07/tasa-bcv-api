
# 🔔 Alerta BCV Bot

Bot de Telegram que notifica automáticamente cuando el Banco Central de Venezuela (BCV) publica una intervención cambiaria y permite consultar la tasa oficial del USD correspondiente al día.

---

## 📉 Características

- 🔹 **Alerta automática** cuando el BCV publica una nueva intervención cambiaria
- 🔹 Consulta manual de la **tasa oficial USD del día** con `/tasa`
- 🔹 Lógica oficial del BCV incorporada (la tasa anunciada aplica al día siguiente o lunes si es viernes)
- 🔹 Persistencia de datos en **Firestore** (usuarios, intervenciones, tasas)
- 🔹 Corre 24/7 usando **Docker** + `docker-compose`

---

## ⚖️ Comandos disponibles

| Comando   | Descripción                                                    |
|-----------|------------------------------------------------------------------|
| `/start`  | Suscribirse a las alertas automáticas                           |
| `/stop`   | Cancelar la suscripción a las alertas                          |
| `/tasa`   | Ver la tasa oficial del USD publicada por el BCV               |
| `/ultimo` | Ver la última intervención cambiaria detectada               |

---

## 👾 Licencia
Este bot es un proyecto personal y no oficial. No está afiliado al Banco Central de Venezuela.

---

## 🔗 Enlace al bot
[📢 Probar bot en Telegram](https://t.me/IntervencionBCVbot)
