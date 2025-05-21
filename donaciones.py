from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from firebase_manager import obtener_tasa_usd_firebase
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

PAGO_MOVIL = {
    "banco": os.getenv("PAGOMOVIL_BANCO"),
    "telefono": os.getenv("PAGOMOVIL_TELEFONO"),
    "ci": os.getenv("PAGOMOVIL_CI")
}

BINANCE = {
    "wallet": os.getenv("BINANCE_WALLET"),
    "red": os.getenv("BINANCE_RED")
}

PAYPAL_CORREO = os.getenv("PAYPAL_CORREO")
WALLY_USUARIO = os.getenv("WALLY_USUARIO")

async def donar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("💸 Pago Móvil", callback_data="pago_movil")],
        [InlineKeyboardButton("🪙 Binance", callback_data="binance")],
        [InlineKeyboardButton("🧾 PayPal", callback_data="paypal")],
        [InlineKeyboardButton("💼 Wally", callback_data="wally")]
    ]
    await update.message.reply_text(
        "🙏 ¿Cómo deseas donar?\nElige un método de pago:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def manejar_opciones(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "pago_movil":
        keyboard = [
            [InlineKeyboardButton("1$", callback_data="usd_1"),
             InlineKeyboardButton("5$", callback_data="usd_5"),
             InlineKeyboardButton("10$", callback_data="usd_10")],
            [InlineKeyboardButton("💬 Otro monto", callback_data="monto_personalizado")]
        ]
        await query.edit_message_text("💸 ¿Cuánto deseas donar en USD?",
                                      reply_markup=InlineKeyboardMarkup(keyboard))

    elif query.data == "binance":
        await query.edit_message_text(
            f"🪙 *Binance*\n"
            f"Moneda: *USDT*\n"
            f"Red: `{BINANCE['red']}`\n"
            f"Wallet: `{BINANCE['wallet']}`",
            parse_mode="Markdown"
        )

    elif query.data == "paypal":
        await query.edit_message_text(
            f"🧾 *PayPal*\nCorreo: `{PAYPAL_CORREO}`",
            parse_mode="Markdown"
        )

    elif query.data == "wally":
        await query.edit_message_text(
            f"💼 *Wally*\nTeléfono: `{WALLY_USUARIO}`",
            parse_mode="Markdown"
        )

    elif query.data.startswith("usd_"):
        usd = int(query.data.split("_")[1])
        fecha = datetime.now().strftime("%d-%m-%Y")
        tasa = obtener_tasa_usd_firebase(fecha)
        if not tasa:
            await query.edit_message_text("❌ No se pudo obtener la tasa del día.")
            return
        bs = usd * tasa
        await query.edit_message_text(
            f"💳 *Pago Móvil*\n\n"
            f"Banco: {PAGO_MOVIL['banco']}\n"
            f"Teléfono: {PAGO_MOVIL['telefono']}\n"
            f"C.I.: {PAGO_MOVIL['ci']}\n"
            f"Monto: Bs. {bs:,.2f}",
            parse_mode="Markdown"
        )

    elif query.data == "monto_personalizado":
        await query.edit_message_text("💬 Escribe el monto que deseas donar en USD (solo el número):")
        context.user_data["esperando_monto"] = True

async def recibir_monto(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.user_data.get("esperando_monto"):
        try:
            usd = float(update.message.text.replace(",", "."))
            fecha = datetime.now().strftime("%d-%m-%Y")
            tasa = obtener_tasa_usd_firebase(fecha)
            if not tasa:
                await update.message.reply_text("❌ No se pudo obtener la tasa del día.")
                return
            bs = usd * tasa
            await update.message.reply_text(
                f"💳 *Pago Móvil*\n\n"
                f"Banco: {PAGO_MOVIL['banco']}\n"
                f"Teléfono: {PAGO_MOVIL['telefono']}\n"
                f"C.I.: {PAGO_MOVIL['ci']}\n"
                f"Monto: Bs. {bs:,.2f}",
                parse_mode="Markdown"
            )
        except ValueError:
            await update.message.reply_text("❌ Escribe un número válido.")
        context.user_data["esperando_monto"] = False
