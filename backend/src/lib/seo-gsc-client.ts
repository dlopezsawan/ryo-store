/**
 * Google Search Console API client (skeleton — full impl lands in Batch 2).
 */

import { getGoogleAccessToken, GOOGLE_SCOPES } from "./seo-google-auth"

const GSC_BASE = "https://searchconsole.googleapis.com/webmasters/v3"

export type GscQueryRow = {
  keys: string[]
  impressions: number
  clicks: number
  ctr: number
  position: number
}

export async function gscSearchAnalytics(params: {
  siteUrl: string
  startDate: string
  endDate: string
  dimensions: Array<"query" | "page" | "country" | "device" | "date">
  rowLimit?: number
  startRow?: number
  dimensionFilterGroups?: unknown[]
}): Promise<GscQueryRow[]> {
  const token = await getGoogleAccessToken(GOOGLE_SCOPES.WEBMASTERS)
  if (!token) return []

  const url = `${GSC_BASE}/sites/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions,
      rowLimit: params.rowLimit ?? 25000,
      startRow: params.startRow ?? 0,
      dimensionFilterGroups: params.dimensionFilterGroups,
    }),
  })

  if (!res.ok) {
    console.error("[gsc] searchAnalytics failed:", res.status, await res.text())
    return []
  }
  const data = (await res.json()) as { rows?: GscQueryRow[] }
  return data.rows ?? []
}
