/**
 * Dana — Vision/OCR pipeline para imágenes recibidas en WhatsApp.
 *
 * Una sola entrada `analyzeImage(filePath)` devuelve siempre un resultado
 * estructurado que el webhook puede inyectar al system prompt de Dana
 * como si fuera texto del cliente, sin que Dana tenga que adivinar.
 *
 * Pipeline en orden de preferencia (cae automáticamente al siguiente
 * si el anterior falla):
 *
 *   1. **DeepSeek vision** — manda la imagen como base64 image_url a
 *      `deepseek-chat`. Si DeepSeek acepta multimodal en la cuenta, da
 *      la mejor lectura semántica (entiende "esto es una lista de
 *      productos escrita a mano" y separa items). Si la API responde
 *      400 ("model doesn't support images") o similar, salta al
 *      siguiente paso.
 *
 *   2. **Tesseract + DeepSeek text** — extrae texto crudo de la imagen
 *      con Tesseract.js (spa+eng) y luego se lo pasa a DeepSeek
 *      text-only para que clasifique tipo + extraiga campos. Mismo
 *      patrón que /admin/finanzas/expenses/ocr ya usa para recibos.
 *      Funciona OK con texto imprenta, regular con handwriting.
 *
 *   3. **Solo Tesseract** — último recurso si DeepSeek está caído o
 *      sin key. Devolvemos el OCR crudo como text_content sin
 *      clasificar. Dana ve algo, no ideal pero no es nada.
 *
 * El upstream (webhook) recibe siempre el mismo shape — no le importa
 * qué provider produjo el resultado, solo que `text_content` y
 * `description` estén pobladas.
 */

import { createWorker } from "tesseract.js"
import { promises as fs } from "node:fs"
import { getConfig } from "./whatsapp-db"

export type ImageAnalysisType =
  | "handwriting"
  | "receipt"
  | "product_photo"
  | "screenshot"
  | "map"
  | "id_document"
  | "other"

export type ImageAnalysis = {
  /** Categoría general — Dana decide qué hacer según ésta */
  type: ImageAnalysisType
  /** Texto extraído (manuscrito, imprenta, lo que sea) — vacío si no hay */
  text_content: string
  /** Descripción semántica de la imagen ("lista manuscrita de 3 productos
   *  con cantidades", "comprobante de Pago Móvil Banesco por 250 Bs") */
  description: string
  /** Confianza del análisis. low → Dana debe pedir confirmación */
  confidence: "high" | "medium" | "low"
  /** OCR crudo de Tesseract (debug / fallback). Puede ser ruidoso. */
  raw_ocr: string
  /** Qué pipeline lo produjo. Útil para debug + telemetría */
  provider: "deepseek-vision" | "groq-vision" | "tesseract+deepseek" | "tesseract-only" | "failed"
  /** Mensaje de error si todo falló (provider="failed") */
  error?: string
}

const VISION_PROMPT = `Eres un asistente de análisis de imágenes para Dana, el bot de WhatsApp de enrola.shop (tienda de accesorios para fumar tabaco en Venezuela).

Un cliente envió esta imagen por WhatsApp. Tu tarea es analizarla y devolver SOLO JSON válido con esta forma exacta (sin markdown, sin texto adicional):

{
  "type": "handwriting" | "receipt" | "product_photo" | "screenshot" | "map" | "id_document" | "other",
  "text_content": string,
  "description": string,
  "confidence": "high" | "medium" | "low"
}

CATEGORÍAS:
- "handwriting": nota manuscrita del cliente (lista de pedido, dirección, notas)
- "receipt": comprobante de pago, captura bancaria, transferencia, Pago Móvil
- "product_photo": foto de un producto (el cliente pregunta si lo tienen)
- "screenshot": captura de pantalla de un chat, WhatsApp, web
- "map": captura de Google Maps, ubicación, dirección
- "id_document": cédula u otro documento de identidad
- "other": cualquier cosa que no encaje arriba

REGLAS:
- text_content: el texto que aparezca en la imagen, transcrito tal cual. Si es handwriting de lista, separa items con saltos de línea. Si no hay texto legible, devuélvelo vacío "".
- description: 1-2 frases que describan lo que ves de manera útil para Dana ("Lista manuscrita pidiendo 3 conos Alien Puff sabor mango y 1 grinder", "Comprobante de Pago Móvil Banesco por 250.50 Bs a las 14:30").
- confidence:
    - "high" = imagen clara, texto legible, sin ambigüedad
    - "medium" = se entiende pero hay partes borrosas o difíciles
    - "low" = imagen muy mala, manuscrito ilegible, o no estás seguro de lo que ves
- Si el cliente envió algo NSFW o claramente no relacionado con la tienda, devuelve type="other", description neutra, confidence="low".
- NO inventes. Si no estás seguro, low confidence.

Ejemplos:
{"type":"handwriting","text_content":"3 conos alien puff sabor mango\\n1 grinder T2\\n2 paquetes filtros carbón","description":"Lista manuscrita del cliente pidiendo 3 conos Alien Puff sabor mango, 1 grinder T2, 2 paquetes de filtros de carbón","confidence":"high"}

{"type":"receipt","text_content":"Banesco\\nPago Movil\\n250.50 Bs\\nRef: 1234567890\\n14:30 23/05","description":"Comprobante de Pago Móvil Banesco por 250.50 Bs, referencia 1234567890, hoy 14:30","confidence":"high"}`

