/**
 * Subscriber: Notify the team about new web-checkout orders.
 *
 * Event: order.placed
 *
 * - Telegram: HTML-formatted with inline "Aprobar / Revisar Pago" buttons.
 *   Includes subtotal, descuento (si aplica), envío, total EUR + Bs (vía BCV
 *   live), cédula, dirección, comprobante de pago.
 *   Goes ONLY to `telegram_chat_id` (the group). Never to a private chat.
 *
 * - WhatsApp owner notification: REMOVED (was duplicating the Telegram alert
 *   to the owner's personal phone). The Telegram message in the group has all
 *   the info needed.
 */

import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Pool } from "pg"
import { getConfig } from "../lib/whatsapp-db"
import { getFxRates, convertEur } from "../lib/fx-rates"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function pickCedula(order: Record<string, any>, cust: Record<string, any> | undefined): string {
  const orderMeta = (order.metadata || {}) as Record<string, unknown>
  const custMeta = (cust?.metadata || {}) as Record<string, unknown>
  const v =
    (typeof orderMeta.cedula === "string" && orderMeta.cedula) ||
    (typeof custMeta.cedula === "string" && custMeta.cedula) ||
    ""
  return v ? String(v).toUpperCase() : ""
}

interface DispatchArgs {
  order: Record<string, any>
  cust: Record<string, any> | undefined
  items: Array<{
    title: string
    quantity: number
    unit_price: number
    variant_title?: string | null
    variant_sku?: string | null
  }>
}

/** Builds a "Producto — Variante" label, hiding "Default variant" which is noise */
function formatItemLabel(item: {
  title: string
  variant_title?: string | null
  variant_sku?: string | null
}): string {
  const v = item.variant_title?.trim()
  const sku = item.variant_sku?.trim()
  // Skip when the variant title is missing, generic, or repeats the product title
  const meaningfulVariant =
    v &&
    v !== "Default variant" &&
    v !== "Default" &&
    v.toLowerCase() !== item.title.toLowerCase() &&
    !item.title.toLowerCase().includes(v.toLowerCase())
  let label = item.title
  if (meaningfulVariant) label += ` — ${v}`
  if (sku) label += ` <code>[${sku}]</code>`
  return label
}

