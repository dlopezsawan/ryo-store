/**
 * Google Analytics Data API (GA4) client — skeleton.
 * Full impl lands in Batch 5.
 */

import { getGoogleAccessToken, GOOGLE_SCOPES } from "./seo-google-auth"

const GA4_BASE = "https://analyticsdata.googleapis.com/v1beta"

export type Ga4ReportRow = {
  dimensionValues: Array<{ value: string }>
  metricValues: Array<{ value: string }>
}

export async function ga4RunReport(params: {
  propertyId: string
  startDate: string
  endDate: string
  dimensions: string[]
  metrics: string[]
  dimensionFilter?: unknown
  limit?: number
}): Promise<Ga4ReportRow[]> {
  const token = await getGoogleAccessToken(GOOGLE_SCOPES.ANALYTICS)
  if (!token) return []

  const url = `${GA4_BASE}/properties/${params.propertyId}:runReport`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      dimensions: params.dimensions.map((name) => ({ name })),
      metrics: params.metrics.map((name) => ({ name })),
      dimensionFilter: params.dimensionFilter,
      limit: params.limit ?? 10000,
    }),
  })

  if (!res.ok) {
    console.error("[ga4] runReport failed:", res.status, await res.text())
    return []
  }
  const data = (await res.json()) as { rows?: Ga4ReportRow[] }
  return data.rows ?? []
}
