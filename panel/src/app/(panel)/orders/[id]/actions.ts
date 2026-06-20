"use server"

import { revalidatePath } from "next/cache"
import {
  createFulfillment,
  cancelOrder,
  markPaymentPaid,
  refundPayment,
  retrieveOrder,
  shipFulfillment,
  markFulfillmentDelivered,
  completeOrder,
  createReturn,
  receiveReturn,
  cancelReturn,
  createExchange,
  createClaim,
  updateOrder,
  addOrderLineItem,
  updateOrderLineItem,
  deleteOrderLineItem,
  type ClaimType,
  MedusaError,
} from "@/lib/medusa"
import { getSession } from "@/lib/auth"
import { sendEmail, defaultFromAddress, isConfigured as isResendConfigured, ResendError, ResendNotConfigured } from "@/lib/resend"

/**
 * Server Actions para mutaciones de pedidos. Llamadas desde el client
 * component <OrderActions />.
 *
 * Patrón:
 *   1. Hacer la mutación contra Medusa
 *   2. revalidatePath(`/orders/[id]`) para que el server re-renderice con
 *      el estado fresco
 *   3. Devolver { ok: true } o { ok: false, error: string }
 *
 * Cada acción tiene try/catch específico — si Medusa devuelve 401 lo
 * convertimos en un mensaje claro para que el cliente sepa que expiró
 * la sesión.
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada. Recarga e inicia sesión de nuevo."
    if (e.status === 403) return "Sin permisos para esta acción."
    if (e.details && typeof e.details === "object" && "message" in e.details) {
      return String((e.details as { message: unknown }).message)
    }
    return `Error ${e.status}: ${e.message}`
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

/**
 * Marcar TODOS los items pendientes del order como fulfillados.
 * En Medusa v2 hay que pasar la lista de items con sus quantities,
 * que sacamos del retrieveOrder primero.
 */
