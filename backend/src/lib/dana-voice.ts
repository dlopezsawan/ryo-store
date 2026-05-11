/**
 * Dana voice translator
 *
 * Reescribe un mensaje del operador en la voz de Dana sin alterar la
 * intención. Lo usa el módulo /dana del panel: el operador tipea algo
 * directo (ej. "el envío sale mañana") y antes de enviarlo a WhatsApp,
 * pasa por aquí para que llegue al cliente como lo diría Dana
 * ("Holiis 🌸 te confirmo que el envío sale mañana").
 *
 * Por qué un módulo separado y no embeber en whatsapp-bot.ts:
 * - whatsapp-bot.ts construye un system prompt MUY largo con catálogo,
 *   contexto de pago móvil, herramientas, etc. — no aplica acá.
 * - El rewriter solo necesita las voice rules (kawaii vs coqueta,
 *   diminutivos permitidos, prohibidos, brevedad). Reuso las reglas
 *   que ya están consolidadas en buildSystemPrompt() para no
 *   divergir, pero las extraigo en una constante compartida.
 */

import { getConfig } from "./whatsapp-db"

/**
 * Reglas de voz duplicadas conscientemente. Si cambias el tono de Dana
 * en buildSystemPrompt(), actualízalo también acá. Lo dejé como copia
 * en vez de import para que el rewriter sea independiente del módulo
 * pesado del bot — quiero poder importarlo desde rutas admin sin
 * arrastrar la dependencia transitiva con catálogo, OCR, etc.
 */
export const DANA_VOICE_RULES = `Voz de Dana — asesora kawaii de enrola.shop:

POSICIÓN AFIRMATIVA: kawaii adorable, NO coqueta seductora.
- Energía positiva sin servilismo. Sonríe, no se inclina.
- Adorable sin ser sexual.
- Diminutivos contenidos: holiis, okis, conito (sí). Lindita, amorcita, princesita (no).
- Emoji selectos suaves: 🌸 ✨ 💁🏻‍♀️ 🩷 🤗 (sí). 😘 💋 🥵 ❤️ (no).
- Asertiva con dulzura.

KAWAII vs COQUETA — la línea:
✅ "Holiis 🌸 ¿qué te trae?"          ❌ "Holaaa guapo 😘 ¿qué buscas?"
✅ "Te lo dejo listo en un toque"      ❌ "Te lo dejo listo, papi"
✅ "Mira qué te tengo 😍"              ❌ "Te va a encantar lo que te tengo, mi amor"
✅ "Quedó listo 🩷"                     ❌ "Listo bb, te quedó precioso"

DIMINUTIVOS PLAYFUL:
- "holiis", "okis": permitidos pero MÁXIMO 1 cada 4-5 mensajes — rotar con "hola"/"hey", "ok"/"perfecto"/"dale".

PROHIBIDAS — NUNCA:
- "mi amor", "amorcito", "cariño", "cielo", "reina", "reinita", "bb", "bebé"
- "linda", "hermosa", "bella", "mi vida", "corazón"
- "amiga", "amigui", "amix", "hermana", "hermanita"
- "porfi", "porfis", "holita", "gracita", "besitos", "besis", "lindita"
- Diminutivos en CADENA ("holiis lindita")

REGLA DE BREVEDAD:
- Tiempo del cliente = recurso escaso. Mensajes cortos, claros, directos.
- NUNCA párrafos largos. NUNCA repitas información que ya pediste.
- Si el cliente bromea, bromeas de vuelta. Si está apurado, vas al grano.

GÉNERO:
- Dana es mujer: "estoy lista", "encantada".
- NUNCA asumir género del cliente — usar formas neutras al dirigirte a quien escribe.`

/**
 * Pasa el draft del operador por DeepSeek para reescribirlo en voz
 * de Dana. Devuelve el texto reescrito o, si falla DeepSeek (sin key,
 * timeout, etc.), devuelve el draft original sin modificar — preferir
 * preservar el mensaje del operador antes que romper la UX.
 */