const DEFAULT_RESULT: ImageAnalysis = {
  type: "other",
  text_content: "",
  description: "",
  confidence: "low",
  raw_ocr: "",
  provider: "failed",
}

/**
 * Pipeline completo. Lee el archivo, intenta DeepSeek vision, cae a
 * Tesseract+DeepSeek, cae a Tesseract solo, devuelve resultado.
 *
 * Nunca lanza — siempre devuelve un objeto. Si todo se rompió,
 * `provider="failed"` y `error` describe qué pasó.
 */
export async function analyzeImage(filePath: string): Promise<ImageAnalysis> {
  let buffer: Buffer
  try {
    buffer = await fs.readFile(filePath)
  } catch (err) {
    return {
      ...DEFAULT_RESULT,
      error: `read_failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Magic-byte check — no malgastemos DeepSeek tokens en algo que no
  // es una imagen.
  const head = buffer.slice(0, 4).toString("hex")
  const isJpeg = head.startsWith("ffd8")
  const isPng = head.startsWith("8950")
  const isWebp = head.startsWith("5249") // RIFF
  if (!isJpeg && !isPng && !isWebp) {
    return {
      ...DEFAULT_RESULT,
      error: `not_an_image: magic=${head}`,
    }
  }
  const mimeType = isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp"

  const deepseekKey = await getConfig("deepseek_key")

  // ─── Path 1: DeepSeek vision (multimodal) ─────────────────────────
  // As of mid-2026 DeepSeek's available models (deepseek-v4-flash and
  // deepseek-v4-pro) reject the image_url content variant. We keep
  // this path because (a) it's where the user wanted to start and
  // (b) if DeepSeek ships a vision model later, we'd pick it up
  // automatically. Today it always falls through.
  if (deepseekKey) {
    const visionResult = await tryDeepSeekVision(buffer, mimeType, deepseekKey)
    if (visionResult) {
      return { ...visionResult, provider: "deepseek-vision", raw_ocr: "" }
    }
  }

  // ─── Path 1.5: Groq Llama 3.2 Vision ──────────────────────────────
  // Groq hosts Llama 3.2 Vision Preview free on the developer tier.
  // The same `groq_key` config that powers Whisper audio transcription
  // works for vision too. Llama 3.2 Vision handles handwritten Spanish
  // surprisingly well — significantly better than Tesseract on
  // manuscript notes, only slightly weaker than GPT-4o.
  const groqKey = await getConfig("groq_key")
  if (groqKey) {
    const visionResult = await tryGroqVision(buffer, mimeType, groqKey)
    if (visionResult) {
      return { ...visionResult, provider: "groq-vision", raw_ocr: "" }
    }
  }

  // ─── Path 2: Tesseract OCR + DeepSeek text classifier ─────────────
  let rawOcr = ""
  try {
    rawOcr = await runTesseract(buffer)
  } catch (err) {
    console.error("[wa-vision] tesseract failed:", err)
    return {
      ...DEFAULT_RESULT,
      provider: "failed",
      error: `tesseract_failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (deepseekKey) {
    const classified = await tryDeepSeekText(rawOcr, deepseekKey)
    if (classified) {
      return { ...classified, provider: "tesseract+deepseek", raw_ocr: rawOcr }
    }
  }

  // ─── Path 3: Tesseract only (no LLM) ──────────────────────────────
  if (rawOcr.trim().length > 0) {
    return {
      type: "other",
      text_content: rawOcr.trim().slice(0, 800),
      description: "Imagen con texto detectado (clasificación no disponible)",
      confidence: "low",
      raw_ocr: rawOcr,
      provider: "tesseract-only",
    }
  }

  return {
    ...DEFAULT_RESULT,
    raw_ocr: rawOcr,
    error: "no_text_extractable",
  }
}

// ─── Path 1: DeepSeek vision ────────────────────────────────────────

async function tryDeepSeekVision(
  buffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<Omit<ImageAnalysis, "provider" | "raw_ocr"> | null> {
  const base64 = buffer.toString("base64")
  const imageUrl = `data:${mimeType};base64,${base64}`

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: VISION_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analiza esta imagen." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      // 400 con mensaje sobre "image" o "multimodal" → el modelo no
      // acepta imágenes. Caemos al path 2 silenciosamente.
      if (res.status === 400 && /image|multimodal|content|format/i.test(body)) {
        console.warn("[wa-vision] DeepSeek model doesn't accept images, falling back to Tesseract+DS text")
        return null
      }
      console.error("[wa-vision] DeepSeek vision non-2xx:", res.status, body.slice(0, 300))
      return null
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const raw = data.choices?.[0]?.message?.content ?? ""
    return parseAnalysisJson(raw)
  } catch (err) {
    console.error("[wa-vision] DeepSeek vision call failed:", err)
    return null
  }
}

// ─── Path 1.5: Groq Llama 3.2 Vision ────────────────────────────────

async function tryGroqVision(
  buffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<Omit<ImageAnalysis, "provider" | "raw_ocr"> | null> {
  const base64 = buffer.toString("base64")
  const imageUrl = `data:${mimeType};base64,${base64}`

  // Groq's vision lineup rotates fast: llama-3.2-vision-preview was
  // decommissioned in 2026 and replaced by Llama 4 Scout, a 17B MoE
  // with native multimodal input. The model id can move again — if
  // you see "model_decommissioned" errors here, check
  // https://console.groq.com/docs/models and update the constant.
  const model = "meta-llama/llama-4-scout-17b-16e-instruct"

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            // Groq's vision currently requires the system prompt to be
            // merged into the user message (vision models don't take a
            // separate system role on some Llama variants). The "Devuelve
            // SOLO JSON" instruction is critical because Groq doesn't
            // honor response_format=json_object on the vision model — we
            // post-parse with the tolerant parser below.
            content: [
              {
                type: "text",
                text: `${VISION_PROMPT}\n\nAhora analiza la imagen que sigue y responde SOLO con el JSON especificado, sin markdown ni texto adicional.`,
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[wa-vision] Groq vision non-2xx:", res.status, body.slice(0, 300))
      return null
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const raw = data.choices?.[0]?.message?.content ?? ""
    return parseAnalysisJson(raw)
  } catch (err) {
    console.error("[wa-vision] Groq vision call failed:", err)
    return null
  }
}

// ─── Path 2: Tesseract + DeepSeek text ──────────────────────────────

async function runTesseract(buffer: Buffer): Promise<string> {
  const worker = await createWorker("spa+eng", undefined, {
    cachePath: "/tmp/tesseract-cache",
    logger: () => {},
  } as Parameters<typeof createWorker>[2])
  try {
    const { data } = await worker.recognize(buffer)
    return data.text || ""
  } finally {
    await worker.terminate().catch(() => {})
  }
}

async function tryDeepSeekText(
  ocrText: string,
  apiKey: string
): Promise<Omit<ImageAnalysis, "provider" | "raw_ocr"> | null> {
  if (!ocrText.trim()) {
    return {
      type: "other",
      text_content: "",
      description: "No se detectó texto en la imagen",
      confidence: "low",
    }
  }
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            // Misma estructura JSON pero adaptada: no tiene la imagen,
            // solo el OCR crudo. Pide clasificar y limpiar.
            content:
              VISION_PROMPT +
              `\n\nIMPORTANTE: NO tienes la imagen, solo el texto OCR crudo. ` +
              `Devuelve text_content con el texto LIMPIADO (sin caracteres ` +
              `basura del OCR) y confidence basado en qué tan ruidoso era el ` +
              `OCR original. Si el texto OCR está muy roto/ilegible, ` +
              `confidence="low" y type="other".`,
          },
          {
            role: "user",
            content: `Texto OCR de la imagen (puede tener ruido):\n\n${ocrText}`,
          },
        ],
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.error("[wa-vision] DeepSeek text classifier non-2xx:", res.status)
      return null
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const raw = data.choices?.[0]?.message?.content ?? ""
    return parseAnalysisJson(raw)
  } catch (err) {
    console.error("[wa-vision] DeepSeek text classifier failed:", err)
    return null
  }
}

// ─── JSON parsing (tolerant) ────────────────────────────────────────

function parseAnalysisJson(
  raw: string
): Omit<ImageAnalysis, "provider" | "raw_ocr"> | null {
  if (!raw) return null
  // DeepSeek a veces envuelve en ```json ... ``` aunque el response_format
  // sea json_object. Limpiar por las dudas.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const type = String(parsed.type ?? "other")
    const validTypes: ImageAnalysisType[] = [
      "handwriting",
      "receipt",
      "product_photo",
      "screenshot",
      "map",
      "id_document",
      "other",
    ]
    return {
      type: (validTypes as string[]).includes(type)
        ? (type as ImageAnalysisType)
        : "other",
      text_content: String(parsed.text_content ?? "").slice(0, 2000),
      description: String(parsed.description ?? "").slice(0, 500),
      confidence:
        parsed.confidence === "high" || parsed.confidence === "medium"
          ? (parsed.confidence as "high" | "medium")
          : "low",
    }
  } catch (err) {
    console.error("[wa-vision] JSON parse failed:", err, "raw:", raw.slice(0, 200))
    return null
  }
}

