import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

/**
 * Tasa BCV oficial (USD/EUR ↔ VES) actualizada.
 *
 * Fuente primaria: ve.dolarapi.com (API pública, clean JSON)
 *   GET https://ve.dolarapi.com/v1/dolares/oficial  → USD oficial BCV
 *   GET https://ve.dolarapi.com/v1/euros/oficial    → EUR oficial BCV
 *
 * Fallback: pydolarve.org (la fuente original; suele estar online pero a
 * veces el DNS resuelve mal desde algunas redes).
 *
 * Cacheado 10 min en server para no martillar los providers.
 *
 * Resp: { ok, rate_usd_ves, rate_eur_ves, last_update, source, paralelo? }
 */

interface BcvPayload {
  rate_usd_ves: number
  rate_eur_ves: number
  /** Tasa paralelo (referencia, NO usada para precios). Útil para indicar gap al usuario. */
  rate_usd_ves_paralelo?: number
  last_update: string
  source: string
}

let cache: { fetched_at: number; payload: BcvPayload } | null = null
const TTL_MS = 10 * 60 * 1000

interface DolarapiRate {
  moneda: string
  fuente: string
  promedio: number
  fechaActualizacion: string
}

async function fromDolarapi(): Promise<BcvPayload | null> {
  try {
    const [usdRes, eurRes, paraleloRes] = await Promise.all([
      fetch("https://ve.dolarapi.com/v1/dolares/oficial", { cache: "no-store", signal: AbortSignal.timeout(6000) }),
      fetch("https://ve.dolarapi.com/v1/euros/oficial", { cache: "no-store", signal: AbortSignal.timeout(6000) }),
      fetch("https://ve.dolarapi.com/v1/dolares/paralelo", { cache: "no-store", signal: AbortSignal.timeout(6000) }).catch(() => null),
    ])
    if (!usdRes.ok) return null
    const usd = (await usdRes.json()) as DolarapiRate
    const usdPrice = Number(usd.promedio) || 0
    if (!usdPrice) return null

    let eurPrice = 0
    if (eurRes.ok) {
      const eur = (await eurRes.json()) as DolarapiRate
      eurPrice = Number(eur.promedio) || 0
    }

    let paralelo = 0
    if (paraleloRes && paraleloRes.ok) {
      try {
        const p = (await paraleloRes.json()) as DolarapiRate
        paralelo = Number(p.promedio) || 0
      } catch { /* ignore */ }
    }

    return {
      rate_usd_ves: usdPrice,
      rate_eur_ves: eurPrice || +(usdPrice * 1.08).toFixed(4),
      rate_usd_ves_paralelo: paralelo || undefined,
      last_update: usd.fechaActualizacion,
      source: "ve.dolarapi.com · BCV oficial",
    }
  } catch {
    return null
  }
}

async function fromPydolarve(): Promise<BcvPayload | null> {
  try {
    const res = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv", {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      monitors?: {
        usd?: { price?: number; last_update?: string }
        eur?: { price?: number; last_update?: string }
      }
      datetime?: { date?: string; time?: string }
    }
    const usdPrice = data.monitors?.usd?.price ?? 0
    if (!usdPrice) return null
    const eurPrice = data.monitors?.eur?.price ?? 0
    const lastUpd =
      data.monitors?.usd?.last_update ??
      `${data.datetime?.date ?? ""} ${data.datetime?.time ?? ""}`.trim()
    return {
      rate_usd_ves: usdPrice,
      rate_eur_ves: eurPrice || +(usdPrice * 1.08).toFixed(4),
      last_update: lastUpd || new Date().toISOString(),
      source: "pydolarve.org · BCV",
    }
  } catch {
    return null
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })

  if (cache && Date.now() - cache.fetched_at < TTL_MS) {
    return NextResponse.json({ ok: true, ...cache.payload, cached: true })
  }

  const payload = (await fromDolarapi()) ?? (await fromPydolarve())
  if (!payload) {
    // Si tenemos cache stale, devolverlo en vez de romper la UI
    if (cache) {
      return NextResponse.json({ ok: true, ...cache.payload, stale: true })
    }
    return NextResponse.json({ ok: false, error: "no provider available" }, { status: 502 })
  }

  cache = { fetched_at: Date.now(), payload }
  return NextResponse.json({ ok: true, ...payload, cached: false })
}