async function sendTelegramOrderAlert(args: DispatchArgs): Promise<boolean> {
  const { order, cust, items } = args
  const token = await getConfig("telegram_bot_token")
  const chatId = await getConfig("telegram_chat_id")
  if (!token || !chatId) {
    console.warn("[order-tg-notify] Telegram not configured — skipping")
    return false
  }

  const meta = (order.metadata || {}) as Record<string, any>

  // ─── Buyer vs recipient (MRW with `cedula_owner=other`) ──────────────────
  // For MRW orders shipped to a different person, the shipping address holds
  // the receiver's name + phone (because that's what MRW validates against the
  // cedula). The buyer/payer info is preserved separately in metadata.
  const isOtherRecipient = meta.cedula_owner === "other"

  const buyerFirst =
    meta.buyer_first_name ||
    cust?.first_name ||
    meta.customer_first_name ||
    order.ship_first ||
    ""
  const buyerLast =
    meta.buyer_last_name ||
    cust?.last_name ||
    meta.customer_last_name ||
    order.ship_last ||
    ""
  const buyerName = [buyerFirst, buyerLast].filter(Boolean).join(" ").trim() || "Cliente"
  const buyerPhone = meta.buyer_phone || cust?.phone || meta.customer_phone || order.phone || "N/A"
  const buyerEmail = meta.buyer_email || cust?.email || order.email || "N/A"

  const recipientFirst = meta.recipient_first_name || ""
  const recipientLast = meta.recipient_last_name || ""
  const recipientName = [recipientFirst, recipientLast].filter(Boolean).join(" ").trim()
  const recipientPhone = meta.recipient_phone || ""
  const recipientCedula = meta.recipient_cedula || ""

  // For non-MRW-other orders, the headline name == buyer name
  const name = isOtherRecipient && recipientName ? recipientName : buyerName
  const phone = isOtherRecipient && recipientPhone ? recipientPhone : buyerPhone
  const email = buyerEmail
  const cedula = pickCedula(order, cust) || "No proporcionada"
  const address =
    [order.address_1, order.city, order.province, order.postal_code]
      .filter(Boolean)
      .join(", ") || "Sin dirección"

  // ─── Items + totals ───────────────────────────────────────────────────────
  const itemLines = items
    .map((i) => {
      // formatItemLabel intentionally returns a string with HTML <code>… already
      // escaped at the SKU level; only the title/variant strings come from DB
      // and we escape those before passing them in.
      const safe = {
        title: escapeHtml(String(i.title || "Producto")),
        variant_title: i.variant_title ? escapeHtml(String(i.variant_title)) : null,
        variant_sku: i.variant_sku ? escapeHtml(String(i.variant_sku)) : null,
      }
      const label = formatItemLabel(safe)
      const lineTotal = Number(i.unit_price) * Number(i.quantity)
      return `• ${label} ×${i.quantity} — €${lineTotal.toFixed(2)}`
    })
    .join("\n")

  // Sum of line items (pre-shipping, pre-discount visualization)
  const itemsSubtotal = items.reduce(
    (s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 0),
    0
  )

  const originalTotal = Number(order.original_order_total ?? order.total ?? 0)
  const currentTotal = Number(order.current_order_total ?? order.total ?? 0)
  const shippingTotal = Number(meta.shipping_cost || order.shipping_total || 0)
  const shippingType = meta.shipping_type || ""
  const shippingLabel =
    shippingType === "mrw"
      ? "MRW (cobro a destino)"
      : shippingType === "inmediato"
      ? "Inmediato — Solo Valencia"
      : shippingType

  // Discount detection: if items subtotal + shipping > current total, there's a discount
  // (originated from the cart layer that's not persisted in order_summary).
  const expectedNoDiscount = itemsSubtotal + shippingTotal
  const inferredDiscount =
    expectedNoDiscount > currentTotal + 0.01
      ? expectedNoDiscount - currentTotal
      : 0

  // Build totals block — show the math so it's NEVER a "discrepancy mystery"
  const lines: string[] = []
  lines.push(`<b>Subtotal productos:</b> €${itemsSubtotal.toFixed(2)}`)
  if (shippingTotal > 0) {
    lines.push(
      `<b>Envío${shippingLabel ? ` (${shippingLabel})` : ""}:</b> €${shippingTotal.toFixed(2)}`
    )
  } else if (meta.free_shipping_applied && shippingType === "inmediato") {
    // Inmediato + cliente cumplió la regla €10+ → envío gratis con ahorro.
    // Strictly gated to inmediato — MRW shipping is "cobro a destino" so this
    // promo line never applies even if the flag was set somehow.
    const savings = Number(meta.free_shipping_savings_eur || 3).toFixed(2)
    const threshold = meta.free_shipping_threshold_eur || 10
    lines.push(
      `<b>Envío:</b> GRATIS <i>(ahorro €${savings} — promo ≥€${threshold})</i>`
    )
  } else if (shippingLabel) {
    lines.push(`<b>Envío:</b> ${shippingLabel}`)
  }
  if (inferredDiscount > 0.01) {
    const pct = Math.round((inferredDiscount / itemsSubtotal) * 100)
    lines.push(`<b>Descuento:</b> −€${inferredDiscount.toFixed(2)} (${pct}%)`)
  }

  // ─── Bs amount (live BCV rate) ────────────────────────────────────────────
  let bsLine = ""
  try {
    // Prefer pre-stored total_bs from WA bot orders; otherwise compute live.
    if (meta.total_bs && Number(meta.total_bs) > 0) {
      bsLine = ` <i>(${Number(meta.total_bs).toFixed(2)} Bs)</i>`
    } else {
      const fx = await getFxRates()
      const totalBs = convertEur(currentTotal, fx).bs
      bsLine = totalBs && totalBs > 0 ? ` <i>(${totalBs.toFixed(2)} Bs)</i>` : ""
    }
  } catch (err) {
    console.warn("[order-tg-notify] BCV rate unavailable:", (err as Error).message)
  }

  lines.push(`<b>💰 TOTAL:</b> €${currentTotal.toFixed(2)}${bsLine}`)

  // ─── Optional links ───────────────────────────────────────────────────────
  const mapsLine = meta.maps_url
    ? `\n📍 <a href="${escapeHtml(String(meta.maps_url))}">Ver dirección en Maps</a>`
    : ""

  // MRW office (auto-detected from customer address if shipping_type=mrw)
  const mrwOfficeLine =
    shippingType === "mrw" && meta.mrw_office_url
      ? `\n🏢 <b>Retira en:</b> <a href="${escapeHtml(String(meta.mrw_office_url))}">` +
        `${escapeHtml(String(meta.mrw_office_name || "Oficina MRW"))}</a>` +
        (meta.mrw_office_address ? ` — ${escapeHtml(String(meta.mrw_office_address))}` : "")
      : ""
  const proofLine = meta.payment_proof_url
    ? `\n🧾 <b>Comprobante:</b> <a href="${escapeHtml(
        String(meta.payment_proof_url)
      )}">Ver imagen</a>`
    : ""

  // ─── Source attribution (one-line) ────────────────────────────────────────
  const utmSource = meta.attribution_utm_source || meta.attribution_referrer || ""
  const sourceLine = utmSource
    ? `\n🌐 <i>Origen: ${escapeHtml(String(utmSource))}</i>`
    : ""

  // Differentiation header so the team instantly sees which workflow applies.
  // - Inmediato (Valencia same-day): goes to delivery WhatsApp group, simple flow
  // - MRW (rest of Venezuela): NO delivery group, requires guide receipt upload
  const flowHeader =
    shippingType === "mrw"
      ? "📦 <b>ENVÍO MRW</b> — Resto de Venezuela"
      : shippingType === "inmediato"
      ? "⚡ <b>ENTREGA INMEDIATA</b> — Valencia"
      : "🛒 <b>NUEVO PEDIDO</b>"

  // Build people-section header: if the buyer ≠ recipient, surface BOTH.
  let peopleSection: string
  if (isOtherRecipient && recipientName) {
    peopleSection =
      `📥 <b>Recibe (en MRW):</b> ${escapeHtml(name)}\n` +
      `🪪 <b>Cédula:</b> ${escapeHtml(cedula)}\n` +
      `📱 ${escapeHtml(phone)}\n\n` +
      `💳 <b>Compra:</b> ${escapeHtml(buyerName)}\n` +
      `📱 ${escapeHtml(buyerPhone)}\n` +
      `📧 ${escapeHtml(buyerEmail)}`
  } else {
    peopleSection =
      `👤 ${escapeHtml(name)}\n` +
      `🪪 <b>Cédula:</b> ${escapeHtml(cedula)}\n` +
      `📱 ${escapeHtml(phone)}\n` +
      `📧 ${escapeHtml(email)}`
  }

  const text =
    `${flowHeader}\n` +
    `🛒 <b>Pedido #${order.display_id}</b>\n\n` +
    `${peopleSection}\n` +
    `🏠 ${escapeHtml(address)}${mapsLine}${mrwOfficeLine}\n\n` +
    `📦 <b>Productos:</b>\n${itemLines}\n\n` +
    `${lines.join("\n")}` +
    `${proofLine}${sourceLine}`

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "✅ Aprobar Pago", callback_data: `ap:${order.display_id}` },
        { text: "🔍 Revisar Pago", callback_data: `rv:${order.display_id}` },
      ],
    ],
  }

  try {
    console.log(
      `[order-tg-notify] dispatching order #${order.display_id} → chat_id=${chatId}`
    )
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup,
      }),
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => "")
      console.error(
        `[order-tg-notify] Telegram ${r.status}: ${errText.slice(0, 200)}`
      )
      return false
    }
    return true
  } catch (err) {
    console.error("[order-tg-notify] dispatch failed:", (err as Error).message)
    return false
  }
}