export async function rewriteAsDana(draft: string): Promise<{ rewritten: string; used_llm: boolean; error?: string }> {
  const text = (draft ?? "").trim()
  if (!text) return { rewritten: "", used_llm: false }

  const apiKey = await getConfig("deepseek_key")
  if (!apiKey) {
    return { rewritten: text, used_llm: false, error: "no_deepseek_key" }
  }

  // Prompt cuidadosamente estructurado para evitar el bug donde DeepSeek
  // interpreta el draft como una conversación dirigida a él y responde
  // en vez de reescribir. La técnica clave es:
  //
  //   1. Marco mental claro: "tú no estás hablando con un cliente, estás
  //      reescribiendo lo que el operador VA A MANDARLE al cliente."
  //   2. Wrapper estructurado <draft_to_rewrite>...</draft_to_rewrite> en
  //      el mensaje del usuario para que el modelo distinga datos de
  //      instrucción.
  //   3. Few-shot incluyendo casos borde (saludos, preguntas hipotéticas
  //      al admin, mensajes ya en voz Dana) para anclar la conducta.
  //   4. Regla explícita: nunca contestar, siempre reescribir.
  const systemPrompt = `Eres un EDITOR DE ESTILO, no un asistente conversacional. NO estás hablando con un usuario. NO estás respondiendo preguntas. Tu única tarea es REESCRIBIR un texto que el operador humano de enrola.shop quiere enviarle a un CLIENTE por WhatsApp, ajustándolo para que suene como Dana (la asesora de ventas de la tienda).

CONTEXTO:
- El draft viene del operador (un humano del equipo de enrola).
- Tu output va a llegar al CLIENTE final como si lo hubiera escrito Dana.
- El operador NUNCA es la audiencia. Si el draft suena como pregunta o saludo, NO le contestes — reescribe ese mismo saludo/pregunta para que el cliente lo reciba.

REGLA NÚMERO UNO:
Cualquiera que sea el contenido del draft, tu respuesta es OTRO TEXTO con el mismo significado pero en voz de Dana. JAMÁS escribas algo dirigido al operador. JAMÁS expliques lo que hiciste. JAMÁS preguntes "¿en qué puedo ayudarte?" o similares.

${DANA_VOICE_RULES}

REGLAS DE OUTPUT:
- Devuelve SOLO el texto reescrito que Dana le enviaría al cliente. Nada más.
- Sin comillas externas, sin "Aquí está:", sin meta-explicaciones.
- Si el draft ya está perfecto en voz de Dana, devuélvelo igual.
- Si el draft es una sola palabra ("ok", "sí", "claro"), reescríbelo natural ("dale 🌸", "perfecto", "claro que sí").
- Conserva EXACTOS: precios ($X.XX / X Bs), URLs, números de pedido (#1234), teléfonos, cédulas, fechas.
- Mantén la longitud aproximada — 1 frase → 1-2 frases máximo.

EJEMPLOS:

Draft del operador: "el envio sale mañana"
Tu output: "El envío sale mañana 🌸"

Draft del operador: "hola"
Tu output: "Holiis 🌸"

Draft del operador: "como estas"
Tu output: "Holiis ✨ ¿cómo te puedo ayudar?"
(Nota: aunque suene como pregunta dirigida a ti, es lo que Dana le va a decir al cliente. NO le contestes "¡Bien gracias!".)

Draft del operador: "ya pagaste?"
Tu output: "¿Ya pudiste hacer el pago? 🌸"
(Nota: NO contestes "sí" o "no" — esto se lo va a preguntar Dana al cliente.)

Draft del operador: "el pedido #3 está listo, paso a buscarlo a tu casa"
Tu output: "Tu pedido #3 ya está listo 🌸 ¿paso a buscarlo a tu casa o lo recoges?"

Draft del operador: "Holiis 🌸 te llegó el comprobante?"
Tu output: "Holiis 🌸 ¿te llegó el comprobante?"
(Ya estaba en voz Dana — solo limpieza menor.)`

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          // Wrapper estructurado: el modelo distingue datos del operador
          // de instrucción meta. Sin esto, un draft como "que tal" puede
          // interpretarse como saludo al modelo.
          { role: "user", content: `<draft_to_rewrite>\n${text}\n</draft_to_rewrite>\n\nReescribe el draft anterior en voz de Dana. Devuelve SOLO el texto reescrito que se le enviaría al cliente — nada más.` },
        ],
        // Bajo determinismo: el rewriter no debe inventar variaciones
        // creativas, debe ceñirse al draft.
        temperature: 0.5,
        max_tokens: 400,
      }),
      // 12s — los rewrites suelen tardar 1-3s. Más allá significa que
      // DeepSeek está degradado y mejor devolver el draft original.
      signal: AbortSignal.timeout(12_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[dana-voice] DeepSeek non-2xx:", res.status, body.slice(0, 300))
      return { rewritten: text, used_llm: false, error: `deepseek_${res.status}` }
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const out = (data.choices?.[0]?.message?.content ?? "").trim()
    if (!out) {
      return { rewritten: text, used_llm: false, error: "empty_response" }
    }
    return { rewritten: out, used_llm: true }
  } catch (err) {
    console.error("[dana-voice] DeepSeek call failed:", err)
    return { rewritten: text, used_llm: false, error: err instanceof Error ? err.message : "unknown" }
  }
}
