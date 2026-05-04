"use server"

import { revalidatePath } from "next/cache"
import { createSalesChannel, updateSalesChannel, deleteSalesChannel, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function createSalesChannelAction(input: { name: string; description: string }): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "El nombre es requerido" }
    await createSalesChannel({
      name: input.name.trim(),
      description: input.description.trim() || undefined,
    })
    revalidatePath("/settings/sales-channels")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateSalesChannelAction(id: string, patch: {
  name?: string
  description?: string | null
  is_disabled?: boolean
}): Promise<ActionResult> {
  try {
    await updateSalesChannel(id, patch)
    revalidatePath("/settings/sales-channels")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteSalesChannelAction(id: string): Promise<ActionResult> {
  try {
    await deleteSalesChannel(id)
    revalidatePath("/settings/sales-channels")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
