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

BINANCE_CRYPTOS = {
    "USDT": {"wallet": os.getenv("BINANCE_USDT"), "red": os.getenv("BINANCE_USDT_RED")},
    "XRP": {
        "wallet": os.getenv("BINANCE_XRP"),
        "tag": os.getenv("BINANCE_XRP_TAG"),
        "red": os.getenv("BINANCE_XRP_RED")
    },
    "USDC": {"wallet": os.getenv("BINANCE_USDC"), "red": os.getenv("BINANCE_USDC_RED")},
    "BTC": {"wallet": os.getenv("BINANCE_BTC"), "red": os.getenv("BINANCE_BTC_RED")},
    "ETH": {"wallet": os.getenv("BINANCE_ETH"), "red": os.getenv("BINANCE_ETH_RED")},
    "BNB": {"wallet": os.getenv("BINANCE_BNB"), "red": os.getenv("BINANCE_BNB_RED")}
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
    data = query.data

    async def mostrar_menu_principal():
        keyboard = [
            [InlineKeyboardButton("💸 Pago Móvil", callback_data="pago_movil")],
            [InlineKeyboardButton("🪙 Binance", callback_data="binance")],
            [InlineKeyboardButton("🧾 PayPal", callback_data="paypal")],
            [InlineKeyboardButton("💼 Wally", callback_data="wally")]
        ]
        await query.edit_message_text("🙏 ¿Cómo deseas donar?\nElige un método de pago:", reply_markup=InlineKeyboardMarkup(keyboard))

    async def mostrar_montos_pago_movil():
        keyboard = [
            [InlineKeyboardButton("1$", callback_data="usd_1"),
             InlineKeyboardButton("5$", callback_data="usd_5"),
             InlineKeyboardButton("10$", callback_data="usd_10")],
            [InlineKeyboardButton("💬 Otro monto", callback_data="monto_personalizado")]
        ]
        await query.edit_message_text("💸 ¿Cuánto deseas donar en USD?", reply_markup=InlineKeyboardMarkup(keyboard))

    async def mostrar_menu_binance():
        keyboard = [
            [InlineKeyboardButton("USDT", callback_data="binance_usdt")],
            [InlineKeyboardButton("XRP", callback_data="binance_xrp")],
            [InlineKeyboardButton("USDC", callback_data="binance_usdc")],
            [InlineKeyboardButton("BTC", callback_data="binance_btc")],
            [InlineKeyboardButton("ETH", callback_data="binance_eth")],
            [InlineKeyboardButton("BNB", callback_data="binance_bnb")],
            [InlineKeyboardButton("⬅️ Volver", callback_data="volver_menu")]
        ]
        await query.edit_message_text("🪙 ¿Con qué cripto deseas donar en Binance?", reply_markup=InlineKeyboardMarkup(keyboard))

    async def mostrar_info_binance(moneda):
        info = BINANCE_CRYPTOS.get(moneda)
        if not info:
            await query.edit_message_text("❌ Cripto no disponible.")
            return
        mensaje = f"🪙 *Binance - {moneda}*\nWallet: `{info['wallet']}`\n"
        if "red" in info:
            mensaje += f"Red: `{info['red']}`\n"
        if "tag" in info:
            mensaje += f"Tag/Memo: `{info['tag']}`"
        keyboard = [[InlineKeyboardButton("⬅️ Otra cripto", callback_data="binance")]]
        await query.edit_message_text(
            mensaje.strip(),
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    async def mostrar_info_pago_movil(usd):
        fecha = datetime.now().strftime("%d-%m-%Y")
        tasa = obtener_tasa_usd_firebase(fecha)
        if not tasa:
            await query.edit_message_text("❌ No se pudo obtener la tasa del día.")
            return
        bs = usd * tasa
        mensaje = (
            f"💳 *Pago Móvil*\n\n"
            f"Banco: {PAGO_MOVIL['banco']}\n"
            f"Teléfono: {PAGO_MOVIL['telefono']}\n"
            f"C.I.: {PAGO_MOVIL['ci']}\n"
            f"Monto: Bs. {bs:,.2f}"
        )
        await query.edit_message_text(mensaje, parse_mode="Markdown")

    match data:
        case "pago_movil":
            await mostrar_montos_pago_movil()

        case "binance":
            await mostrar_menu_binance()

        case _ if data.startswith("binance_"):
            moneda = data.split("_")[1].upper()
            await mostrar_info_binance(moneda)

        case "paypal":
            await query.edit_message_text(f"🧾 *PayPal*\nCorreo: `{PAYPAL_CORREO}`", parse_mode="Markdown")

        case "wally":
            await query.edit_message_text(f"💼 *Wally*\nTeléfono: `{WALLY_USUARIO}`", parse_mode="Markdown")

        case _ if data.startswith("usd_"):
            usd = int(data.split("_")[1])
            await mostrar_info_pago_movil(usd)

        case "monto_personalizado":
            await query.edit_message_text("💬 Escribe el monto que deseas donar en USD (solo el número):")
            context.user_data["esperando_monto"] = True

        case "volver_menu":
            await mostrar_menu_principal()

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
