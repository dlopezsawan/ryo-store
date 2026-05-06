/**
 * Cedula → name verification via cedula.com.ve API.
 *
 * GET /api/checkout/verify-cedula?cedula=21028734
 *
 * Wraps the upstream `https://api.cedula.com.ve/api/v1` endpoint so we keep
 * credentials server-side (never shipped to the browser). The `nacionalidad`
 * is determined upstream by the cedula number — we just pass the number.
 *
 * Rate limiting: the API account has a 200-requests-per-hour quota. We track
 * the count in a rolling per-hour bucket. Once exhausted we silently return
 * `{ valid: null, reason: "rate_limited" }` until the next hour rolls over;
 * the UI degrades gracefully (shows nothing).
 *
 * Response shapes:
 *   { valid: true,  name: "DANIEL ANTONIO LOPEZ SAWAN", place?: "Carabobo, Valencia, San Jose" }
 *   { valid: false, reason: "not_found" }
 *   { valid: null,  reason: "rate_limited" | "service_unavailable" | "invalid_input" | "not_supported" }
 */

import { NextRequest, NextResponse } from "next/server"

const API_URL = "https://api.cedula.com.ve/api/v1"
const APP_ID = process.env.CEDULA_API_APP_ID || "2120"
const TOKEN = process.env.CEDULA_API_TOKEN || "c7cbea6bffe53d0b97debef1fb691e20"
const TIMEOUT_MS = 9000

// Local cache fallback — when the primary API is rate-limited or down, we hit
// our own Medusa-backed cache populated organically from previous successful
// lookups. Endpoint is protected by a shared internal secret.
// Medusa v2 also requires the publishable API key on all /store/* routes.
const MEDUSA_BASE = process.env.MEDUSA_BACKEND_URL || "http://medusa:9000"
const INTERNAL_SECRET = process.env.STOREFRONT_INTERNAL_SECRET || ""
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

// Per-hour rolling rate limit. The API allows 200/h; we set a slightly lower
// soft cap so other concurrent calls in the same node process don't push past.
const HOURLY_LIMIT = 195

interface RateBucket {
  windowStart: number  // epoch ms aligned to hour
  count: number
}

// Module-level state. Survives across requests within the same Next.js process.
// (Fine for a single-replica deployment; if scaled horizontally each replica
// gets its own bucket — could undercount but never exceed by a meaningful amount.)
const rate: RateBucket = { windowStart: 0, count: 0 }

function checkRateLimit(): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const hourMs = 3600_000
  const currentWindow = Math.floor(now / hourMs) * hourMs
  if (rate.windowStart !== currentWindow) {
    rate.windowStart = currentWindow
    rate.count = 0
  }
  if (rate.count >= HOURLY_LIMIT) {
    return { allowed: false, remaining: 0 }
  }
  rate.count++
  return { allowed: true, remaining: HOURLY_LIMIT - rate.count }
}

export const dynamic = "force-dynamic"