/**
 * Construye el placeholder que reemplaza `[IMAGEN_RECIBIDA: url]` en
 * el mensaje que va a Dana. Cada tipo tiene un formato distinto para
 * que el LLM sepa qué hacer.
 *
 *   handwriting → [IMAGEN_TEXTO_MANUSCRITO: "..."]
 *   receipt → [IMAGEN_COMPROBANTE_PAGO: "..."]
 *   product_photo → [IMAGEN_PRODUCTO: "..."]
 *   screenshot → [IMAGEN_SCREENSHOT: "..."]
 *   map → [IMAGEN_MAPA: "..."]
 *   id_document → [IMAGEN_CEDULA: "..."]
 *   other → [IMAGEN_OTRA: "..."]
 *
 * Si confidence="low", se añade un sufijo "(baja confianza, pedir
 * confirmación al cliente)" para que Dana sepa que no debe asumir.
 */
export function buildPlaceholderForAnalysis(a: ImageAnalysis): string {
  const tag = {
    handwriting: "IMAGEN_TEXTO_MANUSCRITO",
    receipt: "IMAGEN_COMPROBANTE_PAGO",
    product_photo: "IMAGEN_PRODUCTO",
    screenshot: "IMAGEN_SCREENSHOT",
    map: "IMAGEN_MAPA",
    id_document: "IMAGEN_CEDULA",
    other: "IMAGEN_OTRA",
  }[a.type]

  // Si hay text_content lo damos prioridad; si solo hay description,
  // ésa va. Si no hay nada, "imagen sin texto reconocible".
  const body = a.text_content?.trim()
    ? a.text_content.trim()
    : a.description?.trim() || "imagen sin texto reconocible"

  const confSuffix =
    a.confidence === "low"
      ? " (baja confianza — pide confirmación al cliente antes de actuar)"
      : ""

  return `[${tag}: ${JSON.stringify(body)}${confSuffix}]`
}
