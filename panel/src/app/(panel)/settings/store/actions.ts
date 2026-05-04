"use server"

import { revalidatePath } from "next/cache"
import { updateStore, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function updateStoreAction(id: string, patch: {
  name?: string
  default_sales_channel_id?: string | null
  default_region_id?: string | null
  supported_currencies?: Array<{ currency_code: string; is_default?: boolean }>
}): Promise<ActionResult> {
  try {
    await updateStore(id, patch)
    revalidatePath("/settings/store")
    revalidatePath("/settings")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