async function fetchFromCache(
  cedula: string
): Promise<{ name: string; place: string | null; source: string } | null> {
  if (!INTERNAL_SECRET) return null
  try {
    const r = await fetch(
      `${MEDUSA_BASE}/store/cedula-cache?cedula=${encodeURIComponent(cedula)}`,
      {
        headers: {
          "x-storefront-secret": INTERNAL_SECRET,
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
        signal: AbortSignal.timeout(4000),
      }
    )
    if (!r.ok) return null
    const data = (await r.json()) as { found: boolean; full_name?: string; place?: string | null; source?: string }
    if (!data.found || !data.full_name) return null
    return {
      name: data.full_name,
      place: data.place ?? null,
      source: data.source || "cache",
    }
  } catch {
    return null
  }
}

async function writeToCache(payload: {
  cedula: string
  nationality: string
  full_name: string
  place: string | null
}): Promise<void> {
  if (!INTERNAL_SECRET) return
  // Fire-and-forget — never block the user response on cache write
  fetch(`${MEDUSA_BASE}/store/cedula-cache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-storefront-secret": INTERNAL_SECRET,
      "x-publishable-api-key": PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4000),
  }).catch((err) => {
    console.warn("[verify-cedula] cache write failed:", (err as Error).message)
  })
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const cedulaRaw = (sp.get("cedula") || "").replace(/\D/g, "")
  // Allow caller to pass nacionalidad for client-side filtering, but the
  // upstream API auto-detects it from the cedula number itself. We use it
  // only to short-circuit unsupported types (e.g. RIF "J") locally.
  const nacionalidad = (sp.get("nacionalidad") || "V").toUpperCase()

  if (!cedulaRaw || cedulaRaw.length < 6 || cedulaRaw.length > 9) {
    return NextResponse.json({ valid: null, reason: "invalid_input" })
  }
  if (nacionalidad !== "V" && nacionalidad !== "E") {
    return NextResponse.json({ valid: null, reason: "not_supported" })
  }

  // Primary path is rate-limit gated. If exhausted, skip directly to cache.
  const limit = checkRateLimit()
  if (!limit.allowed) {
    console.warn("[verify-cedula] hourly quota exhausted — falling back to cache")
    const cached = await fetchFromCache(cedulaRaw)
    if (cached) {
      return NextResponse.json({ valid: true, name: cached.name, place: cached.place, source: "cache" })
    }
    return NextResponse.json({ valid: null, reason: "rate_limited" })
  }

  try {
    const url = `${API_URL}?app_id=${encodeURIComponent(APP_ID)}&token=${encodeURIComponent(
      TOKEN
    )}&cedula=${cedulaRaw}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    })

    if (!res.ok) {
      console.warn("[verify-cedula] upstream HTTP", res.status, "— falling back to cache")
      const cached = await fetchFromCache(cedulaRaw)
      if (cached) {
        return NextResponse.json({ valid: true, name: cached.name, place: cached.place, source: "cache" })
      }
      return NextResponse.json({ valid: null, reason: "service_unavailable" })
    }

    const body = (await res.json()) as
      | {
          error: false
          data: {
            nacionalidad?: string
            cedula?: number | string
            primer_nombre?: string
            segundo_nombre?: string
            primer_apellido?: string
            segundo_apellido?: string
            cne?: { estado?: string; municipio?: string; parroquia?: string }
          }
        }
      | { error: true; error_str?: string; data?: false }

    if (body.error) {
      const err = String((body as { error_str?: string }).error_str || "").toUpperCase()
      // Not-found vs other errors:
      if (
        err.includes("NOT_FOUND") ||
        err.includes("NO_DATA") ||
        err.includes("CEDULA_INVALIDA") ||
        err.includes("CEDULA_NO_VALIDA")
      ) {
        return NextResponse.json({ valid: false, reason: "not_found" })
      }
      console.warn("[verify-cedula] upstream error_str:", err, "— falling back to cache")
      const cached = await fetchFromCache(cedulaRaw)
      if (cached) {
        return NextResponse.json({ valid: true, name: cached.name, place: cached.place, source: "cache" })
      }
      return NextResponse.json({ valid: null, reason: "service_unavailable" })
    }

    const d = body.data
    if (!d || (!d.primer_nombre && !d.primer_apellido)) {
      return NextResponse.json({ valid: false, reason: "not_found" })
    }

    const name = [d.primer_nombre, d.segundo_nombre, d.primer_apellido, d.segundo_apellido]
      .filter(Boolean)
      .join(" ")
      .trim()
    const place = [d.cne?.estado, d.cne?.municipio, d.cne?.parroquia]
      .filter(Boolean)
      .join(", ") || null

    // Mirror to cache (fire-and-forget) so future failures degrade gracefully
    writeToCache({
      cedula: cedulaRaw,
      nationality: d.nacionalidad || nacionalidad,
      full_name: name,
      place,
    })

    return NextResponse.json({ valid: true, name, place })
  } catch (err) {
    console.error("[verify-cedula] error:", (err as Error).message, "— falling back to cache")
    const cached = await fetchFromCache(cedulaRaw)
    if (cached) {
      return NextResponse.json({ valid: true, name: cached.name, place: cached.place, source: "cache" })
    }
    return NextResponse.json({ valid: null, reason: "service_unavailable" })
  }
}
