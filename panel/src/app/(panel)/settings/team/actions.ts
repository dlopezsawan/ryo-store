"use server"

import { revalidatePath } from "next/cache"
import { createInvite, deleteInvite, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function inviteAction(input: { email: string }): Promise<ActionResult> {
  try {
    const email = input.email.trim().toLowerCase()
    if (!email || !email.includes("@")) return { ok: false, error: "Email inválido" }
    await createInvite({ email })
    revalidatePath("/settings/team")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function cancelInviteAction(id: string): Promise<ActionResult> {
  try {
    await deleteInvite(id)
    revalidatePath("/settings/team")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
