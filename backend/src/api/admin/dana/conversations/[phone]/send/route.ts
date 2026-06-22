/**
 * POST /admin/dana/conversations/:phone/send
 *
 * Envía un mensaje a la conversación desde el panel operador. Dos
 * modos cubren los dos requests del usuario:
 *
 *   mode = "human"   → el operador toma control y manda el mensaje
 *                       tal cual lo escribió. Implica session_status
 *                       → human_active (Dana se calla). Se guarda con
 *                       role="human" para distinguirlo en el chat
 *                       view del panel ("escribió Daniel" vs
 *                       "respondió Dana").
 *
 *   mode = "as-dana" → el operador escribió un draft, lo pasamos por
 *                       el rewriter de voz Dana y enviamos el
 *                       resultado. Se guarda con role="assistant" para
 *                       que el cliente final no perciba diferencia con
 *                       una respuesta normal de Dana. La conversación
 *                       SIGUE en bot_active — Dana retomará el
 *                       siguiente mensaje del cliente. Si el rewriter
 *                       falla, devolvemos error y el operador puede
 *                       reintentar (no enviamos nada a medias).
 *
 * Body: { text: string, mode: "human" | "as-dana" }
 * Resp: { ok: true, sent: { role, content, message_id }, conversation }
 *       o { error: string } con 4xx/5xx según el caso.
 *
 * El message_id que devuelve WaSenderAPI se guarda en wa_messages para
 * dedup (si la API hace eco de su propio mensaje hacia el webhook,
 * isBotEcho() lo identifica y no lo procesa de nuevo).
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getConversation,
  setSessionStatus,
  saveMessage,
  ensureTables,
} from "../../../../../../lib/whatsapp-db"
import { sendWhatsApp } from "../../../../../../lib/whatsapp-sender"
import { rewriteAsDana } from "../../../../../../lib/dana-voice"

let ready = false

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { try { await ensureTables(); ready = true } catch { /* tolerate */ } }

  const phone = String((req.params as Record<string, string>)?.phone ?? "").replace(/\D/g, "")
  if (!phone) return res.status(400).json({ error: "phone required" })

  const body = (req.body ?? {}) as { text?: string; mode?: string }
  const text = String(body.text ?? "").trim()
  // mode:
  //   "human"            → texto del operador tal cual (role=human, Dana se calla).
  //   "as-dana"          → reescribe con DeepSeek y envía (role=assistant).
  //   "as-dana-verbatim" → el operador YA aprobó un preview reescrito; se envía
  //                        verbatim SIN segunda pasada de LLM (evita doble costo
  //                        y drift). role=assistant, sesión sin cambios.
  const mode =
    body.mode === "as-dana" || body.mode === "as-dana-verbatim" ? body.mode : "human"
  if (!text) return res.status(400).json({ error: "text required" })
  if (text.length > 4000) {
    return res.status(400).json({ error: "text too long (max 4000 chars)" })
  }

  const conv = await getConversation(phone)
  if (!conv) return res.status(404).json({ error: "conversation not found" })

  let outgoing = text
  let usedLlm = false
  // as-dana-verbatim NO pasa por el rewriter: el texto ya es un preview Dana
  // aprobado por el operador. Solo "as-dana" dispara la pasada de DeepSeek.
  if (mode === "as-dana") {
    const r = await rewriteAsDana(text)
    outgoing = r.rewritten
    usedLlm = r.used_llm
    if (!r.used_llm) {
      // El rewriter falló o no había DeepSeek. NO enviamos —
      // mejor que el operador lo vea y decida (puede mandar el
      // draft original con mode=human, o reconfigurar la key).
      return res.status(503).json({
        error: "dana_rewrite_unavailable",
        detail: r.error || "no_deepseek_key",
        original: text,
      })
    }
  }

  // Mode "human" implica que el operador está activamente respondiendo
  // → Dana se calla hasta que human_timeout expire (cron). Mode
  // "as-dana" deja la sesión como está: Dana sigue respondiendo el
  // próximo turno del cliente.
  if (mode === "human" && conv.session_status !== "human_active") {
    await setSessionStatus(phone, "human_active")
  }

  const sentMsgId = await sendWhatsApp(phone, outgoing)
  if (sentMsgId === false) {
    return res.status(502).json({
      error: "wasender_send_failed",
      detail: "WaSenderAPI returned non-OK or no key configured",
    })
  }

  // role=assistant → mensaje aparece como Dana en el thread (cliente
  //                  no percibe diferencia con un turno normal).
  // role=human     → marca distintiva para que el chat view del panel
  //                  muestre "tú" / "operador" en vez del avatar Dana.
  const role = mode === "human" ? "human" : "assistant"
  await saveMessage(phone, role, outgoing, sentMsgId || undefined)

  // Devolvemos el conv actualizado con el nuevo session_status para
  // que el panel refresque el botón "Tomar control" sin segunda llamada.
  const refreshed = await getConversation(phone)
  return res.json({
    ok: true,
    sent: { role, content: outgoing, message_id: sentMsgId, used_llm: usedLlm },
    conversation: refreshed,
  })
}
