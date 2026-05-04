"use server"

import { revalidatePath } from "next/cache"
import { createStockLocation, updateStockLocation, deleteStockLocation, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

interface AddressInput {
  address_1?: string
  city?: string
  postal_code?: string
  province?: string
  country_code: string
  phone?: string
}

export async function createLocationAction(input: {
  name: string
  address: AddressInput
}): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "El nombre es requerido" }
    if (!input.address.country_code) return { ok: false, error: "country_code es requerido" }
    await createStockLocation({
      name: input.name.trim(),
      address: input.address,
    })
    revalidatePath("/locations")
    revalidatePath("/inventory")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateLocationAction(id: string, patch: {
  name?: string
  address?: Partial<AddressInput>
}): Promise<ActionResult> {
  try {
    await updateStockLocation(id, patch as { name?: string; address?: AddressInput })
    revalidatePath("/locations")
    revalidatePath("/inventory")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteLocationAction(id: string): Promise<ActionResult> {
  try {
    await deleteStockLocation(id)
    revalidatePath("/locations")
    revalidatePath("/inventory")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
