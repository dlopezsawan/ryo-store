/**
 * Telegram Webhook — handles inline keyboard callbacks for order management
 *
 * Flow:
 * 1. Order arrives → Telegram shows [Aprobar Pago] [Revisar Pago]
 * 2. "Revisar" → WhatsApp to customer: "pago en revisión"
 * 3. "Aprobar" → capturePaymentWorkflow → WhatsApp+email to customer, show warehouse buttons
 * 4. Select warehouse → createOrderFulfillmentWorkflow, WhatsApp to delivery group, show [Pedido Salió]
 * 5. "Pedido Salió" → createOrderShipmentWorkflow → WhatsApp to customer: "en camino!"
 * 6. "Pedido Recibido" → completeOrderWorkflow → marks order as completed (no notifications)
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  capturePaymentWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  completeOrderWorkflow,
} from "@medusajs/medusa/core-flows"
import { Pool } from "pg"
import { promises as fs } from "fs"
import path from "path"
import { getConfig, setConfig } from "../../../lib/whatsapp-db"
import { sendWhatsApp, sendWhatsAppImage } from "../../../lib/whatsapp-sender"
import { logTelegramCommand, classifyVentaError } from "../../../lib/telegram-log"
import { getFxRates, convertEur } from "../../../lib/fx-rates"
import { sendEmail } from "../../../lib/email-service"
import { resolveCustomerCedula } from "../../../lib/remarketing-db"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Telegram API helpers ───────────────────────────────────────────────────

async function tgApi(method: string, body: Record<string, unknown>) {
  const token = await getConfig("telegram_bot_token")
  if (!token) return null
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error(`[telegram] ${method} failed:`, res.status, await res.text().catch(() => ""))
  return res.ok ? res.json() : null
}

async function answerCallback(callbackId: string, text: string) {
  await tgApi("answerCallbackQuery", { callback_query_id: callbackId, text, show_alert: false })
}

// ─── MRW receipt: pending-state tracker ────────────────────────────────────
// When operator clicks "📤 Subir Comprobante MRW" we persist a small JSON in
// wa_bot_config keyed by chat_id so the next photo arriving in that chat is
// claimed for that order. Multiple operators on different chats are isolated.

interface MrwPending {
  order_id: string
  display_id: number
  message_id: number
  expires_at: number  // ms epoch
}

const MRW_PENDING_TTL_MS = 30 * 60_000 // 30 min — operator should upload promptly

async function setMrwPending(chatId: string | number, data: Omit<MrwPending, "expires_at">): Promise<void> {
  const payload: MrwPending = { ...data, expires_at: Date.now() + MRW_PENDING_TTL_MS }
  await setConfig(`mrw_pending_${chatId}`, JSON.stringify(payload))
}

async function getMrwPending(chatId: string | number): Promise<MrwPending | null> {
  const raw = await getConfig(`mrw_pending_${chatId}`)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as MrwPending
    if (Date.now() > data.expires_at) {
      await setConfig(`mrw_pending_${chatId}`, "")
      return null
    }
    return data
  } catch {
    return null
  }
}

async function clearMrwPending(chatId: string | number): Promise<void> {
  await setConfig(`mrw_pending_${chatId}`, "")
}

// ─── Telegram photo download → persist to /static/mrw-receipts ─────────────

async function downloadTelegramPhoto(
  fileId: string,
  orderId: string
): Promise<{ url: string; buffer: Buffer } | null> {
  try {
    const token = await getConfig("telegram_bot_token")
    if (!token) return null

    // Step 1: getFile → file_path
    const meta = await tgApi("getFile", { file_id: fileId }) as { result?: { file_path?: string } } | null
    const filePath = meta?.result?.file_path
    if (!filePath) {
      console.warn("[telegram-photo] getFile returned no file_path")
      return null
    }

    // Step 2: download from CDN
    const dlUrl = `https://api.telegram.org/file/bot${token}/${filePath}`
    const dl = await fetch(dlUrl, { signal: AbortSignal.timeout(20000) })
    if (!dl.ok) {
      console.warn(`[telegram-photo] download failed: ${dl.status}`)
      return null
    }
    const buffer = Buffer.from(await dl.arrayBuffer())
    if (buffer.length < 100) {
      console.warn("[telegram-photo] payload too small to be an image")
      return null
    }

    // Step 3: persist to /static/mrw-receipts/ (same convention as wa-proofs)
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50
    const ext = isPng ? "png" : isJpeg ? "jpg" : "jpg"
    const uploadDir = path.join(process.cwd(), "static", "mrw-receipts")
    await fs.mkdir(uploadDir, { recursive: true })
    const filename = `mrw-${orderId.replace(/[^a-zA-Z0-9_]/g, "_")}-${Date.now()}.${ext}`
    await fs.writeFile(path.join(uploadDir, filename), buffer)
    const publicUrl = `https://api.enrola.shop/static/mrw-receipts/${filename}`
    console.log(`[telegram-photo] saved ${publicUrl} (${buffer.length} bytes)`)
    return { url: publicUrl, buffer }
  } catch (err) {
    console.error("[telegram-photo] download error:", (err as Error).message)
    return null
  }
}

async function editMessage(chatId: string | number, messageId: number, text: string, buttons?: unknown[][]) {
  // Try editing the text first — this is the happy path for normal text messages.
  const result = await tgApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  })
  if (result) return

  // If editing the text failed (e.g. Telegram says "no text in the message to
  // edit" — happens with media messages OR after some edge edit-state), we DO
  // NOT fall back to sending a new message. Sending a new message creates a
  // duplicate in the chat and confuses operators. Instead we just update the
  // reply markup so the buttons reflect the new state. Any informational text
  // change is lost; that's acceptable — the buttons drive the workflow.
  await tgApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: buttons ? { inline_keyboard: buttons } : { inline_keyboard: [] },
  })
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

async function resolveOrderId(displayIdStr: string): Promise<string> {
  const r = await pool.query('SELECT id FROM "order" WHERE display_id = $1', [parseInt(displayIdStr)])
  return r.rows[0]?.id || displayIdStr
}

async function getOrderDetails(orderId: string) {
  const r = await pool.query(
    `SELECT o.id, o.display_id, o.email, o.status, o.metadata, o.customer_id,
            COALESCE((os.totals->>'original_order_total')::numeric, 0) as total,
            COALESCE((os.totals->>'original_order_total')::numeric, 0) as original_total,
            COALESCE((os.totals->>'current_order_total')::numeric, 0)  as current_total,
            COALESCE((os.totals->>'shipping_total')::numeric, 0) as shipping_total,
            sa.first_name, sa.last_name, sa.address_1, sa.city, sa.province, sa.phone
     FROM "order" o
     LEFT JOIN LATERAL (SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) os ON true
     LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
     WHERE o.id = $1`,
    [orderId]
  )
  return r.rows[0] || null
}

async function getOrderItems(orderId: string) {
  const r = await pool.query(
    `SELECT DISTINCT ON (li.id) li.title, li.variant_title, li.variant_sku,
                                oi.quantity, oi.unit_price
     FROM order_item oi
     JOIN order_line_item li ON li.id = oi.item_id
     WHERE oi.order_id = $1 AND oi.deleted_at IS NULL
     ORDER BY li.id, oi.version DESC`,
    [orderId]
  )
  return r.rows as Array<{
    title: string
    quantity: number
    unit_price: number
    variant_title?: string | null
    variant_sku?: string | null
  }>
}

/** Same logic as in order-whatsapp-notify — builds "Producto — Variante [SKU]" label */
function formatItemLabel(item: {
  title: string
  variant_title?: string | null
  variant_sku?: string | null
}): string {
  const v = item.variant_title?.trim()
  const sku = item.variant_sku?.trim()
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

async function buildOrderDetailBlock(
  order: Record<string, unknown>,
  items: Array<{
    title: string
    quantity: number
    unit_price: number
    variant_title?: string | null
    variant_sku?: string | null
  }>
): Promise<string> {
  const meta = (order.metadata || {}) as Record<string, string>
  const originalTotal = Number(order.original_total ?? order.total ?? 0)
  const currentTotal = Number(order.current_total ?? order.total ?? 0)
  const shippingType = meta.shipping_type || ""
  const shippingLabel = shippingType === "mrw" ? "MRW (cobro a destino)" : shippingType === "inmediato" ? "Inmediato — Solo Valencia" : shippingType || ""
  const shippingTotal = Number(meta.shipping_cost || order.shipping_total || 0)

  // Sum line items pre-discount
  const itemsSubtotal = items.reduce(
    (s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 0),
    0
  )

  const itemLines = items
    .map((i) => {
      const lineTotal = Number(i.unit_price) * Number(i.quantity)
      const label = formatItemLabel({
        title: String(i.title || "Producto"),
        variant_title: i.variant_title || null,
        variant_sku: i.variant_sku || null,
      })
      return `  • ${label} ×${i.quantity} — €${lineTotal.toFixed(2)}`
    })
    .join("\n")

  // Compute discount. Two sources:
  //  1. order_summary (original_total - current_total) — if Medusa promotion was applied
  //  2. inferred — if items_subtotal + shipping > current_total (e.g. ad-hoc adjustment)
  const summaryDiscount = Math.max(0, originalTotal - currentTotal)
  const inferredDiscount = Math.max(0, itemsSubtotal + shippingTotal - currentTotal)
  const discountAmount = summaryDiscount > 0.01 ? summaryDiscount : inferredDiscount
  const showDiscount = discountAmount > 0.01

  const totalsLines: string[] = []
  totalsLines.push(`<b>Subtotal:</b> €${itemsSubtotal.toFixed(2)}`)
  if (shippingTotal > 0) {
    totalsLines.push(`<b>Envío${shippingLabel ? ` (${shippingLabel})` : ""}:</b> €${shippingTotal.toFixed(2)}`)
  } else if (meta.free_shipping_applied && shippingType === "inmediato") {
    // Inmediato + cliente cumplió la regla €10+ → envío gratis con ahorro.
    // Gated to inmediato only — MRW is cobro a destino, no aplica esta promo.
    const savings = Number(meta.free_shipping_savings_eur || 3).toFixed(2)
    const threshold = meta.free_shipping_threshold_eur || 10
    totalsLines.push(`<b>Envío:</b> GRATIS <i>(ahorro €${savings} — promo ≥€${threshold})</i>`)
  } else if (shippingLabel) {
    totalsLines.push(`<b>Envío:</b> ${shippingLabel}`)
  }
  if (showDiscount) {
    const pct = itemsSubtotal > 0 ? Math.round((discountAmount / itemsSubtotal) * 100) : 0
    totalsLines.push(`<b>Descuento:</b> −€${discountAmount.toFixed(2)}${pct > 0 ? ` (${pct}%)` : ""}`)
  }

  // Bs amount — prefer pre-stored (WA bot orders), else compute live via BCV
  let bsLine = ""
  try {
    if (meta.total_bs && Number(meta.total_bs) > 0) {
      bsLine = ` <i>(${Number(meta.total_bs).toFixed(2)} Bs)</i>`
    } else {
      const fx = await getFxRates()
      const totalBs = convertEur(currentTotal, fx).bs
      bsLine = totalBs && totalBs > 0 ? ` <i>(${totalBs.toFixed(2)} Bs)</i>` : ""
    }
  } catch (err) {
    console.warn("[telegram] BCV rate unavailable:", (err as Error).message)
  }
  totalsLines.push(`💰 <b>Total:</b> €${currentTotal.toFixed(2)}${bsLine}`)

  const addressParts = [order.address_1, order.city, order.province].filter(Boolean).join(", ")
  const phoneLine = order.phone ? `\n📱 ${order.phone}` : ""
  const mapsLine = meta.maps_url ? `\n📍 <a href="${meta.maps_url}">Ver dirección en Maps</a>` : ""
  const proofLine = meta.payment_proof_url ? `\n🧾 <b>Comprobante pago:</b> <a href="${meta.payment_proof_url}">Ver imagen</a>` : ""
  const mrwOfficeLine =
    shippingType === "mrw" && meta.mrw_office_url
      ? `\n🏢 <b>Oficina MRW:</b> <a href="${meta.mrw_office_url}">` +
        `${meta.mrw_office_name || "Ver en Maps"}</a>` +
        (meta.mrw_office_address ? ` — ${meta.mrw_office_address}` : "")
      : ""

  // Cédula — required field for VE shipping (MRW won't accept packages
  // without it on the receiving end). We render it ALWAYS so the operator
  // sees gaps explicitly: present → "🪪 V-12345678", missing → loud
  // warning. Never silently omit, so an operator can't miss it.
  //
  // Resolution order (matches resolveCustomerCedula):
  //   1. order.metadata.cedula  (storefront checkout writes here, also
  //      the WhatsApp/Telegram manual-sale flows)
  //   2. customer.metadata.cedula  (canonical store)
  //   3. fallback to most recent order.metadata.cedula for the customer
  let cedula: string | null = (typeof meta.cedula === "string" && meta.cedula.trim()) || null
  if (!cedula) {
    cedula = await resolveCustomerCedula(
      (order.customer_id as string | null) ?? null,
      (order.email as string | null) ?? null
    )
  }
  const cedulaLine = cedula
    ? `\n🪪 ${cedula}`
    : `\n⚠️ <b>Sin cédula registrada</b> — pedirla al cliente antes de despachar`

  return `\n<b>Artículos:</b>\n${itemLines}\n\n${totalsLines.join("\n")}\n\n👤 ${order.first_name || ""} ${order.last_name || ""}\n📧 ${order.email}${phoneLine}${cedulaLine}\n🏠 ${addressParts || "Sin dirección"}${mapsLine}${mrwOfficeLine}${proofLine}`
}

async function getStockLocations() {
  const r = await pool.query("SELECT id, name FROM stock_location WHERE deleted_at IS NULL ORDER BY name")
  return r.rows as Array<{ id: string; name: string }>
}

async function resolveWarehouseId(idx: string): Promise<{ id: string; name: string }> {
  const locations = await getStockLocations()
  const i = parseInt(idx) || 0
  return locations[i] || locations[0] || { id: "", name: "Desconocido" }
}

/**
 * Returns the Google Maps URL for a warehouse pickup point.
 * Prefers a curated `maps_url` from stock_location_address.metadata (points to
 * a named place on Maps), else falls back to a simple lat/lng query URL.
 * Returns null if neither is available.
 */
async function getWarehousePickupMapsUrl(warehouseId: string): Promise<string | null> {
  if (!warehouseId) return null
  const r = await pool.query(
    `SELECT a.metadata
       FROM stock_location sl
       LEFT JOIN stock_location_address a ON a.id = sl.address_id
      WHERE sl.id = $1 AND sl.deleted_at IS NULL`,
    [warehouseId]
  )
  const meta = (r.rows[0]?.metadata || {}) as Record<string, unknown>
  if (typeof meta.maps_url === "string" && meta.maps_url.startsWith("http")) {
    return meta.maps_url
  }
  const lat = Number(meta.lat)
  const lng = Number(meta.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}

async function getCustomerJid(order: Record<string, unknown>): Promise<string> {
  const meta = (order.metadata || {}) as Record<string, string>
  const waPhone = meta.whatsapp_phone || String(order.phone || "")
  if (!waPhone) return ""
  const r = await pool.query("SELECT value FROM wa_bot_config WHERE key = $1", [`jid_${waPhone}`])
  return r.rows[0]?.value || waPhone
}

// Get the pending payment ID for an order
async function getOrderPaymentId(orderId: string): Promise<string | null> {
  const r = await pool.query(
    `SELECT p.id FROM payment p
     JOIN order_payment_collection opc ON opc.payment_collection_id = p.payment_collection_id
     WHERE opc.order_id = $1
       AND p.captured_at IS NULL
       AND p.canceled_at IS NULL
       AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC LIMIT 1`,
    [orderId]
  )
  return r.rows[0]?.id || null
}

// Get order line items for fulfillment
async function getOrderLineItems(orderId: string): Promise<Array<{ id: string; quantity: number }>> {
  const r = await pool.query(
    `SELECT li.id, oi.quantity
     FROM order_item oi
     JOIN order_line_item li ON li.id = oi.item_id
     WHERE oi.order_id = $1
       AND oi.version = (SELECT MAX(version) FROM order_item WHERE order_id = $1)
       AND oi.deleted_at IS NULL`,
    [orderId]
  )
  return r.rows.map(row => ({ id: row.id, quantity: Number(row.quantity) }))
}

// Get fulfillment ID for an order (latest unfulfilled)
async function getOrderFulfillmentId(orderId: string): Promise<string | null> {
  const r = await pool.query(
    `SELECT f.id FROM fulfillment f
     JOIN order_fulfillment of2 ON of2.fulfillment_id = f.id
     WHERE of2.order_id = $1
       AND f.shipped_at IS NULL
       AND f.canceled_at IS NULL
       AND f.deleted_at IS NULL
     ORDER BY f.created_at DESC LIMIT 1`,
    [orderId]
  )
  return r.rows[0]?.id || null
}

// ─── Human handoff (Batch 7+) ──────────────────────────────────────────────

const AGENT_GREETINGS: Record<string, string> = {
  damian:   "Hola, soy Damian 🌸 ¿en qué puedo ayudarte?",
  floyd:    "Hola, soy Floyd 🌸 ¿en qué puedo ayudarte?",
  daniel:   "Hola, soy Daniel 🌸 ¿en qué puedo ayudarte?",
  leonardo: "Hola, soy Leonardo 🌸 ¿en qué puedo ayudarte?",
}

const AGENT_DISPLAY: Record<string, string> = {
  damian:   "Damian",
  floyd:    "Floyd",
  daniel:   "Daniel",
  leonardo: "Leonardo",
}

const VALID_AGENTS = Object.keys(AGENT_GREETINGS)

async function handleHumanHandoff(
  agentOrAction: string,
  phone: string,
  chatId: string | number,
  messageId: number,
  callbackId: string
) {
  if (!phone) {
    await answerCallback(callbackId, "Falta phone")
    return
  }

  // Action 1: assign agent
  if (VALID_AGENTS.includes(agentOrAction)) {
    const agent = agentOrAction
    await answerCallback(callbackId, `${AGENT_DISPLAY[agent]} toma...`)

    // 1. Send greeting to customer via WhatsApp
    const jidR = await pool.query("SELECT value FROM wa_bot_config WHERE key = $1", [`jid_${phone}`])
    const sendTo = jidR.rows[0]?.value || phone
    const greeting = AGENT_GREETINGS[agent]
    await sendWhatsApp(sendTo, greeting)

    // 2. Save in WA history (role='human' — Dana lo verá pero NO se atribuye autoría)
    await pool.query(
      `INSERT INTO wa_messages (phone, role, content) VALUES ($1, 'human', $2)`,
      [phone, greeting]
    )

    // 3. Mark conversation as human_active + record agent + start timestamp.
    // Also clears any stale return-alert flag from a previous closed handoff.
    const startedAt = new Date().toISOString()
    await pool.query(
      `UPDATE wa_conversations
       SET session_status = 'human_active',
           order_data = (COALESCE(order_data, '{}'::jsonb) - 'handoff_return_alerted')
                         || jsonb_build_object(
                           'current_agent', $2::text,
                           'agent_started_at', $3::text
                         ),
           last_message_at = NOW(),
           updated_at = NOW()
       WHERE phone = $1`,
      [phone, agent, startedAt]
    )

    // 4. Edit the Telegram message
    await editMessage(chatId, messageId,
      `🧑 <b>${AGENT_DISPLAY[agent]}</b> está atendiendo a <code>${phone}</code>

Dana está silenciada. Cuando termines, presiona Listo.
Si pasan 30 min sin actividad, Dana vuelve sola.`,
      [[{ text: "✅ Listo (devolver a Dana)", callback_data: `hh:done:${phone}` }]]
    )
    return
  }

  // Action 2: done — return to Dana with summary
  if (agentOrAction === "done") {
    await answerCallback(callbackId, "Listo, Dana vuelve")

    // Read current handoff metadata before clearing
    const cur = await pool.query(
      `SELECT order_data->>'current_agent' as agent,
              order_data->>'agent_started_at' as started_at
       FROM wa_conversations WHERE phone = $1`,
      [phone]
    )
    const agent = cur.rows[0]?.agent || "alguien"
    const startedAt = cur.rows[0]?.started_at
    const agentDisplay = AGENT_DISPLAY[agent] || agent

    let durationMin = 0
    let humanCount = 0
    let userCount = 0
    if (startedAt) {
      durationMin = Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
      // Count messages between start and now
      const counts = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE role = 'human') AS human_msgs,
           COUNT(*) FILTER (WHERE role = 'user') AS user_msgs
         FROM wa_messages WHERE phone = $1 AND created_at >= $2::timestamptz`,
        [phone, startedAt]
      )
      humanCount = parseInt(counts.rows[0].human_msgs)
      userCount = parseInt(counts.rows[0].user_msgs)
    }

    // Update: clear active flags, append to history, mark last handoff for "vuelve a escribir" alerts
    const finishedAt = new Date().toISOString()
    const historyEntry = {
      agent,
      started_at: startedAt,
      ended_at: finishedAt,
      duration_min: durationMin,
      human_messages: humanCount,
      user_messages: userCount,
    }
    await pool.query(
      `UPDATE wa_conversations
       SET session_status = 'bot_active',
           order_data = jsonb_set(
             COALESCE(order_data, '{}'::jsonb) - 'current_agent' - 'agent_started_at',
             '{handoff_history}',
             COALESCE(order_data->'handoff_history', '[]'::jsonb) || $2::jsonb
           ) || jsonb_build_object(
             'last_handoff_done_at', $3::text,
             'last_handoff_agent', $4::text
           ),
           updated_at = NOW()
       WHERE phone = $1`,
      [phone, JSON.stringify(historyEntry), finishedAt, agent]
    )

    const summary = startedAt
      ? `✅ <b>${agentDisplay}</b> atendió a <code>${phone}</code>
⏱ ${durationMin} min · ${humanCount} mensaje${humanCount !== 1 ? "s" : ""} del agente · ${userCount} del cliente

Dana volvió a tomar.`
      : `✅ Atención humana cerrada por <b>${agentDisplay}</b> para <code>${phone}</code>. Dana volvió a tomar.`

    await editMessage(chatId, messageId, summary, [])
    return
  }

  await answerCallback(callbackId, "Acción de handoff desconocida")
}

// ─── Callback handlers ──────────────────────────────────────────────────────

async function handleReviewPayment(
  orderId: string, chatId: string | number, messageId: number, callbackId: string
) {
  await answerCallback(callbackId, "Enviando aviso al cliente...")

  const fullOrderId = await resolveOrderId(orderId)
  const order = await getOrderDetails(fullOrderId)
  if (!order) return

  const jid = await getCustomerJid(order)
  if (jid) {
    await sendWhatsApp(jid,
      `⏳ Hola ${order.first_name || ""}! Tu pago para el pedido #${order.display_id} está siendo verificado. Te avisamos pronto. 🙏`
    )
  }

  const items = await getOrderItems(fullOrderId)
  const details = await buildOrderDetailBlock(order, items)
  await editMessage(chatId, messageId,
    `🔍 Pedido #${order.display_id} — PAGO EN REVISIÓN${details}`,
    [[{ text: "✅ Aprobar Pago", callback_data: `ap:${order.display_id}` }]]
  )
}

async function handleApprovePayment(
  orderId: string, chatId: string | number, messageId: number, callbackId: string, scope: MedusaRequest["scope"]
) {
  await answerCallback(callbackId, "Aprobando pago...")

  const fullOrderId = await resolveOrderId(orderId)
  const order = await getOrderDetails(fullOrderId)
  if (!order) return

  // 1. Capture payment via Medusa workflow (updates payment status + order summary)
  const paymentId = await getOrderPaymentId(fullOrderId)
  if (paymentId) {
    try {
      await capturePaymentWorkflow(scope).run({
        input: { payment_id: paymentId },
      })
      console.log(`[telegram] Payment captured for order ${order.display_id}: ${paymentId}`)
    } catch (err) {
      console.error("[telegram] capturePaymentWorkflow failed:", err)
    }
  } else {
    console.warn(`[telegram] No pending payment found for order ${order.display_id}`)
  }

  // 2. WhatsApp to customer
  const jid = await getCustomerJid(order)
  if (jid) {
    await sendWhatsApp(jid,
      `✅ ¡Pago verificado! Tu pedido #${order.display_id} está confirmado. Estamos preparando tu envío. Te avisamos cuando salga 🚚`
    )
  }

  // 3. Show warehouse selection
  const locations = await getStockLocations()
  const buttons = locations.map((loc, i) => [
    { text: `📦 ${loc.name}`, callback_data: `wh:${order.display_id}:${i}` },
  ])

  const items = await getOrderItems(fullOrderId)
  const details = await buildOrderDetailBlock(order, items)

  await editMessage(chatId, messageId,
    `✅ Pedido #${order.display_id} — PAGO CAPTURADO${details}\n\n📦 ¿Desde qué almacén se envía?`,
    buttons
  )
}

async function handleWarehouseSelect(
  orderId: string, warehouseIdx: string, chatId: string | number, messageId: number, callbackId: string, scope: MedusaRequest["scope"]
) {
  await answerCallback(callbackId, "Creando envío...")

  const fullOrderId = await resolveOrderId(orderId)
  const order = await getOrderDetails(fullOrderId)
  if (!order) { console.error("[telegram] Order not found:", orderId); return }

  const warehouse = await resolveWarehouseId(warehouseIdx)

  // 1. Create fulfillment in Medusa via workflow
  const lineItems = await getOrderLineItems(fullOrderId)
  if (lineItems.length > 0) {
    try {
      await createOrderFulfillmentWorkflow(scope).run({
        input: {
          order_id: fullOrderId,
          location_id: warehouse.id,
          items: lineItems.map(i => ({ id: i.id, quantity: i.quantity })),
          metadata: { warehouse_name: warehouse.name, created_by: "telegram" },
        },
      })
      console.log(`[telegram] Fulfillment created for order ${order.display_id} from ${warehouse.name}`)
    } catch (err) {
      console.error("[telegram] createOrderFulfillmentWorkflow failed:", err)
    }
  } else {
    console.warn(`[telegram] No line items found for order ${order.display_id}`)
  }

  // 2. Notify delivery WhatsApp group ONLY for inmediato (Valencia same-day).
  //    MRW orders are picked up by the courier, the delivery group doesn't act on them.
  const meta = (order.metadata || {}) as Record<string, string>
  const shippingType = (meta.shipping_type || "").toLowerCase()
  const isMrw = shippingType === "mrw"

  if (!isMrw) {
    const deliveryGroup = await getConfig("delivery_whatsapp_group")
    if (deliveryGroup) {
      const deliveryMapsLine = meta.maps_url ? `\n📍 Destino: ${meta.maps_url}` : ""
      const pickupMapsUrl = await getWarehousePickupMapsUrl(warehouse.id)
      const pickupMapsLine = pickupMapsUrl ? `\n🗺️ Recoger aquí: ${pickupMapsUrl}` : ""
      await sendWhatsApp(deliveryGroup,
        `🚚 NUEVO ENVÍO — Pedido #${order.display_id}\n\n📦 Recoger en: ${warehouse.name}${pickupMapsLine}\n\n👤 ${order.first_name || ""} ${order.last_name || ""}\n📱 ${order.phone || "N/A"}\n🏠 ${[order.address_1, order.city, order.province].filter(Boolean).join(", ")}${deliveryMapsLine}\n\n💰 €${Number(order.total).toFixed(2)}`
      )
    }
  } else {
    console.log(`[telegram] order #${order.display_id} is MRW — skipping delivery WA group`)
  }

  const items = await getOrderItems(fullOrderId)
  const details = await buildOrderDetailBlock(order, items)

  // Branch the next-step button by shipping type:
  // - Inmediato: directly "Pedido Salió" — courier confirms in person
  // - MRW: first need the courier guide receipt image + tracking #, so the
  //   operator clicks "Subir Comprobante MRW" and the bot enters guide-capture state.
  const nextButton = isMrw
    ? { text: "📤 Subir Comprobante MRW", callback_data: `mr:${order.display_id}` }
    : { text: "🚚 Pedido Salió", callback_data: `sh:${order.display_id}` }

  const headerLine = isMrw
    ? `📦 Pedido #${order.display_id} — LISTO PARA MRW`
    : `📦 Pedido #${order.display_id} — EN PREPARACIÓN`

  const waitMessage = isMrw
    ? `\n\n📤 Sube la foto del comprobante MRW (con # de guía y monto a pagar) para notificar al cliente.`
    : `\n\n⏳ Esperando confirmación de salida...`

  await editMessage(chatId, messageId,
    `${headerLine}\n📍 Almacén: ${warehouse.name}${details}${waitMessage}`,
    [[nextButton]]
  )
}

/**
 * MRW flow — operator clicks "📤 Subir Comprobante MRW" on the EN PREPARACIÓN
 * message. We mark this chat as awaiting an image upload for this specific
 * order, then ask for the photo. The next photo arriving in this chat is
 * claimed for this order (see PHOTO handler at the end of POST).
 */
async function handleMrwReceiptRequest(
  orderId: string,
  chatId: string | number,
  messageId: number,
  callbackId: string
) {
  await answerCallback(callbackId, "Esperando comprobante MRW…")

  const fullOrderId = await resolveOrderId(orderId)
  const order = await getOrderDetails(fullOrderId)
  if (!order) return

  await setMrwPending(chatId, {
    order_id: fullOrderId,
    display_id: Number(order.display_id),
    message_id: messageId,
  })

  const items = await getOrderItems(fullOrderId)
  const details = await buildOrderDetailBlock(order, items)
  await editMessage(
    chatId,
    messageId,
    `📦 Pedido #${order.display_id} — ESPERANDO COMPROBANTE MRW${details}\n\n` +
      `📤 Sube ahora la foto del comprobante MRW (con # de guía y monto a pagar).\n` +
      `Cuando llegue, aparecerá el botón <b>🚚 Pedido Salió</b>.`,
    // No buttons while waiting — operator just sends the photo into this chat.
    []
  )
}

async function handleShipped(
  orderId: string, chatId: string | number, messageId: number, callbackId: string, scope: MedusaRequest["scope"]
) {
  await answerCallback(callbackId, "Marcando como enviado...")

  const fullOrderId = await resolveOrderId(orderId)
  const order = await getOrderDetails(fullOrderId)
  if (!order) return

  // 1. Create shipment via Medusa workflow (marks fulfillment shipped + updates order)
  const fulfillmentId = await getOrderFulfillmentId(fullOrderId)
  if (fulfillmentId) {
    try {
      await createOrderShipmentWorkflow(scope).run({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input: { order_id: fullOrderId, fulfillment_id: fulfillmentId } as any,
      })
      console.log(`[telegram] Shipment created for order ${order.display_id}: ${fulfillmentId}`)
    } catch (err) {
      console.error("[telegram] createOrderShipmentWorkflow failed:", err)
    }
  } else {
    console.warn(`[telegram] No pending fulfillment for order ${order.display_id}`)
  }

  // 2. Notify customer — branch by shipping type
  const meta = (order.metadata || {}) as Record<string, string>
  const isMrw = (meta.shipping_type || "").toLowerCase() === "mrw"
  const mrwReceiptUrl = meta.mrw_receipt_url ? String(meta.mrw_receipt_url) : null

  const jid = await getCustomerJid(order)
  const customerEmail = (order.email as string) || ""
  const firstName = (order.first_name as string) || "Cliente"

  if (isMrw && mrwReceiptUrl) {
    // MRW: send the comprobante image with caption explaining what to pay.
    const waMrwCaption =
      `🚚 ¡Tu pedido #${order.display_id} ya salió por MRW!\n\n` +
      `📋 Aquí tu comprobante con número de guía y monto a pagar al recibir el envío en la oficina MRW.\n\n` +
      `¡Gracias por comprar en Enrola! 🙌`
    if (jid) {
      const sent = await sendWhatsAppImage(jid, mrwReceiptUrl, waMrwCaption)
      if (!sent) {
        // Fallback to text if image send fails for any reason
        await sendWhatsApp(jid, `${waMrwCaption}\n\n🧾 Comprobante: ${mrwReceiptUrl}`)
      }
    }
    if (customerEmail) {
      const html =
        `<p>Hola ${firstName},</p>` +
        `<p>Tu pedido <strong>#${order.display_id}</strong> ya salió por MRW. ` +
        `Aquí abajo está tu comprobante con número de guía y monto a pagar al recibir el envío en la oficina MRW.</p>` +
        `<p><img src="${mrwReceiptUrl}" alt="Comprobante MRW" style="max-width:100%;border:1px solid #e5e7eb;border-radius:6px"/></p>` +
        `<p>Si tienes cualquier duda, respóndele a este correo o escríbenos por WhatsApp.</p>` +
        `<p>— Equipo Enrola 🙌</p>`
      await sendEmail({
        to: customerEmail,
        subject: `🚚 Tu pedido #${order.display_id} salió por MRW — comprobante adjunto`,
        html,
      })
    }
  } else {
    // Inmediato (or MRW without receipt — should not happen given the flow): plain text.
    if (jid) {
      await sendWhatsApp(
        jid,
        `🚚 ¡Tu pedido #${order.display_id} ya salió! Está en camino a tu dirección. ¡Gracias por comprar en Enrola! 🙌`
      )
    }
  }

  const items = await getOrderItems(fullOrderId)
  const details = await buildOrderDetailBlock(order, items)
  const proofLine = mrwReceiptUrl
    ? `\n\n🧾 Comprobante MRW: <a href="${mrwReceiptUrl}">Ver imagen</a>`
    : ""
  await editMessage(chatId, messageId,
    `✅ Pedido #${order.display_id} — ENVIADO${details}${proofLine}\n\n🚚 En camino. Notificación enviada al cliente.`,
    [[{ text: "📦 Pedido Recibido", callback_data: `rc:${order.display_id}` }]]
  )
}

async function handleReceived(
  orderId: string, chatId: string | number, messageId: number, callbackId: string, scope: MedusaRequest["scope"]
) {
  await answerCallback(callbackId, "Marcando como recibido...")

  const fullOrderId = await resolveOrderId(orderId)
  const order = await getOrderDetails(fullOrderId)
  if (!order) return

  // 1. Mark fulfillment as delivered
  try {
    await pool.query(
      `UPDATE fulfillment SET delivered_at = NOW()
       WHERE id IN (
         SELECT f.id FROM fulfillment f
         JOIN order_fulfillment of2 ON of2.fulfillment_id = f.id
         WHERE of2.order_id = $1 AND f.delivered_at IS NULL AND f.canceled_at IS NULL
       )`,
      [fullOrderId]
    )
    console.log(`[telegram] Fulfillment marked as delivered for order ${order.display_id}`)
  } catch (err) {
    console.error("[telegram] Mark delivered failed:", err)
  }

  // 2. Complete order
  try {
    await completeOrderWorkflow(scope).run({
      input: { orderIds: [fullOrderId] },
    })
    console.log(`[telegram] Order ${order.display_id} marked as completed`)
  } catch (err) {
    console.error("[telegram] completeOrderWorkflow failed:", err)
  }

  const items = await getOrderItems(fullOrderId)
  const details = await buildOrderDetailBlock(order, items)
  await editMessage(chatId, messageId,
    `📦 Pedido #${order.display_id} — COMPLETADO${details}\n\n✅ Pedido recibido por el cliente.`
  )
}

// ─── Main webhook handler ───────────────────────────────────────────────────

// ─── /venta command — quick manual sale ─────────────────────────────────────

// Product name aliases → DB search terms
const PRODUCT_ALIASES: Record<string, string> = {
  "rp": "rolling paper hemp",
  "rolling paper": "rolling paper hemp",
  "rolling paper cañamo": "rolling paper hemp",
  "rolling paper cáñamo": "rolling paper hemp",
  "rolling paper hemp": "rolling paper hemp",
  "rp sabores": "rolling paper sabores",
  "rolling paper sabores": "rolling paper sabores",
  "rp celulosa": "rolling paper celulosa",
  "rolling paper celulosa": "rolling paper celulosa",
  "conos": "conos hemp",
  "conos hemp": "conos hemp",
  "conos brown": "conos hemp",
  "conos saborizados": "conos saborizados",
  "conos sabores": "conos saborizados",
  "conos celulosa": "conos celulosa",
  "grinder electrico": "grinder eléctrico",
  "grinder eléctrico": "grinder eléctrico",
  "grinder plastico": "grinder plástico",
  "grinder plástico": "grinder plástico",
  "filtro carbon": "filtro carbón",
  "filtro carbón": "filtro carbón",
  "filtros carbon": "filtro carbón",
  "filtros": "filtro carbón",
  "tips": "filter tips",
  "filter tips": "filter tips",
  "tips puffman": "filter tips",
}

// Parse "key value" segments from a comma-separated tail. Returns the remaining
// positional text (before the first recognized key) and extracted fields.
function parseVentaTail(tail: string): {
  positional: string
  cedula?: string
  phone?: string
  email?: string
  warehouse?: string
} {
  const KEY_RE = /,\s*(cedula|c[ée]dula|tel[eé]fono|tel|phone|email|correo|almac[ée]n|almacen)\s+/i
  const segments: Array<{ key: string; value: string }> = []
  let positional = tail
  let m: RegExpMatchArray | null
  while ((m = positional.match(KEY_RE))) {
    const start = m.index!
    const rest = positional.slice(start + m[0].length)
    const next = rest.match(KEY_RE)
    const value = next ? rest.slice(0, next.index!).trim() : rest.trim()
    segments.push({ key: m[1].toLowerCase(), value })
    positional = positional.slice(0, start) + (next ? "," + rest.slice(next.index!) : "")
  }
  const out: ReturnType<typeof parseVentaTail> = { positional: positional.trim().replace(/,\s*$/, "") }
  for (const { key, value } of segments) {
    if (/^c[ée]dula$|^cedula$/.test(key)) out.cedula = value
    else if (/^tel|^phone/.test(key)) out.phone = value
    else if (/^email|^correo/.test(key)) out.email = value
    else if (/^almac/.test(key)) out.warehouse = value.toLowerCase()
  }
  return out
}

async function handleVentaCommand(text: string, chatId: string | number, scope: MedusaRequest["scope"]) {
  // Parse: /venta [cantidad] [producto] para [cliente], [cedula X,] [tel X,] [email X,] almacen [almacen]
  // Examples:
  //   /venta 1 rolling paper cañamo para douglas hidalgo, almacen daniel
  //   /venta 2 conos sabores para maria garcia, cedula 12345678, tel +584121234567, email maria@ejemplo.com, almacen leo

  const content = text.replace(/^\/venta\s*/i, "").trim()
  if (!content) {
    await tgApi("sendMessage", {
      chat_id: chatId,
      text: "❌ Formato: /venta [cantidad] [producto] para [nombre cliente], almacen [almacen]\n\nOpcional: cedula, tel, email\n\nEjemplo: /venta 1 rolling paper cañamo para douglas hidalgo, cedula 12345678, tel +584121234567, email douglas@enrola.shop, almacen daniel",
      parse_mode: "HTML",
    })
    void logTelegramCommand({ command: "/venta", args: "", chat_id: chatId, result: "error", error_type: "empty_args", error_message: "no content provided" })
    return
  }

  try {
    // Extract quantity (first number, default 1)
    const qtyMatch = content.match(/^(\d+)\s+/)
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1
    const afterQty = qtyMatch ? content.substring(qtyMatch[0].length) : content

    // Split by "para" to get product and client part
    const paraParts = afterQty.split(/\s+para\s+/i)
    if (paraParts.length < 2) {
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: '❌ Falta "para [nombre]". Ejemplo: /venta 1 rp para juan perez, almacen daniel',
      })
      void logTelegramCommand({ command: "/venta", args: content, chat_id: chatId, result: "error", error_type: "client_name_missing", error_message: "no 'para' clause" })
      return
    }

    const productQuery = paraParts[0].trim().toLowerCase()

    // Parse tail: extract cedula/tel/email/almacen key-value segments, leaving the client name as positional
    const parsed = parseVentaTail(paraParts[1])
    const clientName = parsed.positional.trim()
    const warehouseName = parsed.warehouse || ""

    if (!warehouseName) {
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: '❌ Falta almacén. Ejemplo: /venta 1 rp para juan perez, almacen daniel',
      })
      void logTelegramCommand({ command: "/venta", args: content, chat_id: chatId, result: "error", error_type: "warehouse_missing", error_message: "no warehouse in args" })
      return
    }

    // Resolve product
    const searchTerm = PRODUCT_ALIASES[productQuery] || productQuery
    const productResult = await pool.query(
      `SELECT p.id, p.title, pv.id as variant_id
       FROM product p
       JOIN product_variant pv ON pv.product_id = p.id
       WHERE p.status = 'published' AND LOWER(p.title) LIKE $1
       LIMIT 1`,
      [`%${searchTerm}%`]
    )

    if (!productResult.rows.length) {
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: `❌ Producto "${productQuery}" no encontrado. Productos disponibles:\n` +
          (await pool.query("SELECT title FROM product WHERE status = 'published' ORDER BY title"))
            .rows.map(r => `• ${r.title}`).join("\n"),
      })
      void logTelegramCommand({ command: "/venta", args: content, chat_id: chatId, result: "error", error_type: "product_not_found", error_message: `query=${productQuery}` })
      return
    }

    const product = productResult.rows[0]

    // Resolve warehouse
    const whResult = await pool.query(
      "SELECT id, name FROM stock_location WHERE LOWER(name) LIKE $1 AND deleted_at IS NULL LIMIT 1",
      [`%${warehouseName}%`]
    )

    if (!whResult.rows.length) {
      const allWh = await getStockLocations()
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: `❌ Almacén "${warehouseName}" no encontrado. Disponibles: ${allWh.map(w => w.name).join(", ")}`,
      })
      void logTelegramCommand({ command: "/venta", args: content, chat_id: chatId, result: "error", error_type: "warehouse_not_found", error_message: `query=${warehouseName}` })
      return
    }

    const warehouse = whResult.rows[0]

    // Get price
    const priceResult = await pool.query(
      `SELECT pr.amount FROM price pr
       JOIN price_set ps ON ps.id = pr.price_set_id
       JOIN product_variant_price_set pvps ON pvps.price_set_id = ps.id
       WHERE pvps.variant_id = $1
       LIMIT 1`,
      [product.variant_id]
    )
    const unitPrice = Number(priceResult.rows[0]?.amount || 0)

    // Parse client first/last name
    const nameParts = clientName.split(/\s+/)
    const firstName = nameParts[0] || "Cliente"
    const lastName = nameParts.slice(1).join(" ") || "Manual"

    // Region
    const regionResult = await pool.query("SELECT id, currency_code FROM region LIMIT 1")
    const region = regionResult.rows[0]

    // Find-or-create customer via Medusa Customer module
    const customerService = scope.resolve(Modules.CUSTOMER)
    const customerEmail = parsed.email
      || `manual+${clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@enrola.shop`

    let customer: { id: string; email: string } | null = null
    const existing = await customerService.listCustomers({ email: customerEmail }, { take: 1 })
    if (existing.length) {
      customer = existing[0]
    } else {
      customer = await customerService.createCustomers({
        email: customerEmail,
        first_name: firstName,
        last_name: lastName,
        phone: parsed.phone,
        metadata: parsed.cedula ? { cedula: parsed.cedula } : undefined,
      })
    }

    // Generate next display_id
    const maxIdResult = await pool.query('SELECT COALESCE(MAX(display_id), 0) + 1 as next_id FROM "order"')
    const nextDisplayId = maxIdResult.rows[0].next_id

    // Create the order (pending status — workflows below will progress it to completed)
    const orderId = `order_manual_${Date.now()}`
    await pool.query(
      `INSERT INTO "order" (id, display_id, region_id, currency_code, email, customer_id, status, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW(), NOW())`,
      [
        orderId,
        nextDisplayId,
        region.id,
        region.currency_code,
        customerEmail,
        customer!.id,
        JSON.stringify({
          manual_sale: true,
          client_name: clientName,
          warehouse: warehouse.name,
          cedula: parsed.cedula || undefined,
          attribution_utm_source: "telegram",
          attribution_utm_medium: "bot",
          attribution_utm_campaign: "manual_venta",
        }),
      ]
    )

    // Create shipping address (with phone if provided)
    const addrId = `addr_manual_${Date.now()}`
    await pool.query(
      `INSERT INTO order_address (id, customer_id, first_name, last_name, phone, city, country_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'Valencia', 've', NOW(), NOW())`,
      [addrId, customer!.id, firstName, lastName, parsed.phone || null]
    )
    await pool.query(
      `UPDATE "order" SET shipping_address_id = $1, billing_address_id = $1 WHERE id = $2`,
      [addrId, orderId]
    )

    // Create order line item
    const lineItemId = `oli_manual_${Date.now()}`
    await pool.query(
      `INSERT INTO order_line_item (id, title, unit_price, raw_unit_price, variant_id, product_id, product_title, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [lineItemId, product.title, unitPrice, JSON.stringify({ value: String(unitPrice), precision: 20 }), product.variant_id, product.id, product.title]
    )

    // Create order_item link (quantities that can later be fulfilled/shipped)
    const rawQty = JSON.stringify({ value: String(qty), precision: 20 })
    const rawUp = JSON.stringify({ value: String(unitPrice), precision: 20 })
    const rawZero = JSON.stringify({ value: "0", precision: 20 })
    await pool.query(
      `INSERT INTO order_item (
         id, order_id, item_id, quantity, raw_quantity, unit_price, raw_unit_price,
         fulfilled_quantity, raw_fulfilled_quantity,
         shipped_quantity, raw_shipped_quantity,
         return_requested_quantity, raw_return_requested_quantity,
         return_received_quantity, raw_return_received_quantity,
         return_dismissed_quantity, raw_return_dismissed_quantity,
         written_off_quantity, raw_written_off_quantity,
         version, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               0, $8, 0, $8, 0, $8, 0, $8, 0, $8, 0, $8,
               1, NOW(), NOW())`,
      [`oitem_manual_${Date.now()}`, orderId, lineItemId, qty, rawQty, unitPrice, rawUp, rawZero]
    )

    // Create order_summary
    const totalAmount = unitPrice * qty
    await pool.query(
      `INSERT INTO order_summary (id, order_id, totals, version, created_at, updated_at)
       VALUES ($1, $2, $3, 1, NOW(), NOW())`,
      [
        `osumm_manual_${Date.now()}`,
        orderId,
        JSON.stringify({
          original_order_total: totalAmount,
          current_order_total: totalAmount,
          paid_total: 0,
          transaction_total: 0,
          refunded_total: 0,
          accounting_total: totalAmount,
          pending_difference: totalAmount,
        }),
      ]
    )

    // --- Payment: create collection, authorize, capture via workflow ---
    const paymentService = scope.resolve(Modules.PAYMENT)
    const link = scope.resolve(ContainerRegistrationKeys.LINK)

    const paymentCollection = await paymentService.createPaymentCollections({
      amount: totalAmount,
      currency_code: region.currency_code,
    })

    // Link collection to order so the rest of the flow can discover it
    await link.create({
      [Modules.ORDER]: { order_id: orderId },
      [Modules.PAYMENT]: { payment_collection_id: paymentCollection.id },
    })

    const session = await paymentService.createPaymentSession(paymentCollection.id, {
      provider_id: "pp_system_default",
      amount: totalAmount,
      currency_code: region.currency_code,
      data: {},
    })

    const authorizedPayment = await paymentService.authorizePaymentSession(session.id, {})

    await capturePaymentWorkflow(scope).run({
      input: { payment_id: authorizedPayment.id },
    })

    // --- Inventory reservation (required by createOrderFulfillmentWorkflow) ---
    const invItemResult = await pool.query(
      `SELECT ii.id FROM inventory_item ii
       JOIN product_variant_inventory_item pvii ON pvii.inventory_item_id = ii.id
       WHERE pvii.variant_id = $1 LIMIT 1`,
      [product.variant_id]
    )
    const inventoryItemId = invItemResult.rows[0]?.id

    if (inventoryItemId) {
      const inventoryService = scope.resolve(Modules.INVENTORY)
      await inventoryService.createReservationItems([{
        inventory_item_id: inventoryItemId,
        location_id: warehouse.id,
        quantity: qty,
        line_item_id: lineItemId,
        description: `Manual sale #${nextDisplayId}`,
      }])
    }

    // --- Fulfillment: create + ship + deliver ---
    await createOrderFulfillmentWorkflow(scope).run({
      input: {
        order_id: orderId,
        location_id: warehouse.id,
        items: [{ id: lineItemId, quantity: qty }],
        metadata: { warehouse_name: warehouse.name, created_by: "telegram_venta" },
      },
    })

    const fulfillmentId = await getOrderFulfillmentId(orderId)
    if (fulfillmentId) {
      await createOrderShipmentWorkflow(scope).run({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input: { order_id: orderId, fulfillment_id: fulfillmentId } as any,
      })
      await pool.query(`UPDATE fulfillment SET delivered_at = NOW() WHERE id = $1`, [fulfillmentId])
    }

    await completeOrderWorkflow(scope).run({ input: { orderIds: [orderId] } })

    // Send confirmation
    const extraDetails = [
      parsed.cedula ? `🪪 ${parsed.cedula}` : null,
      parsed.phone ? `📱 ${parsed.phone}` : null,
      parsed.email ? `📧 ${parsed.email}` : null,
    ].filter(Boolean).join("\n")

    await tgApi("sendMessage", {
      chat_id: chatId,
      text: `✅ <b>Venta Manual #${nextDisplayId}</b>\n\n` +
        `📦 ${qty}× ${product.title}\n` +
        `💰 €${(totalAmount).toFixed(2)}\n` +
        `👤 ${clientName}\n` +
        (extraDetails ? extraDetails + "\n" : "") +
        `🏪 Almacén: ${warehouse.name}\n\n` +
        `Estado: Completada ✓\nPagado ✓  Enviado ✓  Entregado ✓`,
      parse_mode: "HTML",
    })

    console.log(`[telegram] Manual sale #${nextDisplayId}: ${qty}x ${product.title} for ${clientName} from ${warehouse.name}`)
    void logTelegramCommand({
      command: "/venta",
      args: content,
      chat_id: chatId,
      result: "ok",
    })

  } catch (err) {
    console.error("[telegram] /venta error:", err)
    await tgApi("sendMessage", {
      chat_id: chatId,
      text: `❌ Error procesando venta: ${(err as Error).message}`,
    })
    const msg = (err as Error).message || "unknown"
    void logTelegramCommand({
      command: "/venta",
      args: content,
      chat_id: chatId,
      result: "error",
      error_type: classifyVentaError(msg),
      error_message: msg,
    })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = req.body as Record<string, unknown>

    // Diagnostic: log chat info from any incoming update so we can capture
    // chat_ids of new groups the bot was added to.
    try {
      const message = (body.message || body.channel_post || body.my_chat_member) as Record<string, unknown> | undefined
      const chat = message?.chat as Record<string, unknown> | undefined
      if (chat?.id) {
        const text = (message?.text || "(non-text)") as string
        console.log(`[tg-chat-info] chat_id=${chat.id} type=${chat.type} title=${JSON.stringify(chat.title || "")} text=${JSON.stringify(String(text).substring(0, 80))}`)
      }
    } catch { /* fire-and-forget */ }

    const callback = body.callback_query as Record<string, unknown> | undefined
    if (callback) {
      const callbackId = String(callback.id || "")
      const data = String(callback.data || "")
      const msg = callback.message as Record<string, unknown> | undefined
      const chat = (msg?.chat || {}) as Record<string, unknown>
      const chatId = chat.id as string | number
      const messageId = msg?.message_id as number

      console.log(`[telegram-webhook] Callback: ${data}`)

      const [action, orderId, extra] = data.split(":")

      switch (action) {
        case "rv": case "review":
          await handleReviewPayment(orderId, chatId, messageId, callbackId)
          break
        case "ap": case "approve":
          await handleApprovePayment(orderId, chatId, messageId, callbackId, req.scope)
          break
        case "wh": case "warehouse":
          await handleWarehouseSelect(orderId, extra, chatId, messageId, callbackId, req.scope)
          break
        case "mr": case "mrw_request_receipt":
          await handleMrwReceiptRequest(orderId, chatId, messageId, callbackId)
          break
        case "sh": case "shipped":
          await handleShipped(orderId, chatId, messageId, callbackId, req.scope)
          break
        case "rc": case "received":
          await handleReceived(orderId, chatId, messageId, callbackId, req.scope)
          break
        case "hh":
          // Human handoff: data format = "hh:<agent_or_done>:<phone>"
          // - hh:damian:<phone>  / hh:floyd:<phone>  → start agent intervention
          // - hh:done:<phone>                        → finish, return to Dana
          await handleHumanHandoff(orderId, extra, chatId, messageId, callbackId)
          break
        default:
          await answerCallback(callbackId, "Acción no reconocida")
      }

      return res.status(200).json({ ok: true })
    }

    // Handle text messages (commands like /venta) AND photos for MRW receipts.
    const message = body.message as Record<string, unknown> | undefined
    if (message) {
      const text = String(message.text || "").trim()
      const chat = message.chat as Record<string, unknown>
      const chatId = chat?.id as string | number

      if (text.startsWith("/venta")) {
        await handleVentaCommand(text, chatId, req.scope)
        return res.status(200).json({ ok: true })
      }

      // ── MRW receipt photo handler ─────────────────────────────────────────
      // If this chat has a pending MRW receipt request and the message is a
      // photo, claim it for the pending order, persist the image, decode the
      // QR code on the MRW label to extract the tracking number, and update
      // the original Telegram message with the "🚚 Pedido Salió" button.
      const photo = message.photo as Array<{ file_id: string; file_size?: number; width?: number; height?: number }> | undefined
      if (Array.isArray(photo) && photo.length > 0) {
        const pending = await getMrwPending(chatId)
        if (pending) {
          // Pick highest-resolution photo (last in array per Telegram convention)
          const bestPhoto = photo[photo.length - 1]
          const dl = await downloadTelegramPhoto(bestPhoto.file_id, pending.order_id)
          if (dl) {
            const { url, buffer } = dl

            // Decode QR from the receipt photo to extract the MRW tracking
            // number. Best-effort: photos that miss the QR or are too blurry
            // just don't get a tracking number stored — the operator can still
            // ship the order normally and we'll add the number later from the
            // order's admin widget.
            let trackingNumber: string | null = null
            try {
              const { decodeQrFromImage } = await import("../../../lib/qr-decoder.js")
              const decoded = await decodeQrFromImage(buffer)
              if (decoded?.trackingNumber) {
                trackingNumber = decoded.trackingNumber
                console.log(`[telegram-mrw] QR decoded: tracking=${trackingNumber} (raw="${decoded.text.slice(0, 80)}")`)
              } else {
                console.warn("[telegram-mrw] QR not found in receipt — operator will need to add tracking number manually")
              }
            } catch (err) {
              console.error("[telegram-mrw] QR decode error:", (err as Error).message)
            }

            // Persist receipt URL + tracking number in order metadata. We
            // bundle both in the same UPDATE so handleShipped picks up the
            // url AND any subsequent admin widget can read the tracking.
            // mrw_tracking_status starts at "submitted" — operator marks
            // "arrived"/"delivered" via the admin order widget.
            const trackingFields = trackingNumber
              ? `, 'mrw_tracking_number', $3::text, 'mrw_tracking_status', 'submitted'::text, 'mrw_tracking_started_at', NOW()::text`
              : ""
            await pool.query(
              `UPDATE "order"
               SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                 'mrw_receipt_url', $1::text,
                 'mrw_receipt_uploaded_at', NOW()::text${trackingFields}
               )
               WHERE id = $2`,
              trackingNumber ? [url, pending.order_id, trackingNumber] : [url, pending.order_id]
            )
            await clearMrwPending(chatId)

            // Update the original "ESPERANDO COMPROBANTE MRW" message to enable the
            // "🚚 Pedido Salió" button now that we have the image.
            const fullOrderId = pending.order_id
            const order = await getOrderDetails(fullOrderId)
            const items = await getOrderItems(fullOrderId)
            const details = order ? await buildOrderDetailBlock(order, items) : ""
            const trackingDisplay = trackingNumber
              ? `\n🎫 <b>Guía detectada:</b> <code>${trackingNumber}</code>`
              : `\n⚠️ <i>QR no se pudo leer — agregar # de guía manualmente desde el admin si querés rastreo.</i>`
            await editMessage(
              chatId,
              pending.message_id,
              `📦 Pedido #${pending.display_id} — COMPROBANTE MRW LISTO${details}\n\n` +
                `🧾 Comprobante: <a href="${url}">Ver imagen</a>${trackingDisplay}\n\n` +
                `Cuando confirmes que sale, presiona <b>🚚 Pedido Salió</b> — el cliente recibirá el comprobante por WhatsApp y email.`,
              [[{ text: "🚚 Pedido Salió", callback_data: `sh:${pending.display_id}` }]]
            )

            // Quick ack in the chat so operator knows the photo was claimed
            const ackTracking = trackingNumber ? ` (guía ${trackingNumber})` : ""
            await tgApi("sendMessage", {
              chat_id: chatId,
              text: `✅ Comprobante recibido para pedido #${pending.display_id}${ackTracking}. Presiona 🚚 Pedido Salió arriba para notificar al cliente.`,
              reply_to_message_id: message.message_id,
            })
            return res.status(200).json({ ok: true, claimed: pending.display_id, tracking: trackingNumber })
          }
          // If download failed, tell operator
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: `⚠️ No pude descargar la foto para pedido #${pending.display_id}. Reenvíala, por favor.`,
            reply_to_message_id: message.message_id,
          })
          return res.status(200).json({ ok: false, reason: "download_failed" })
        }
        // No pending receipt → ignore the photo silently
      }
    }

    return res.status(200).json({ ok: true, skipped: "not handled" })
  } catch (err) {
    console.error("[telegram-webhook] Error:", err)
    return res.status(200).json({ ok: false })
  }
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.status(200).json({ status: "ok", handler: "telegram-webhook" })
}
