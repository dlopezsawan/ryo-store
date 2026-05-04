"use server"

import { revalidatePath } from "next/cache"
import { createApiKey, revokeApiKey, deleteApiKey, MedusaError } from "@/lib/medusa"

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function createApiKeyAction(input: {
  title: string
  type: "publishable" | "secret"
}): Promise<ActionResult<{ id: string; token: string; type: string }>> {
  try {
    if (!input.title.trim()) return { ok: false, error: "El título es requerido" }
    const res = await createApiKey({ title: input.title.trim(), type: input.type })
    revalidatePath("/settings/api-keys")
    return {
      ok: true,
      data: {
        id: res.api_key.id,
        token: res.api_key.token ?? "",
        type: res.api_key.type,
      },
    }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult> {
  try {
    await revokeApiKey(id)
    revalidatePath("/settings/api-keys")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteApiKeyAction(id: string): Promise<ActionResult> {
  try {
    await deleteApiKey(id)
    revalidatePath("/settings/api-keys")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
