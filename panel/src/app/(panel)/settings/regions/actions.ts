"use server"

import { revalidatePath } from "next/cache"
import { createRegion, updateRegion, deleteRegion, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function createRegionAction(input: {
  name: string
  currency_code: string
  countries: string[]
  automatic_taxes?: boolean
}): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "El nombre es requerido" }
    if (!input.currency_code.trim()) return { ok: false, error: "Currency code requerido" }
    if (input.countries.length === 0) return { ok: false, error: "Añade al menos un país" }
    await createRegion({
      name: input.name.trim(),
      currency_code: input.currency_code.toLowerCase(),
      countries: input.countries.map((c) => c.toLowerCase()),
      automatic_taxes: input.automatic_taxes ?? false,
    })
    revalidatePath("/settings/regions")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateRegionAction(id: string, patch: {
  name?: string
  currency_code?: string
  countries?: string[]
  automatic_taxes?: boolean
}): Promise<ActionResult> {
  try {
    const body: Parameters<typeof updateRegion>[1] = {}
    if (patch.name !== undefined) body.name = patch.name
    if (patch.currency_code !== undefined) body.currency_code = patch.currency_code.toLowerCase()
    if (patch.countries !== undefined) body.countries = patch.countries.map((c) => c.toLowerCase())
    if (patch.automatic_taxes !== undefined) body.automatic_taxes = patch.automatic_taxes
    await updateRegion(id, body)
    revalidatePath("/settings/regions")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteRegionAction(id: string): Promise<ActionResult> {
  try {
    await deleteRegion(id)
    revalidatePath("/settings/regions")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
