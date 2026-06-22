/**
 * Replai sender — envía mensajes de WhatsApp a través de Replai (replai.tech),
 * que actúa solo como pasarela. Reemplaza a WaSenderAPI para Dana.
 *
 * Endpoint: POST {REPLAI_API_BASE}/v1/messages
 *   body: { sessionId, to, text, clientMessageId? }   (SendTextInput)
 *   auth: Authorization: Bearer <REPLAI_API_KEY>
 *   resp: 202 { accepted, jobId, to }   (envío asíncrono)
 *
 * `to` acepta E.164 o un JID completo (Replai lo normaliza).
 */

const BASE = (process.env.REPLAI_API_BASE || "https://srv977695.hstgr.cloud/api").replace(/\/$/, "")
const SESSION_ID = process.env.REPLAI_SESSION_ID || ""
const API_KEY = process.env.REPLAI_API_KEY || ""

/**
 * Envía un texto por Replai. Devuelve el jobId en éxito (o "sent" si la
 * respuesta no trae jobId), o false en error. La firma replica a sendWhatsApp
 * para que el webhook pueda guardar el id y deduplicar ecos.
 */
export async function sendViaReplai(to: string, text: string): Promise<string | false> {
  if (!SESSION_ID || !API_KEY) {
    console.error("[replai] REPLAI_SESSION_ID / REPLAI_API_KEY no configurados")
    return false
  }
  try {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ sessionId: SESSION_ID, to, text }),
    })
    const raw = await res.text()
    if (!res.ok) {
      console.error("[replai] send error:", res.status, raw.slice(0, 400))
      return false
    }
    let data: { jobId?: string } = {}
    try {
      data = JSON.parse(raw)
    } catch {
      /* respuesta no-JSON; tratamos como enviado */
    }
    return data.jobId || "sent"
  } catch (e) {
    console.error("[replai] send exception:", e)
    return false
  }
}

export function replaiConfigured(): boolean {
  return Boolean(SESSION_ID && API_KEY)
}
