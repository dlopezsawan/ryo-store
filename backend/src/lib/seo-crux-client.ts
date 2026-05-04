/**
 * Chrome UX Report API client — field Core Web Vitals.
 * API key auth (not service account).
 * Full impl in Batch 6.
 */

const CRUX_URL = "https://chromeuxreport.googleapis.com/v1/records:queryRecord"

export type CruxMetric = { percentiles?: { p75: number | string } }

export type CruxRecord = {
  metrics?: {
    largest_contentful_paint?: CruxMetric
    interaction_to_next_paint?: CruxMetric
    cumulative_layout_shift?: CruxMetric
    experimental_time_to_first_byte?: CruxMetric
  }
}

export async function cruxQuery(params: {
  url?: string
  origin?: string
  formFactor?: "PHONE" | "DESKTOP" | "TABLET"
}): Promise<CruxRecord | null> {
  const key = process.env.CRUX_API_KEY
  if (!key) {
    console.warn("[crux] No CRUX_API_KEY configured")
    return null
  }

  const res = await fetch(`${CRUX_URL}?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: params.url,
      origin: params.origin,
      formFactor: params.formFactor,
    }),
  })

  if (!res.ok) {
    // 404 is normal when URL has insufficient data
    if (res.status !== 404) {
      console.error("[crux] queryRecord failed:", res.status, await res.text())
    }
    return null
  }
  const data = (await res.json()) as { record?: CruxRecord }
  return data.record ?? null
}
