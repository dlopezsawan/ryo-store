"use server"

import { revalidatePath } from "next/cache"
import { setMaintenanceStatus, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    if (e.status === 404) return "Endpoint /admin/maintenance no implementado en el backend."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function toggleMaintenanceAction(input: {
  enabled: boolean
  message?: string
}): Promise<ActionResult> {
  try {
    await setMaintenanceStatus({ enabled: input.enabled, message: input.message ?? null })
    revalidatePath("/settings")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
