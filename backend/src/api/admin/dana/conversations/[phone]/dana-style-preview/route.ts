/**
 * POST /admin/dana/conversations/:phone/dana-style-preview
 *
 * Recibe el draft del operador y lo devuelve reescrito en voz de
 * Dana, sin enviarlo a WhatsApp. Pensado para que el panel muestre un
 * preview editable antes del send — el operador ve cómo quedaría y
 * decide si manda eso, lo edita, o lo envía tal cual.
 *
 * Body: { text: string }
 * Resp: { original: string, rewritten: string, used_llm: boolean, error?: string }
 *
 * Si DeepSeek no está configurado o falla, devuelve `rewritten === text`
 * con `used_llm: false` y un `error` explicando — el panel lo usa
 * para mostrar un warning ("rewrite no disponible, se envía tal cual").
 *
 * No depende del :phone path param para nada — el rewriter es
 * stateless. Lo dejamos en la URL del :phone igual para que el panel
 * mantenga URLs consistentes y porque a futuro podríamos personalizar
 * el rewrite con contexto del cliente (su historial, su tono).
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rewriteAsDana } from "../../../../../../lib/dana-voice"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as { text?: string }
  const text = String(body.text ?? "").trim()
  if (!text) return res.status(400).json({ error: "text required" })
  if (text.length > 2000) {
    return res.status(400).json({ error: "text too long (max 2000 chars)" })
  }

  const result = await rewriteAsDana(text)
  return res.json({
    original: text,
    rewritten: result.rewritten,
    used_llm: result.used_llm,
    error: result.error,
  })
}
