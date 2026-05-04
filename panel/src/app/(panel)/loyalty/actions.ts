"use server"

import { revalidatePath } from "next/cache"
import { createLoyaltyReward, updateLoyaltyReward, deleteLoyaltyReward, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    if (e.status === 404) return "Endpoint /admin/loyalty/rewards no implementado en el backend."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function createRewardAction(input: {
  name: string
  description?: string
  points_required: number
  image_url?: string
  is_active?: boolean
}): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "Nombre requerido" }
    if (!Number.isFinite(input.points_required) || input.points_required <= 0) {
      return { ok: false, error: "Puntos requeridos debe ser > 0" }
    }
    await createLoyaltyReward({
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      points_required: Math.floor(input.points_required),
      image_url: input.image_url?.trim() || undefined,
      is_active: input.is_active ?? true,
    })
    revalidatePath("/loyalty")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function updateRewardAction(id: string, patch: {
  name?: string
  description?: string | null
  points_required?: number
  is_active?: boolean
}): Promise<ActionResult> {
  try {
    await updateLoyaltyReward(id, patch as Parameters<typeof updateLoyaltyReward>[1])
    revalidatePath("/loyalty")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteRewardAction(id: string): Promise<ActionResult> {
  try {
    await deleteLoyaltyReward(id)
    revalidatePath("/loyalty")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}
