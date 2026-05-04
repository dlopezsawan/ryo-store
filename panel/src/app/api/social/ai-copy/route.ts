import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

/**
 * Genera copy de post social con DeepSeek (API compatible-OpenAI).
 * Body: { prompt: string, channel: string, tone?: string, length?: "short" | "medium" | "long" }
 * Resp: { ok: true, caption: string, hashtags: string[] } | { ok: false, error: string }
 *
 * Requiere DEEPSEEK_API_KEY en env. Si no está, devuelve un error claro.
 * Se puede sobrescribir el modelo con DEEPSEEK_MODEL (default: deepseek-chat).
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "DEEPSEEK_API_KEY no configurado en el panel — añádelo a las env vars del VPS." },
      { status: 503 },
    )
  }

  let body: { prompt?: string; channel?: string; tone?: string; length?: "short" | "medium" | "long" }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  const channel = body.channel?.trim() || "instagram"
  const tone = body.tone?.trim() || "casual"
  const length = body.length ?? "medium"
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt requerido" }, { status: 400 })
  }

  const lengthHint =
    length === "short"  ? "Máximo 80 caracteres."  :
    length === "long"   ? "Entre 200 y 500 caracteres." :
                          "Entre 100 y 200 caracteres."

  const channelHint =
    channel === "twitter"   ? "Hilo de X/Twitter, máximo 280 caracteres total."
  : channel === "tiktok"    ? "Hook fuerte en la primera línea, conversacional, emojis OK."
  : channel === "facebook"  ? "Algo más formal, párrafos cortos, OK incluir CTA con link."
  : channel === "blog"      ? "Tono editorial, máximo 1 párrafo de intro."
  :                            "Para Instagram. Visual, copy emotivo, máximo 2 emojis."

  const systemMsg = `Eres copywriter de redes sociales para una marca venezolana llamada "Ryo Store" (productos de fumado, rolling papers, grinders). Devuelves EXCLUSIVAMENTE un JSON válido con la forma { "caption": string, "hashtags": string[] }, sin texto adicional.`

  const userMsg = `Genera un post para ${channel.toUpperCase()} sobre lo siguiente:

"${prompt}"

Tono: ${tone}
Restricción de longitud: ${lengthHint}
Estilo del canal: ${channelHint}

Reglas:
- "caption" NO debe incluir hashtags inline; déjalos para el array
- Hashtags entre 3 y 8, sin el "#"
- Devuelve sólo el JSON, sin backticks ni explicaciones`

  try {
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat"
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    })

    if (!res.ok) {
      let detail = ""
      try { detail = JSON.stringify(await res.json()) } catch { /* ignore */ }
      return NextResponse.json(
        { ok: false, error: `DeepSeek ${res.status}: ${detail || res.statusText}` },
        { status: 502 },
      )
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content ?? ""

    // Extraer JSON del texto (a veces viene envuelto en backticks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { ok: false, error: "Respuesta de IA sin JSON parseable", raw: text },
        { status: 502 },
      )
    }

    const parsed = JSON.parse(jsonMatch[0]) as { caption?: string; hashtags?: string[] }
    return NextResponse.json({
      ok: true,
      caption: parsed.caption ?? "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h) => typeof h === "string") : [],
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch error" },
      { status: 500 },
    )
  }
}
