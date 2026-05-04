import { model } from "@medusajs/framework/utils"

/**
 * One row per *captured* web order. Created by the order.completed subscriber.
 *
 * All monetary fields stored in three currencies:
 *   *_eur  — display unit used by the storefront (matches order.total)
 *   *_bs   — eur × bcv_eur_rate   (Pago Móvil amount the customer transferred)
 *   *_usdt — eur ÷ eur_per_usdt   (theoretical USDT before actual conversion)
 *
 * After a real conversion happens, see finanzas_conversion for the *actual*
 * USDT received (which may differ from the theoretical because BCV ≠ paralelo).
 */
const FinanzasPagoMovil = model.define("finanzas_pago_movil", {
  id: model.id().primaryKey(),

  // Order reference
  order_id: model.text().unique(),
  order_display_id: model.number(),
  order_email: model.text().nullable(),
  customer_name: model.text().nullable(),
  cedula: model.text().nullable(),
  customer_phone: model.text().nullable(),

  // Rates captured at order-completion time
  bcv_eur_rate: model.number(),         // Bs per 1 EUR (BCV)
  usdt_eur_rate: model.number(),        // USDT per 1 EUR (paralelo, theoretical)

  // Top-line in EUR
  amount_eur_subtotal: model.number(),  // sum of unit_price × qty (pre-discount)
  amount_eur_discount: model.number().default(0), // combo + cupón
  amount_eur_total: model.number(),     // = order.total (what customer paid)

  // Bs received (this is what Pago Móvil deposited)
  amount_bs_total: model.number(),      // = amount_eur_total × bcv_eur_rate

  // Theoretical USDT-equivalent (for projection)
  amount_usdt_theoretical: model.number(),

  // Cost of goods sold (sum of all line costs)
  amount_eur_cogs: model.number().default(0),
  amount_bs_cogs: model.number().default(0),
  amount_usdt_cogs: model.number().default(0),

  // Gross margin = total - cogs
  amount_eur_margin: model.number().default(0),
  amount_bs_margin: model.number().default(0),
  amount_usdt_margin: model.number().default(0),

  // Splits (in EUR — bs/usdt derived for the report; we still store all 3 for
  // fast queries and reproducibility against the rate frozen at this moment)
  split_restock_eur: model.number().default(0),       // = cogs (literal)
  split_restock_bs: model.number().default(0),
  split_restock_usdt: model.number().default(0),

  split_gastos_fijos_eur: model.number().default(0),
  split_gastos_fijos_bs: model.number().default(0),
  split_gastos_fijos_usdt: model.number().default(0),

  split_marketing_eur: model.number().default(0),
  split_marketing_bs: model.number().default(0),
  split_marketing_usdt: model.number().default(0),

  split_ganancia_eur: model.number().default(0),
  split_ganancia_bs: model.number().default(0),
  split_ganancia_usdt: model.number().default(0),

  // Status flags
  // pendiente_verificacion | verificado | parcialmente_convertido | convertido
  status: model.text().default("verificado"),
  // Some lines may be missing product_cost — flag for "fix me" alert
  cogs_complete: model.boolean().default(true),
  // Margen negativo (cupón excesivo, error de costo)
  margin_negative: model.boolean().default(false),

  // Bs running totals (kept for fast queries — service updates on each conversion)
  bs_converted_total: model.number().default(0),
  bs_pending: model.number().default(0), // = amount_bs_total - bs_converted_total

  payment_proof_url: model.text().nullable(),
  notes: model.text().nullable(),
})

export default FinanzasPagoMovil
