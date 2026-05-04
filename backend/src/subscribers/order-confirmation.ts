import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Pool } from "pg"
import { sendEmail, orderConfirmationEmailHtml } from "../lib/email-service"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function orderConfirmationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    // Use direct SQL to get order with correct totals (prices stored in plain units, not cents)
    const result = await pool.query(`
      SELECT
        o.id,
        o.display_id,
        o.email,
        o.status,
        sa.first_name AS ship_first,
        sa.last_name  AS ship_last,
        COALESCE((os.totals->>'original_order_total')::numeric, 0) AS total,
        COALESCE((os.totals->>'shipping_total')::numeric, 0)       AS shipping_total
      FROM "order" o
      LEFT JOIN LATERAL (
        SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) os ON true
      LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
      WHERE o.id = $1
    `, [data.id])

    const order = result.rows[0]
    if (!order) {
      console.warn("[order-confirmation] Order not found:", data.id)
      return
    }

    // Fetch items + total adjustments per line (line_item_adjustment includes
    // combo/wholesale discounts applied via /store/carts/:id/recalculate-combos
    // plus any external coupons like ENROLAWELCOME).
    const itemsResult = await pool.query(`
      SELECT DISTINCT ON (li.id)
        li.id,
        li.title,
        oi.quantity,
        oi.unit_price,
        COALESCE((
          SELECT SUM(amount) FROM order_line_item_adjustment
          WHERE item_id = li.id AND deleted_at IS NULL
        ), 0) AS line_discount,
        (
          SELECT string_agg(DISTINCT code, ',') FROM order_line_item_adjustment
          WHERE item_id = li.id AND deleted_at IS NULL AND code IS NOT NULL
        ) AS adjustment_codes
      FROM order_item oi
      JOIN order_line_item li ON li.id = oi.item_id
      WHERE oi.order_id = $1 AND oi.deleted_at IS NULL
      ORDER BY li.id, oi.version DESC
    `, [data.id])

    // Fetch customer name/email
    const customerResult = await pool.query(`
      SELECT c.first_name, c.last_name, c.email
      FROM "order" o
      LEFT JOIN customer c ON c.id = o.customer_id
      WHERE o.id = $1
    `, [data.id])

    const customer = customerResult.rows[0]
    const firstName = customer?.first_name || order.ship_first || "Cliente"
    const lastName  = customer?.last_name  || order.ship_last  || ""
    const customerName = `${firstName} ${lastName}`.trim()
    const email = customer?.email || order.email

    if (!email) {
      console.warn("[order-confirmation] No email for order", data.id)
      return
    }

    const orderNumber = String(order.display_id || data.id.slice(-6).toUpperCase())

    // Compute subtotal (bruto) y discount total leyendo line adjustments.
    // Source-of-truth: order_line_item_adjustment.amount (positive = descuento).
    const itemRows = itemsResult.rows as Array<{
      id: string; title: string; quantity: number; unit_price: number;
      line_discount: number | string; adjustment_codes: string | null
    }>
    const subtotal = itemRows.reduce(
      (s, r) => s + Number(r.unit_price) * Number(r.quantity), 0
    )
    const discountTotal = itemRows.reduce(
      (s, r) => s + (Number(r.line_discount) || 0), 0
    )

    // Etiqueta del descuento dominante para mostrar al cliente
    const allCodes = itemRows
      .map((r) => r.adjustment_codes || "")
      .join(",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const codeSet = new Set(allCodes)
    let discountLabel: string | null = null
    if (codeSet.has("WHOLESALE30")) discountLabel = "30% Mayorista"
    else if (codeSet.has("COMBO20")) discountLabel = "Combo 20% · 10+ productos distintos"
    else if (codeSet.has("COMBO15")) discountLabel = "Combo 15% · 5+ productos distintos"
    else if (codeSet.has("COMBO10")) discountLabel = "Combo 10% · 3+ productos distintos"
    else if (codeSet.size > 0) discountLabel = Array.from(codeSet).join(" · ")

    const html = orderConfirmationEmailHtml(
      customerName,
      orderNumber,
      itemRows.map((r) => ({
        title: r.title,
        quantity: r.quantity,
        unit_price: r.unit_price,
      })),
      subtotal,
      Number(order.shipping_total),
      Number(order.total),
      discountTotal,
      discountLabel
    )

    const sent = await sendEmail({
      to: email,
      subject: `✅ Pedido #${orderNumber} confirmado — Club Enrola`,
      html,
    })

    if (sent) {
      console.log(`[order-confirmation] ✅ Email sent to ${email} for order #${orderNumber}`)
    }
  } catch (err) {
    console.error("[order-confirmation] Error:", err)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
