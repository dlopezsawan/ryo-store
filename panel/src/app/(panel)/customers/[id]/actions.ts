"use server"

import { revalidatePath } from "next/cache"
import {
  retrieveCustomer, updateCustomer,
  addCustomerAddress, updateCustomerAddress, deleteCustomerAddress,
  MedusaError,
} from "@/lib/medusa"
import { getSession } from "@/lib/auth"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export interface CustomerNote {
  id: string
  text: string
  author: string
  created_at: string
}

export async function addCustomerNoteAction(customerId: string, text: string): Promise<ActionResult> {
  try {
    const trimmed = text.trim()
    if (!trimmed) return { ok: false, error: "Nota vacía" }
    const session = await getSession()
    const author = session?.email ?? "anónimo"

    const { customer } = await retrieveCustomer(customerId)
    const existing: CustomerNote[] = Array.isArray(customer.metadata?.notes)
      ? (customer.metadata!.notes as CustomerNote[])
      : []
    const note: CustomerNote = {
      id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      text: trimmed,
      author,
      created_at: new Date().toISOString(),
    }
    await updateCustomer(customerId, {
      metadata: { ...(customer.metadata ?? {}), notes: [...existing, note] },
    })
    revalidatePath(`/customers/${customerId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteCustomerNoteAction(customerId: string, noteId: string): Promise<ActionResult> {
  try {
    const { customer } = await retrieveCustomer(customerId)
    const existing: CustomerNote[] = Array.isArray(customer.metadata?.notes)
      ? (customer.metadata!.notes as CustomerNote[])
      : []
    await updateCustomer(customerId, {
      metadata: { ...(customer.metadata ?? {}), notes: existing.filter((n) => n.id !== noteId) },
    })
    revalidatePath(`/customers/${customerId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Customer info edit ──────────────────────────────────────────────

export async function updateCustomerInfoAction(customerId: string, patch: {
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  cedula?: string
}): Promise<ActionResult> {
  try {
    const body: Parameters<typeof updateCustomer>[1] = {}
    if (patch.email !== undefined) {
      const e = patch.email.trim().toLowerCase()
      if (!e || !e.includes("@")) return { ok: false, error: "Email inválido" }
      body.email = e
    }
    if (patch.first_name !== undefined) body.first_name = patch.first_name.trim()
    if (patch.last_name !== undefined) body.last_name = patch.last_name.trim()
    if (patch.phone !== undefined) body.phone = patch.phone.trim()
    if (patch.cedula !== undefined) {
      const { customer } = await retrieveCustomer(customerId)
      const meta = { ...(customer.metadata ?? {}) }
      if (patch.cedula.trim()) meta.cedula = patch.cedula.trim()
      else delete meta.cedula
      body.metadata = meta
    }
    if (Object.keys(body).length === 0) return { ok: true }
    await updateCustomer(customerId, body)
    revalidatePath(`/customers/${customerId}`)
    revalidatePath("/customers")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Customer addresses ──────────────────────────────────────────────

interface AddressInput {
  first_name?: string
  last_name?: string
  address_1?: string
  city?: string
  province?: string
  postal_code?: string
  country_code?: string
  phone?: string
  is_default_shipping?: boolean
  is_default_billing?: boolean
}

export async function addAddressAction(customerId: string, input: AddressInput): Promise<ActionResult> {
  try {
    if (!input.country_code) return { ok: false, error: "country_code requerido" }
    await addCustomerAddress(customerId, input)
    revalidatePath(`/customers/${customerId}`)
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function updateAddressAction(
  customerId: string,
  addressId: string,
  patch: AddressInput,
): Promise<ActionResult> {
  try {
    await updateCustomerAddress(customerId, addressId, patch)
    revalidatePath(`/customers/${customerId}`)
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteAddressAction(
  customerId: string,
  addressId: string,
): Promise<ActionResult> {
  try {
    await deleteCustomerAddress(customerId, addressId)
    revalidatePath(`/customers/${customerId}`)
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}
