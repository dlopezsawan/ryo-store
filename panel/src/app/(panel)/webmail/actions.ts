"use server"

import { revalidatePath } from "next/cache"
import {
  sendEmail, createBroadcast, sendBroadcast,
  defaultFromAddress, isConfigured,
  ResendError, ResendNotConfigured,
} from "@/lib/resend"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof ResendNotConfigured) {
    return "RESEND_API_KEY no configurado en el panel — añádelo a las env vars."
  }
  if (e instanceof ResendError) {
    if (e.status === 401) return "API key inválida — revisa RESEND_API_KEY"
    if (e.status === 422) {
      // Resend devuelve detalles útiles en 422 (validation)
      const d = e.details as { message?: string } | undefined
      return d?.message ?? "Datos inválidos"
    }
    return `Resend ${e.status}: ${e.message}`
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function sendTransactionalAction(input: {
  to: string
  subject: string
  body: string
  /** opcional, override del from address */
  from?: string
  /** Etiquetas para tracking */
  tags?: Array<{ name: string; value: string }>
}): Promise<ActionResult> {
  try {
    if (!isConfigured()) throw new ResendNotConfigured()
    if (!input.to.trim() || !input.to.includes("@")) {
      return { ok: false, error: "Destinatario inválido" }
    }
    if (!input.subject.trim()) return { ok: false, error: "Asunto requerido" }
    if (!input.body.trim()) return { ok: false, error: "Cuerpo del mensaje vacío" }

    // Auto-wrap plain text as HTML simple si no parece HTML
    const looksHtml = /<[a-z][\s\S]*>/i.test(input.body)
    const html = looksHtml ? input.body : `<div style="font-family: system-ui, sans-serif; line-height: 1.6;">${escapeHtml(input.body).replace(/\n/g, "<br />")}</div>`
    const text = looksHtml ? stripHtml(input.body) : input.body

    const res = await sendEmail({
      from: input.from?.trim() || defaultFromAddress(),
      to: input.to.trim(),
      subject: input.subject.trim(),
      html,
      text,
      tags: input.tags,
    })
    revalidatePath("/webmail")
    return { ok: true, id: res.id }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "")
}

// ─── Newsletter broadcast (Resend Broadcasts API) ───────────────────

export async function createAndSendBroadcastAction(input: {
  audience_id: string
  subject: string
  body: string
  name?: string
  send_now: boolean
  scheduled_at?: string
}): Promise<ActionResult> {
  try {
    if (!isConfigured()) throw new ResendNotConfigured()
    if (!input.audience_id) return { ok: false, error: "Audience requerida" }
    if (!input.subject.trim()) return { ok: false, error: "Asunto requerido" }
    if (!input.body.trim()) return { ok: false, error: "Cuerpo del mensaje vacío" }

    const looksHtml = /<[a-z][\s\S]*>/i.test(input.body)
    const html = looksHtml
      ? input.body
      : `<div style="font-family: system-ui, sans-serif; line-height: 1.6;">${escapeHtml(input.body).replace(/\n/g, "<br />")}</div>`
    const text = looksHtml ? stripHtml(input.body) : input.body

    // Crear el broadcast
    const created = await createBroadcast({
      audience_id: input.audience_id,
      from: defaultFromAddress(),
      subject: input.subject.trim(),
      html,
      text,
      name: input.name?.trim() || `Newsletter ${new Date().toISOString().slice(0, 10)}`,
    })

    // Si se pidió enviar ya o programar
    if (input.send_now) {
      await sendBroadcast(created.id, input.scheduled_at ? { scheduled_at: input.scheduled_at } : undefined)
    }

    revalidatePath("/webmail")
    revalidatePath("/webmail/audiences")
    return { ok: true, id: created.id }
  } catch (e) {
    if (e instanceof ResendNotConfigured) {
      return { ok: false, error: "RESEND_API_KEY no configurado" }
    }
    if (e instanceof ResendError) {
      const d = e.details as { message?: string } | undefined
      return { ok: false, error: d?.message ?? `Resend ${e.status}: ${e.message}` }
    }
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" }
  }
}
