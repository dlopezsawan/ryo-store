/**
 * POST /admin/finanzas/expenses/ocr
 *   Body: { image_base64, mime_type? }
 *
 * Two-step OCR:
 *   1. Tesseract.js extracts raw text from the image (spa + eng).
 *   2. DeepSeek (deepseek-v4-flash) parses that text into the canonical
 *      expense fields. Falls back to deepseek-chat if v4 isn't available
 *      on this account.
 *
 * The DeepSeek key lives in `wa_bot_config.deepseek_key` (same store the
 * WhatsApp bot uses), so it can be rotated without re-deploying.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createWorker } from "tesseract.js"
import { Pool } from "pg"
import FinanzasModuleService from "../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../modules/finanzas"
import { getConfig } from "../../../../../lib/whatsapp-db"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const PARSE_PROMPT = `Eres un asistente de extracción de datos de comprobantes para una tienda en Venezuela. Te llega TEXTO crudo extraído por OCR de una foto de un recibo, factura, captura de pantalla bancaria, o transferencia. El texto puede tener errores de OCR (números cortados, caracteres confundidos).

Devolvé SOLO JSON válido (sin markdown, sin texto adicional) con esta forma exacta:

{
  "amount_usdt": number | null,
  "amount_bs": number | null,
  "amount_eur": number | null,
  "currency_detected": "USDT" | "BS" | "USD" | "EUR" | null,
  "merchant": string | null,
  "expense_date": "YYYY-MM-DD" | null,
  "category_hint": string | null,
  "description": string | null,
  "confidence": "high" | "medium" | "low",
  "raw_notes": string | null
}

Reglas:
- Pago Móvil venezolano (Banesco/Mercantil/BBVA/etc.): amount_bs = monto, currency_detected="BS".
- Zelle/transferencia bancaria USA: amount_usdt = monto, currency_detected="USD".
- Binance/USDT P2P: amount_usdt = monto, currency_detected="USDT".
- Para "Bs" venezolanos las comas se usan como decimales (ej "1.234,56" = 1234.56).
- expense_date: si solo hay DD/MM, asumí año actual.
- description: ≤100 caracteres, lectura humana ("Anuncios IG", "Pago Claude", etc.).
- category_hint: una sugerencia ("Marketing IG", "VPS Hostinger", "Restock proveedor", "Comisión Pago Móvil"…).
- Si el OCR es confuso o ilegible: confidence="low", la mayoría de campos en null.
- NO INVENTES. Mejor null que un número mal leído.
`

type OcrResult = {
  amount_usdt: number | null
  amount_bs: number | null
  amount_eur: number | null
  currency_detected: "USDT" | "BS" | "USD" | "EUR" | null
  merchant: string | null
  expense_date: string | null
  category_hint: string | null
  category_id_suggested: string | null
  description: string | null
  confidence: "high" | "medium" | "low"
  raw_notes: string | null
  raw_ocr_text: string
}

function suggestCategoryId(
  hint: string | null,
  categories: Array<{ id: string; name: string; bucket: string }>
): string | null {
  if (!hint) return null
  const h = hint.toLowerCase()
  let match = categories.find((c) => c.name.toLowerCase() === h)
  if (match) return match.id
  match = categories.find(
    (c) => h.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(h)
  )
  if (match) return match.id
  if (/marketing|ads?|publicidad|instagram|facebook|meta/i.test(hint)) {
    return categories.find((c) => c.bucket === "marketing")?.id || null
  }
  if (/alquiler|claude|vps|hostinger|dominio|electricidad|internet|sueldo/i.test(hint)) {
    return categories.find((c) => c.bucket === "gastos_fijos")?.id || null
  }
  if (/restock|inventario|proveedor|insumos/i.test(hint)) {
    return categories.find((c) => c.bucket === "restock")?.id || null
  }
  if (/envio|mrw|delivery|transport/i.test(hint)) {
    return categories.find((c) => c.bucket === "envios")?.id || null
  }
  if (/comision|fee/i.test(hint)) {
    return categories.find((c) => c.bucket === "comisiones_pago")?.id || null
  }
  return null
}

async function runTesseract(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64")
  // Spanish + English combined gives best results for VE receipts (mix of
  // bank Spanish + brand English). Falls back to eng if spa data isn't
  // cached locally on first run.
  const worker = await createWorker("spa+eng", undefined, {
    // Tesseract.js downloads language data lazily; cache under /tmp so the
    // container doesn't fight read-only fs.
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

async function callDeepSeek(text: string, key: string): Promise<Partial<OcrResult>> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: PARSE_PROMPT },
        { role: "user", content: `OCR raw text:\n\n${text}` },
      ],
      temperature: 0,
      max_tokens: 600,
      response_format: { type: "json_object" },
    }),
  })
  if (!res.ok) {
    // Fallback model name for older accounts
    if (res.status === 400 || res.status === 404) {
      const retry = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: PARSE_PROMPT },
            { role: "user", content: `OCR raw text:\n\n${text}` },
          ],
          temperature: 0,
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
      })
      if (!retry.ok) {
        throw new Error(`DeepSeek ${retry.status}: ${await retry.text().catch(() => "")}`)
      }
      const j = (await retry.json()) as { choices?: Array<{ message?: { content?: string } }> }
      return JSON.parse(j.choices?.[0]?.message?.content ?? "{}")
    }
    throw new Error(`DeepSeek ${res.status}: ${await res.text().catch(() => "")}`)
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const raw = j.choices?.[0]?.message?.content ?? "{}"
  return JSON.parse(raw)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as { image_base64?: string; mime_type?: string }
  const base64 = (body.image_base64 || "").replace(/^data:[^;]+;base64,/, "")
  if (!base64 || base64.length < 100) {
    return res.status(400).json({
      error: "Falta image_base64 (esperaba JSON { image_base64, mime_type? })",
    })
  }

  const apiKey =
    (await getConfig("deepseek_key")) || process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      error: "Sin DeepSeek API key — guardá una en wa_bot_config.deepseek_key o seteá DEEPSEEK_API_KEY",
    })
  }

  let rawText: string
  try {
    rawText = await runTesseract(base64)
  } catch (err) {
    return res
      .status(502)
      .json({ error: `Tesseract falló: ${(err as Error).message}` })
  }

  if (!rawText || rawText.trim().length < 5) {
    return res.json({
      amount_usdt: null,
      amount_bs: null,
      amount_eur: null,
      currency_detected: null,
      merchant: null,
      expense_date: null,
      category_hint: null,
      category_id_suggested: null,
      description: "No se detectó texto en la imagen",
      confidence: "low",
      raw_notes: null,
      raw_ocr_text: rawText,
    })
  }

  let parsed: Partial<OcrResult> = {}
  try {
    parsed = await callDeepSeek(rawText, apiKey)
  } catch (err) {
    return res.status(502).json({
      error: `Parseo DeepSeek falló: ${(err as Error).message}`,
      raw_ocr_text: rawText,
    })
  }

  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const cats = await fin.listFinanzasExpenseCategories({ is_active: true })

  const result: OcrResult = {
    amount_usdt: parsed.amount_usdt ?? null,
    amount_bs: parsed.amount_bs ?? null,
    amount_eur: parsed.amount_eur ?? null,
    currency_detected: parsed.currency_detected ?? null,
    merchant: parsed.merchant ?? null,
    expense_date: parsed.expense_date ?? null,
    category_hint: parsed.category_hint ?? null,
    category_id_suggested: suggestCategoryId(parsed.category_hint ?? null, cats),
    description: parsed.description ?? null,
    confidence: parsed.confidence ?? "low",
    raw_notes: parsed.raw_notes ?? null,
    raw_ocr_text: rawText.slice(0, 2000),
  }
  res.json(result)
}
