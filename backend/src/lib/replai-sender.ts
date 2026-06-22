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

function replaiAuthHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${API_KEY}` }
}

/**
 * Resuelve el mediaId de un mensaje entrante. El payload del webhook puede no
 * traerlo (solo el body discriminado), pero el mensaje almacenado sí lo tiene
 * a nivel top-level. Lo buscamos por conversación (remoteJid) + messageId.
 */
export async function resolveReplaiMediaId(
  remoteJid: string,
  messageId: string
): Promise<string | null> {
  if (!SESSION_ID || !API_KEY) return null
  try {
    const cs = await fetch(
      `${BASE}/v1/conversations?sessionId=${encodeURIComponent(SESSION_ID)}&limit=30`,
      { headers: replaiAuthHeaders() }
    )
    if (!cs.ok) return null
    const conv = ((await cs.json()).items || []).find(
      (c: { remoteJid?: string }) => c.remoteJid === remoteJid
    ) as { id?: string } | undefined
    if (!conv?.id) return null
    const ms = await fetch(
      `${BASE}/v1/conversations/${conv.id}/messages?limit=25`,
      { headers: replaiAuthHeaders() }
    )
    if (!ms.ok) return null
    const msg = ((await ms.json()).items || []).find(
      (m: { id?: string }) => m.id === messageId
    ) as { mediaId?: string } | undefined
    return msg?.mediaId || null
  } catch (e) {
    console.error("[replai] resolveMediaId error:", e)
    return null
  }
}

/**
 * Descarga los bytes de una media de Replai. GET /v1/media/{id} devuelve un
 * MediaObject con `url` (GET firmado de corta duración) y `mimeType`.
 */
export async function downloadReplaiMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!API_KEY) return null
  try {
    const meta = await fetch(`${BASE}/v1/media/${encodeURIComponent(mediaId)}`, {
      headers: replaiAuthHeaders(),
    })
    if (!meta.ok) {
      console.error("[replai] media meta error:", meta.status)
      return null
    }
    const m = (await meta.json()) as { url?: string; mimeType?: string; status?: string }
    if (!m.url) {
      console.error("[replai] media has no signed url (status:", m.status, ")")
      return null
    }
    const dl = await fetch(m.url, { signal: AbortSignal.timeout(20000) })
    if (!dl.ok) {
      console.error("[replai] media download error:", dl.status)
      return null
    }
    const buffer = Buffer.from(await dl.arrayBuffer())
    return { buffer, mimeType: m.mimeType || "audio/ogg" }
  } catch (e) {
    console.error("[replai] media download exception:", e)
    return null
  }
}