export async function markFulfilledAction(orderId: string): Promise<ActionResult> {
  try {
    const { order } = await retrieveOrder(orderId)
    const items = order.items
      .filter((it) => it.quantity > 0)
      .map((it) => ({ id: it.id, quantity: it.quantity }))
    if (items.length === 0) {
      return { ok: false, error: "No hay items para enviar" }
    }
    await createFulfillment(orderId, items)
    revalidatePath(`/orders/${orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/** Capturar pago manualmente (caso típico: Pago Móvil confirmado). */
export async function capturePaymentAction(orderId: string): Promise<ActionResult> {
  try {
    const { order } = await retrieveOrder(orderId)
    const collection = order.payment_collections?.[0]
    if (!collection) {
      return { ok: false, error: "Esta orden no tiene payment collection" }
    }
    if (collection.status === "authorized" || collection.status === "captured") {
      return { ok: false, error: `El pago ya está en estado: ${collection.status}` }
    }
    await markPaymentPaid(collection.id, orderId)
    revalidatePath(`/orders/${orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/**
 * Marcar un fulfillment específico como entregado al cliente.
 * Medusa cambia fulfillment_status → delivered. Si todos los fulfillments
 * de la orden están delivered, los reportes lo reflejan.
 */
export async function markDeliveredAction(orderId: string, fulfillmentId?: string): Promise<ActionResult> {
  try {
    let fulfId = fulfillmentId
    if (!fulfId) {
      // Auto: agarrar el primer fulfillment shipped/fulfilled no delivered
      const { order } = await retrieveOrder(orderId)
      const target = (order.fulfillments ?? []).find((f) => {
        const fAny = f as { delivered_at?: string | null; canceled_at?: string | null }
        return !fAny.delivered_at && !fAny.canceled_at
      })
      if (!target) return { ok: false, error: "No hay fulfillments pendientes de entrega" }
      fulfId = target.id
    }
    await markFulfillmentDelivered({ orderId, fulfillmentId: fulfId })
    revalidatePath(`/orders/${orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/**
 * Completar/cerrar la orden. Solo posible si todos los fulfillments están
 * delivered o canceled. Marca status=completed.
 */
export async function completeOrderAction(orderId: string): Promise<ActionResult> {
  try {
    await completeOrder(orderId)
    revalidatePath(`/orders/${orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/** Cancelar la orden. Acción destructiva — el cliente debe pedir confirm. */
export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  try {
    await cancelOrder(orderId)
    revalidatePath(`/orders/${orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/**
 * Refund completo de la orden. Toma el primer payment_id del payment_collection
 * y lo refundea por el monto total de la orden.
 *
 * Para refunds parciales / por línea, en futuro batch añadimos una UI
 * más rica. Esto cubre el caso 95%: "este pedido se canceló, devuelve todo".
 */
export async function refundOrderAction(
  orderId: string,
  noteOrAmount?: string | { amount?: number; note?: string },
): Promise<ActionResult> {
  try {
    const { order } = await retrieveOrder(orderId)
    const collection = order.payment_collections?.[0]
    const payment = collection?.payments?.[0]
    if (!payment) {
      return { ok: false, error: "Esta orden no tiene un pago capturado para refundir" }
    }
    // Compatibilidad con la API anterior: si recibe string, es la nota.
    const args = typeof noteOrAmount === "string"
      ? { note: noteOrAmount, amount: undefined }
      : { note: noteOrAmount?.note, amount: noteOrAmount?.amount }

    const totalPaid = Number(payment.amount) || 0
    const amount = args.amount ?? totalPaid
    if (amount <= 0) return { ok: false, error: "Monto a reembolsar debe ser > 0" }
    if (amount > totalPaid) {
      return { ok: false, error: `Monto excede el pago original (max ${totalPaid})` }
    }

    await refundPayment({
      orderId,
      paymentId: payment.id,
      amount,
      note: args.note,
    })
    revalidatePath(`/orders/${orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/**
 * Marca un fulfillment como enviado, registrando los tracking labels.
 * Se requiere número de tracking no vacío para evitar que un pedido
 * quede marcado como enviado sin información de rastreo para el cliente.
 * Si el envío genuinamente no tiene tracking (mensajero local, etc.),
 * pasa trackingNumber="SIN-TRACKING" y la nota queda en el label.
 */
export async function addTrackingAction(args: {
  orderId: string
  fulfillmentId: string
  trackingNumber: string
  trackingUrl?: string
}): Promise<ActionResult> {
  try {
    const trackingNumber = args.trackingNumber.trim()
    if (!trackingNumber) {
      return {
        ok: false,
        error: "Número de tracking requerido. Si no hay tracking, usa 'SIN-TRACKING' como valor.",
      }
    }
    const labels = [{
      tracking_number: trackingNumber,
      tracking_url: args.trackingUrl?.trim() || undefined,
    }]
    await shipFulfillment({
      orderId: args.orderId,
      fulfillmentId: args.fulfillmentId,
      labels,
    })
    revalidatePath(`/orders/${args.orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/**
 * Crea un retorno para una lista de items con cantidades.
 * Si refundAmount > 0, intenta también el reembolso por ese monto en el
 * mismo paso (Medusa v2 acepta el campo `refund` opcional).
 */
export async function createReturnAction(args: {
  orderId: string
  items: Array<{ id: string; quantity: number }>
  refundAmount?: number
  note?: string
}): Promise<ActionResult> {
  try {
    const items = args.items.filter((i) => i.quantity > 0)
    if (items.length === 0) {
      return { ok: false, error: "Selecciona al menos un item para devolver" }
    }
    await createReturn({
      orderId: args.orderId,
      items,
      refund:
        args.refundAmount && args.refundAmount > 0
          ? { amount: args.refundAmount, note: args.note }
          : null,
    })
    revalidatePath(`/orders/${args.orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/**
 * Envía un email transaccional al cliente del pedido vía Resend.
 * Etiqueta el email con order_id para tracking en Resend.
 */
export async function sendOrderEmailAction(args: {
  orderId: string
  to: string
  subject: string
  body: string
}): Promise<ActionResult> {
  try {
    if (!isResendConfigured()) {
      return { ok: false, error: "RESEND_API_KEY no está configurado en el panel" }
    }
    if (!args.to.trim() || !args.to.includes("@")) {
      return { ok: false, error: "Email del destinatario inválido" }
    }
    if (!args.subject.trim()) return { ok: false, error: "Asunto requerido" }
    if (!args.body.trim()) return { ok: false, error: "Cuerpo del mensaje vacío" }

    const looksHtml = /<[a-z][\s\S]*>/i.test(args.body)
    const html = looksHtml
      ? args.body
      : `<div style="font-family: system-ui, sans-serif; line-height: 1.6;">${args.body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br />")}</div>`
    const text = looksHtml ? args.body.replace(/<[^>]+>/g, "") : args.body

    await sendEmail({
      from: defaultFromAddress(),
      to: args.to.trim(),
      subject: args.subject.trim(),
      html,
      text,
      tags: [
        { name: "source", value: "panel-order" },
        { name: "order_id", value: args.orderId },
      ],
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof ResendNotConfigured) {
      return { ok: false, error: "RESEND_API_KEY no configurado" }
    }
    if (e instanceof ResendError) {
      const d = e.details as { message?: string } | undefined
      return { ok: false, error: d?.message ?? `Resend ${e.status}: ${e.message}` }
    }
    return { ok: false, error: toError(e) }
  }
}

// ─── Returns: receive + cancel ───────────────────────────────────────

export async function receiveReturnAction(args: {
  orderId: string
  returnId: string
  items: Array<{ id: string; quantity: number }>
}): Promise<ActionResult> {
  try {
    if (args.items.length === 0) {
      return { ok: false, error: "Selecciona qué items se recibieron" }
    }
    await receiveReturn({ returnId: args.returnId, items: args.items })
    revalidatePath(`/orders/${args.orderId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function cancelReturnAction(args: {
  orderId: string
  returnId: string
}): Promise<ActionResult> {
  try {
    await cancelReturn(args.returnId)
    revalidatePath(`/orders/${args.orderId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Exchanges ───────────────────────────────────────────────────────

export async function createExchangeAction(args: {
  orderId: string
  return_items: Array<{ id: string; quantity: number; note?: string }>
  additional_items: Array<{ variant_id: string; quantity: number; unit_price?: number }>
  difference_due?: number
}): Promise<ActionResult> {
  try {
    if (args.return_items.length === 0) {
      return { ok: false, error: "Especifica qué items se devuelven" }
    }
    if (args.additional_items.length === 0) {
      return { ok: false, error: "Especifica qué items recibe a cambio" }
    }
    await createExchange({
      orderId: args.orderId,
      return_items: args.return_items,
      additional_items: args.additional_items,
      difference_due: args.difference_due,
    })
    revalidatePath(`/orders/${args.orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Claims (item dañado/incorrecto) ─────────────────────────────────

export async function createClaimAction(args: {
  orderId: string
  type: ClaimType
  claim_items: Array<{
    id: string
    quantity: number
    reason: "missing_item" | "wrong_item" | "production_failure" | "other"
    note?: string
  }>
  additional_items?: Array<{ variant_id: string; quantity: number }>
  refund_amount?: number
}): Promise<ActionResult> {
  try {
    if (args.claim_items.length === 0) {
      return { ok: false, error: "Selecciona los items afectados" }
    }
    if (args.type === "replace" && (!args.additional_items || args.additional_items.length === 0)) {
      return { ok: false, error: "Para replace debes especificar items de reemplazo" }
    }
    await createClaim({
      orderId: args.orderId,
      type: args.type,
      claim_items: args.claim_items,
      additional_items: args.additional_items,
      refund_amount: args.refund_amount,
    })
    revalidatePath(`/orders/${args.orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Notes (internal comments via order.metadata.notes) ───────────────

export interface OrderNote {
  id: string
  text: string
  author: string
  created_at: string
}

/**
 * Las notas viven en `order.metadata.notes` como array de objetos. Cada
 * actualización lee → mergea → escribe el array completo (Medusa metadata
 * es un blob JSON, no soporta JSON-patch).
 *
 * RIESGO RESIDUAL: hay una ventana de race read-modify-write inherente al
 * modelo de Medusa (metadata es un blob opaco, no existe JSON-patch ni
 * OCC). Mitigación: re-leemos el order justo antes del write para minimizar
 * la ventana. Con tráfico normal (operadores humanos) es suficiente. Si en
 * el futuro el volumen de notas concurrentes sube, migrar a una entidad
 * dedicada o usar un mutex externo (Redis SETNX).
 */
export async function addOrderNoteAction(orderId: string, text: string): Promise<ActionResult> {
  try {
    const trimmed = text.trim()
    if (!trimmed) return { ok: false, error: "Nota vacía" }
    const session = await getSession()
    const author = session?.email ?? "anónimo"

    const note: OrderNote = {
      id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      text: trimmed,
      author,
      created_at: new Date().toISOString(),
    }

    // Re-leemos inmediatamente antes del write para minimizar la ventana de
    // race (last-write-wins). Otro agente que escriba entre este retrieve y
    // el updateOrder de abajo todavía puede sobrescribir, pero la probabilidad
    // se reduce al mínimo práctico sin un mecanismo de locking externo.
    const { order: freshOrder } = await retrieveOrder(orderId)
    const existing: OrderNote[] = Array.isArray(freshOrder.metadata?.notes)
      ? (freshOrder.metadata!.notes as OrderNote[])
      : []
    const next = [...existing, note]
    await updateOrder(orderId, {
      metadata: { ...(freshOrder.metadata ?? {}), notes: next },
    })
    revalidatePath(`/orders/${orderId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateOrderInfoAction(orderId: string, patch: {
  email?: string
  shipping_address?: {
    first_name?: string
    last_name?: string
    address_1?: string
    city?: string
    province?: string
    postal_code?: string
    country_code?: string
    phone?: string
  }
}): Promise<ActionResult> {
  try {
    const body: Parameters<typeof updateOrder>[1] = {}
    if (patch.email !== undefined) {
      const e = patch.email.trim().toLowerCase()
      if (!e || !e.includes("@")) return { ok: false, error: "Email inválido" }
      body.email = e
    }
    if (patch.shipping_address) body.shipping_address = patch.shipping_address
    if (Object.keys(body).length === 0) return { ok: true }
    await updateOrder(orderId, body)
    revalidatePath(`/orders/${orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteOrderNoteAction(orderId: string, noteId: string): Promise<ActionResult> {
  try {
    const { order } = await retrieveOrder(orderId)
    const existing: OrderNote[] = Array.isArray(order.metadata?.notes)
      ? (order.metadata!.notes as OrderNote[])
      : []
    const next = existing.filter((n) => n.id !== noteId)
    await updateOrder(orderId, {
      metadata: { ...(order.metadata ?? {}), notes: next },
    })
    revalidatePath(`/orders/${orderId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Line items: add / update / delete ───────────────────────────────

export async function addLineItemAction(args: {
  orderId: string
  title: string
  quantity: number
  unit_price: number
  variant_id?: string
}): Promise<ActionResult> {
  try {
    if (!args.title.trim()) return { ok: false, error: "Título requerido" }
    if (args.quantity <= 0) return { ok: false, error: "Cantidad debe ser > 0" }
    if (args.unit_price < 0) return { ok: false, error: "Precio inválido" }
    await addOrderLineItem(args.orderId, {
      title: args.title.trim(),
      quantity: args.quantity,
      unit_price: args.unit_price,
      variant_id: args.variant_id,
    })
    revalidatePath(`/orders/${args.orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateLineItemAction(args: {
  orderId: string
  lineItemId: string
  quantity?: number
  unit_price?: number
  title?: string
}): Promise<ActionResult> {
  try {
    const body: Parameters<typeof updateOrderLineItem>[2] = {}
    if (args.quantity !== undefined) {
      if (args.quantity <= 0) return { ok: false, error: "Cantidad debe ser > 0" }
      body.quantity = args.quantity
    }
    if (args.unit_price !== undefined) {
      if (args.unit_price < 0) return { ok: false, error: "Precio inválido" }
      body.unit_price = args.unit_price
    }
    if (args.title !== undefined) body.title = args.title.trim()
    if (Object.keys(body).length === 0) return { ok: true }
    await updateOrderLineItem(args.orderId, args.lineItemId, body)
    revalidatePath(`/orders/${args.orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteLineItemAction(args: {
  orderId: string
  lineItemId: string
}): Promise<ActionResult> {
  try {
    await deleteOrderLineItem(args.orderId, args.lineItemId)
    revalidatePath(`/orders/${args.orderId}`)
    revalidatePath(`/orders`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
