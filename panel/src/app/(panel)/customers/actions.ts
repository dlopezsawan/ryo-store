"use server"

import { revalidatePath } from "next/cache"
import { createCustomer, deleteCustomer, addCustomersToGroup, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true; data?: { id: string } } | { ok: false; error: string }

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

export async function createCustomerAction(input: {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  cedula?: string
}): Promise<ActionResult> {
  try {
    const email = input.email.trim().toLowerCase()
    if (!email || !email.includes("@")) return { ok: false, error: "Email inválido" }
    const metadata: Record<string, unknown> = {}
    if (input.cedula?.trim()) metadata.cedula = input.cedula.trim()

    const res = await createCustomer({
      email,
      first_name: input.first_name?.trim() || undefined,
      last_name: input.last_name?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    })
    revalidatePath("/customers")
    return { ok: true, data: { id: res.customer.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Bulk actions ────────────────────────────────────────────────────

export interface BulkResult {
  ok: number
  failed: Array<{ id: string; error: string }>
}

export async function bulkAddToGroupAction(
  customerIds: string[],
  groupId: string,
): Promise<BulkResult> {
  try {
    if (customerIds.length === 0) return { ok: 0, failed: [] }
    if (!groupId) return { ok: 0, failed: customerIds.map((id) => ({ id, error: "groupId requerido" })) }
    // addCustomersToGroup acepta array completo en una sola call
    await addCustomersToGroup(groupId, customerIds)
    revalidatePath("/customers")
    revalidatePath("/customer-groups")
    return { ok: customerIds.length, failed: [] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error"
    return { ok: 0, failed: customerIds.map((id) => ({ id, error: msg })) }
  }
}

export async function bulkDeleteCustomersAction(
  customerIds: string[],
): Promise<BulkResult> {
  const results = await Promise.allSettled(customerIds.map((id) => deleteCustomer(id)))
  const failed: BulkResult["failed"] = []
  let ok = 0
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok += 1
    else failed.push({
      id: customerIds[i],
      error: r.reason instanceof MedusaError ? r.reason.message : "error",
    })
  })
  if (ok > 0) revalidatePath("/customers")
  return { ok, failed }
}
