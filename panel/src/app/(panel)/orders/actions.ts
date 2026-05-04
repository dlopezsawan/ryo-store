"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import {
  createDraftOrder, retrieveOrder, markPaymentPaid, cancelOrder,
  MedusaError,
} from "@/lib/medusa"

type ActionResult = { ok: true; data?: { id: string; display_id: number } } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    if (e.status === 422 || e.status === 400) {
      const d = e.details as { message?: string } | undefined
      return d?.message ?? `Datos inválidos (${e.status})`
    }
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function createDraftOrderAction(input: {
  email: string
  region_id: string
  sales_channel_id?: string
  currency_code?: string
  items: Array<{ title: string; quantity: number; unit_price: number; variant_id?: string }>
}): Promise<ActionResult> {
  try {
    const email = input.email.trim().toLowerCase()
    if (!email || !email.includes("@")) return { ok: false, error: "Email del cliente inválido" }
    if (!input.region_id) return { ok: false, error: "Región es requerida" }
    const items = input.items.filter((i) => i.title.trim() && i.quantity > 0 && i.unit_price >= 0)
    if (items.length === 0) return { ok: false, error: "Añade al menos una línea con título y cantidad" }

    const res = await createDraftOrder({
      email,
      region_id: input.region_id,
      sales_channel_id: input.sales_channel_id,
      currency_code: input.currency_code,
      items: items.map((i) => ({
        title: i.title.trim(),
        quantity: i.quantity,
        unit_price: i.unit_price,
        variant_id: i.variant_id,
      })),
    })
    revalidatePath("/orders")
    return { ok: true, data: res.draft_order }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function gotoOrderAction(id: string): Promise<never> {
  redirect(`/orders/${id}`)
}

// ─── Bulk actions ────────────────────────────────────────────────────

export interface BulkResult {
  ok: number
  failed: Array<{ id: string; error: string }>
}

/**
 * Captura el pago de múltiples órdenes en paralelo. Devuelve count de
 * éxitos + lista de fallos por id. No transaccional — si una falla, las
 * demás siguen.
 */
export async function bulkCapturePaymentsAction(orderIds: string[]): Promise<BulkResult> {
  const results = await Promise.allSettled(
    orderIds.map(async (id) => {
      const { order } = await retrieveOrder(id)
      const collection = order.payment_collections?.[0]
      if (!collection) throw new Error("sin payment collection")
      if (collection.status === "captured" || collection.status === "authorized") {
        throw new Error(`ya estaba ${collection.status}`)
      }
      await markPaymentPaid(collection.id, id)
    }),
  )
  const failed: BulkResult["failed"] = []
  let ok = 0
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok += 1
    else failed.push({ id: orderIds[i], error: r.reason instanceof Error ? r.reason.message : "error" })
  })
  if (ok > 0) {
    revalidatePath("/orders")
    for (const id of orderIds) revalidatePath(`/orders/${id}`)
  }
  return { ok, failed }
}

export async function bulkCancelOrdersAction(orderIds: string[]): Promise<BulkResult> {
  const results = await Promise.allSettled(orderIds.map((id) => cancelOrder(id)))
  const failed: BulkResult["failed"] = []
  let ok = 0
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok += 1
    else {
      const e = r.reason
      const msg = e instanceof MedusaError ? e.message : (e instanceof Error ? e.message : "error")
      failed.push({ id: orderIds[i], error: msg })
    }
  })
  if (ok > 0) {
    revalidatePath("/orders")
    for (const id of orderIds) revalidatePath(`/orders/${id}`)
  }
  return { ok, failed }
}
