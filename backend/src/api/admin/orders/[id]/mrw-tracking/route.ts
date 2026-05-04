/**
 * MRW shipment tracking — admin actions on an order.
 *
 * One endpoint, multiple actions selected by the `action` field. Keeps the
 * admin widget simple (one fetch URL, one Bearer auth, one error handler):
 *
 *   POST /admin/orders/:id/mrw-tracking  { action: "set_tracking", trackingNumber, agency? }
 *     → set/overwrite the tracking number (used when QR auto-decode failed
 *       and the operator types it manually)
 *
 *   POST /admin/orders/:id/mrw-tracking  { action: "mark_arrived" }
 *     → mark the package as arrived at destination office and notify the
 *       customer via WhatsApp + email. Idempotent: if already notified, the
 *       second call is a no-op (returns ok=true with notified=false).
 *
 *   POST /admin/orders/:id/mrw-tracking  { action: "mark_delivered" }
 *     → mark the package as picked up by the customer, send the thank-you
 *       message, and complete the Medusa order. Idempotent.
 *
 * The handler keeps `order.metadata` as the single source of truth — there
 * is no separate tracking table because (1) the data is sparse, (2) order
 * metadata is already where shipping_type / mrw_receipt_url live, and (3)
 * the admin widget reads metadata directly from the order GET.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { completeOrderWorkflow } from "@medusajs/medusa/core-flows"
import { Pool } from "pg"
import {
  notifyMrwArrived,
  notifyMrwDelivered,
} from "../../../../../lib/notifications/mrw-tracking"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

type Action = "set_tracking" | "mark_arrived" | "mark_delivered"

type RequestBody = {
  action: Action
  trackingNumber?: string
  agency?: string | null
}

async function readMetadata(orderId: string): Promise<Record<string, unknown>> {
  const r = await pool.query(`SELECT metadata FROM "order" WHERE id = $1`, [orderId])
  return (r.rows[0]?.metadata as Record<string, unknown> | null) ?? {}
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id as string
  if (!orderId) {
    return res.status(400).json({ error: "Missing order id" })
  }

  const body = (req.body || {}) as RequestBody
  const action = body.action

  try {
    if (action === "set_tracking") {
      const tracking = (body.trackingNumber || "").trim()
      const agency = (body.agency || "").trim() || null
      if (!tracking || !/^\d{8,16}$/.test(tracking)) {
        return res.status(400).json({ error: "Invalid tracking number — must be 8 to 16 digits" })
      }
      const meta = await readMetadata(orderId)
      const existingStatus = (meta.mrw_tracking_status as string | undefined) || "submitted"
      // Only reset to "submitted" if there wasn't already a status set (e.g.
      // operator could be correcting a mistyped tracking number after the
      // package arrived — keep the arrived/delivered status intact).
      const status = existingStatus === "submitted" ? "submitted" : existingStatus
      const fields: Record<string, unknown> = {
        mrw_tracking_number: tracking,
        mrw_tracking_status: status,
        mrw_tracking_started_at: meta.mrw_tracking_started_at || new Date().toISOString(),
      }
      if (agency) fields.mrw_destination_agency = agency
      await pool.query(
        `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify(fields), orderId]
      )
      return res.json({ ok: true, action, trackingNumber: tracking, agency })
    }

    if (action === "mark_arrived") {
      const meta = await readMetadata(orderId)
      // Idempotency: don't re-send if we already notified
      if (meta.mrw_arrived_notified_at) {
        return res.json({
          ok: true,
          action,
          notified: false,
          reason: "already_notified",
          notified_at: meta.mrw_arrived_notified_at,
        })
      }
      const outcome = await notifyMrwArrived(orderId)
      // Persist state — even if both channels failed, mark the status so the
      // widget reflects operator intent. Operator can re-trigger via a
      // "re-send" action (not implemented here yet) or by clearing the flag.
      await pool.query(
        `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'mrw_tracking_status', 'arrived_at_destination'::text,
           'mrw_arrived_at', NOW()::text,
           'mrw_arrived_notified_at', NOW()::text,
           'mrw_arrived_notif_whatsapp', $1::boolean,
           'mrw_arrived_notif_email', $2::boolean
         ) WHERE id = $3`,
        [outcome.whatsapp, outcome.email, orderId]
      )
      return res.json({ ok: true, action, notified: true, outcome })
    }

    if (action === "mark_delivered") {
      const meta = await readMetadata(orderId)
      if (meta.mrw_delivered_notified_at) {
        return res.json({
          ok: true,
          action,
          notified: false,
          reason: "already_notified",
          notified_at: meta.mrw_delivered_notified_at,
        })
      }
      const outcome = await notifyMrwDelivered(orderId)

      // Update metadata first so the widget reflects state immediately
      await pool.query(
        `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'mrw_tracking_status', 'delivered'::text,
           'mrw_delivered_at', NOW()::text,
           'mrw_delivered_notified_at', NOW()::text,
           'mrw_delivered_notif_whatsapp', $1::boolean,
           'mrw_delivered_notif_email', $2::boolean
         ) WHERE id = $3`,
        [outcome.whatsapp, outcome.email, orderId]
      )

      // Best-effort: complete the Medusa order. This is what closes the
      // workflow loop and makes the order disappear from the "active" list.
      // Failure here is not fatal — operator can manually complete from the
      // standard order admin if needed.
      try {
        await completeOrderWorkflow(req.scope).run({
          input: { orderIds: [orderId] },
        })
      } catch (err) {
        console.warn(
          `[mrw-tracking] completeOrderWorkflow failed for ${orderId}:`,
          (err as Error).message
        )
      }

      return res.json({ ok: true, action, notified: true, outcome })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error("[mrw-tracking] error:", err)
    return res.status(500).json({ error: (err as Error).message })
  }
}
