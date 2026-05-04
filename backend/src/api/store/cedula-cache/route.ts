/**
 * Internal endpoint used by the storefront's verify-cedula handler as a
 * fallback when the primary upstream (cedula.com.ve) is rate-limited or down.
 *
 * Protected by `x-storefront-secret` header so it can't be enumerated from
 * the public internet despite being mounted under /store/*. The secret is
 * shared via the STOREFRONT_INTERNAL_SECRET env var on both services.
 *
 *   GET  /store/cedula-cache?cedula=12345678
 *     → { found: true,  full_name, place, source, fetched_at }
 *     → { found: false }
 *
 *   POST /store/cedula-cache
 *     body: { cedula, nationality, full_name, place?, source? }
 *     → { ok: true }
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getCachedCedula, setCachedCedula } from "../../../lib/cedula-cache"

const SHARED_SECRET = process.env.STOREFRONT_INTERNAL_SECRET || ""

function authorized(req: MedusaRequest): boolean {
  if (!SHARED_SECRET) return false
  const got = req.headers["x-storefront-secret"]
  return typeof got === "string" && got === SHARED_SECRET
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!authorized(req)) {
    res.status(403).json({ error: "forbidden" })
    return
  }
  const cedulaRaw = String(req.query.cedula || "").replace(/\D/g, "")
  if (!cedulaRaw) {
    res.status(400).json({ error: "missing cedula" })
    return
  }
  try {
    const hit = await getCachedCedula(cedulaRaw)
    if (!hit) {
      res.json({ found: false })
      return
    }
    res.json({
      found: true,
      full_name: hit.full_name,
      place: hit.place,
      source: hit.source,
      fetched_at: hit.fetched_at,
    })
  } catch (err) {
    console.error("[cedula-cache GET]", (err as Error).message)
    res.status(500).json({ error: "internal" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!authorized(req)) {
    res.status(403).json({ error: "forbidden" })
    return
  }
  const body = (req.body as Record<string, unknown>) || {}
  const cedula = String(body.cedula || "")
  const nationality = String(body.nationality || "V")
  const full_name = String(body.full_name || "")
  const place = body.place ? String(body.place) : null
  const source = body.source ? String(body.source) : "cedula.com.ve"
  if (!cedula || !full_name) {
    res.status(400).json({ error: "missing cedula or full_name" })
    return
  }
  try {
    await setCachedCedula({ cedula, nationality, full_name, place, source })
    res.json({ ok: true })
  } catch (err) {
    console.error("[cedula-cache POST]", (err as Error).message)
    res.status(500).json({ error: "internal" })
  }
}
