"use server"

import { revalidatePath } from "next/cache"
import { updateRegion, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

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

/**
 * Asigna providers a una región. Medusa v2 acepta un array de IDs
 * en el campo `payment_providers` del PATCH region.
 */
export async function setRegionProvidersAction(
  regionId: string,
  providerIds: string[],
): Promise<ActionResult> {
  try {
    // medusaFetch.ts no tipa `payment_providers` en updateRegion, lo casteamos
    await updateRegion(
      regionId,
      { payment_providers: providerIds } as unknown as Parameters<typeof updateRegion>[1],
    )
    revalidatePath("/settings/payments")
    revalidatePath("/settings/regions")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}