export default async function orderWhatsAppNotifyHandler({
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  try {
    const orderResult = await pool.query(
      `SELECT o.id, o.display_id, o.email, o.metadata,
              sa.first_name AS ship_first, sa.last_name AS ship_last,
              sa.address_1, sa.city, sa.province, sa.postal_code, sa.phone,
              COALESCE((os.totals->>'original_order_total')::numeric, 0) AS original_order_total,
              COALESCE((os.totals->>'current_order_total')::numeric,  0) AS current_order_total,
              COALESCE((os.totals->>'shipping_total')::numeric, 0)       AS shipping_total,
              COALESCE((os.totals->>'original_order_total')::numeric, 0) AS total
       FROM "order" o
       LEFT JOIN LATERAL (
         SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
       ) os ON true
       LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
       WHERE o.id = $1`,
      [data.id]
    )
    const order = orderResult.rows[0]
    if (!order) return

    const itemsResult = await pool.query(
      `SELECT DISTINCT ON (li.id) li.title, li.variant_title, li.variant_sku,
                                  oi.quantity, oi.unit_price
       FROM order_item oi
       JOIN order_line_item li ON li.id = oi.item_id
       WHERE oi.order_id = $1 AND oi.deleted_at IS NULL
       ORDER BY li.id, oi.version DESC`,
      [data.id]
    )
    const items = itemsResult.rows

    const custResult = await pool.query(
      `SELECT c.first_name, c.last_name, c.email, c.phone, c.metadata
       FROM "order" o LEFT JOIN customer c ON c.id = o.customer_id
       WHERE o.id = $1`,
      [data.id]
    )
    const cust = custResult.rows[0]

    // Telegram (group, with action buttons) is now the SOLE owner notification.
    // The legacy WhatsApp `notifyOwner` call has been removed — the Telegram
    // message contains everything the old WA owner notification had + better
    // totals breakdown + Bs conversion. No more duplicate dispatch.
    const tgSent = await sendTelegramOrderAlert({ order, cust, items })
    if (tgSent) {
      console.log(`[order-tg-notify] ✅ Telegram sent for order #${order.display_id}`)
    }
  } catch (err) {
    console.error("[order-tg-notify] Error:", err)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
