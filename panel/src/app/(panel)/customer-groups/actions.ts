"use server"

import { revalidatePath } from "next/cache"
import {
  createCustomerGroup, updateCustomerGroup, deleteCustomerGroup,
  addCustomersToGroup, removeCustomersFromGroup,
  MedusaError,
} from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function createGroupAction(input: { name: string }): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "El nombre es requerido" }
    await createCustomerGroup({ name: input.name.trim() })
    revalidatePath("/customer-groups")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateGroupAction(id: string, patch: { name?: string }): Promise<ActionResult> {
  try {
    await updateCustomerGroup(id, patch)
    revalidatePath("/customer-groups")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteGroupAction(id: string): Promise<ActionResult> {
  try {
    await deleteCustomerGroup(id)
    revalidatePath("/customer-groups")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function addCustomerToGroupAction(args: {
  groupId: string
  customerId: string
}): Promise<ActionResult> {
  try {
    await addCustomersToGroup(args.groupId, [args.customerId])
    revalidatePath("/customer-groups")
    revalidatePath(`/customers/${args.customerId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function removeCustomerFromGroupAction(args: {
  groupId: string
  customerId: string
}): Promise<ActionResult> {
  try {
    await removeCustomersFromGroup(args.groupId, [args.customerId])
    revalidatePath("/customer-groups")
    revalidatePath(`/customers/${args.customerId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
