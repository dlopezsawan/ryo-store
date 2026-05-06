"use server"

import { revalidatePath } from "next/cache"
import {
  setDanaConversationStatus,
  sendDanaMessage,
  previewDanaStyle,
  updateDanaConfig,
  MedusaError,
  type DanaConfig,
} from "@/lib/medusa"

type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    if (e.status === 404) return "Conversación no encontrada."
    if (e.status === 503) {
      // /send con mode=as-dana cuando DeepSeek falló. Detalle viene en details.
      const d = e.details as { error?: string; detail?: string } | undefined
      if (d?.error === "dana_rewrite_unavailable") {
        return d.detail === "no_deepseek_key"
          ? "DeepSeek no está configurado — manda como humano o agrega la key en /dana/config."
          : "El reescribido como Dana falló. Manda como humano o reintenta."
      }
      return "Servicio no disponible — reintenta."
    }
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

/** Botón "Tomar control" / "Soltar control" del chat view. */
export async function setStatusAction(phone: string, status: "bot_active" | "human_active"): Promise<ActionResult> {
  try {
    await setDanaConversationStatus(phone, status)
    revalidatePath("/dana")
    revalidatePath(`/dana/${phone}`)
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/**
 * Send unificado. Si mode="as-dana" el operador YA debe haber visto
 * el preview (el panel le muestra `rewritten` antes de este action).
 * El backend re-aplica el rewrite — el panel le manda el texto que el
 * operador aprobó, no el preview crudo, para que la pasada del LLM
 * sea idempotente y barata. Si el operador editó el preview, se manda
 * como "human" porque ya no es output puro de Dana.
 */
export async function sendMessageAction(phone: string, text: string, mode: "human" | "as-dana"): Promise<ActionResult<{ message: string }>> {
  try {
    const trimmed = text.trim()
    if (!trimmed) return { ok: false, error: "Mensaje vacío" }
    if (trimmed.length > 4000) return { ok: false, error: "Mensaje demasiado largo (máx 4000 chars)" }
    const r = await sendDanaMessage(phone, trimmed, mode)
    revalidatePath("/dana")
    revalidatePath(`/dana/${phone}`)
    return { ok: true, message: r.sent.content }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/**
 * Devuelve el preview reescrito sin enviar nada. El cliente lo llama
 * mientras el operador tipea (debounced) o al click de "Reescribir
 * como Dana" — flujo a elección del componente.
 */
export async function previewAsDanaAction(phone: string, text: string): Promise<ActionResult<{ rewritten: string; used_llm: boolean; warning?: string }>> {
  try {
    const trimmed = text.trim()
    if (!trimmed) return { ok: false, error: "Texto vacío" }
    if (trimmed.length > 2000) return { ok: false, error: "Demasiado largo para reescribir (máx 2000)" }
    const r = await previewDanaStyle(phone, trimmed)
    return {
      ok: true,
      rewritten: r.rewritten,
      used_llm: r.used_llm,
      warning: r.used_llm ? undefined : (
        r.error === "no_deepseek_key"
          ? "DeepSeek sin configurar — el preview es igual al draft."
          : `El reescribido falló (${r.error || "desconocido"}). Se mostró el draft sin cambios.`
      ),
    }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/** Update parcial del config — solo se mandan las keys que cambiaron. */
export async function updateConfigAction(updates: Partial<DanaConfig>): Promise<ActionResult<{ updated: string[] }>> {
  try {
    const r = await updateDanaConfig(updates)
    revalidatePath("/dana")
    revalidatePath("/dana/config")
    return { ok: true, updated: r.updated_keys }
  } catch (e) { return { ok: false, error: toError(e) } }
}
