/**
 * CrUX sync — fetches field Core Web Vitals for a set of key URLs.
 *
 * CrUX has a 28-day rolling window; data updates daily but with ~2d lag.
 * Thresholds (Google):
 *   LCP  ≤ 2500ms good  / ≤ 4000ms needs improvement
 *   INP  ≤ 200ms  good  / ≤ 500ms  needs improvement
 *   CLS  ≤ 0.1    good  / ≤ 0.25   needs improvement
 */

import { Pool } from "pg"
import { randomUUID } from "crypto"
import { cruxQuery, CruxRecord } from "./seo-crux-client"

const DEFAULT_URLS = [
  "https://enrola.shop/",
  "https://enrola.shop/tienda",
  "https://enrola.shop/arma-tu-combo",
  "https://enrola.shop/contacto",
  "https://enrola.shop/productos/papel-sabores-alien-puff",
]

const FORM_FACTORS: Array<"PHONE" | "DESKTOP"> = ["PHONE", "DESKTOP"]

export type CwvStatus = "good" | "needs_improvement" | "poor" | "no_data"

export function classifyLcp(ms: number | null): CwvStatus {
  if (ms == null) return "no_data"
  if (ms <= 2500) return "good"
  if (ms <= 4000) return "needs_improvement"
  return "poor"
}
export function classifyInp(ms: number | null): CwvStatus {
  if (ms == null) return "no_data"
  if (ms <= 200) return "good"
  if (ms <= 500) return "needs_improvement"
  return "poor"
}
export function classifyCls(v: number | null): CwvStatus {
  if (v == null) return "no_data"
  if (v <= 0.1) return "good"
  if (v <= 0.25) return "needs_improvement"
  return "poor"
}

function pickP75(metric: any): number | null {
  const v = metric?.percentiles?.p75
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function syncCwvForUrl(params: {
  pool: Pool
  url: string
  formFactor: "PHONE" | "DESKTOP"
}): Promise<{ url: string; formFactor: string; stored: boolean }> {
  const record: CruxRecord | null = await cruxQuery({
    url: params.url,
    formFactor: params.formFactor,
  })

  const m = record?.metrics
  const lcp = pickP75(m?.largest_contentful_paint)
  const inp = pickP75(m?.interaction_to_next_paint)
  const cls = pickP75(m?.cumulative_layout_shift)
  const ttfb = pickP75(m?.experimental_time_to_first_byte)

  if (lcp == null && inp == null && cls == null) {
    return { url: params.url, formFactor: params.formFactor, stored: false }
  }

  const today = new Date().toISOString().slice(0, 10)
  // Idempotent per (date, url, device)
  await params.pool.query(
    `DELETE FROM seo_cwv_snapshot WHERE date = $1 AND url = $2 AND device = $3`,
    [today, params.url, params.formFactor]
  )
  await params.pool.query(
    `INSERT INTO seo_cwv_snapshot (id, date, url, device, lcp_p75, inp_p75, cls_p75, ttfb_p75)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [randomUUID(), today, params.url, params.formFactor, lcp, inp, cls, ttfb]
  )
  return { url: params.url, formFactor: params.formFactor, stored: true }
}

export async function syncAllCwv(pool: Pool, urls: string[] = DEFAULT_URLS) {
  const results: Array<{ url: string; formFactor: string; stored: boolean }> = []
  for (const url of urls) {
    for (const ff of FORM_FACTORS) {
      try {
        const r = await syncCwvForUrl({ pool, url, formFactor: ff })
        results.push(r)
      } catch (err) {
        console.error(`[cwv-sync] ${url} ${ff}:`, err)
        results.push({ url, formFactor: ff, stored: false })
      }
    }
  }
  const ok = results.filter((r) => r.stored).length
  console.log(`[cwv-sync] ${ok}/${results.length} (url, device) pairs stored`)
  return results
}

export function getDefaultCwvUrls(): string[] {
  return [...DEFAULT_URLS]
}
