/**
 * LLM Observability overview for DEV tab.
 *
 * Queries PostHog `$ai_generation` events via HogQL.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hogqlQuery, isAdminConfigured, getPosthogProjectUrl } from "../../../../../lib/posthog-admin-client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!isAdminConfigured()) {
    res.json({ configured: false })
    return
  }
  const days = Math.max(1, Math.min(90, parseInt(String(req.query.days || "7"), 10)))

  // Aggregate summary
  const summaryRes = await hogqlQuery(`
    SELECT
      count() AS calls,
      sum(toFloat(properties.$ai_total_cost_usd)) AS total_cost_usd,
      sum(toInt32(properties.$ai_total_tokens)) AS total_tokens,
      avg(toFloat(properties.$ai_latency)) AS avg_latency_s,
      countIf(properties.$ai_is_error = 'true') AS errors
    FROM events
    WHERE event = '$ai_generation'
      AND timestamp >= now() - INTERVAL ${days} DAY
  `)
  const summary = summaryRes?.results?.[0] || [0, 0, 0, 0, 0]

  // By model
  const byModelRes = await hogqlQuery(`
    SELECT
      properties.$ai_model AS model,
      count() AS calls,
      sum(toInt32(properties.$ai_input_tokens)) AS input_tokens,
      sum(toInt32(properties.$ai_output_tokens)) AS output_tokens,
      sum(toFloat(properties.$ai_total_cost_usd)) AS cost_usd
    FROM events
    WHERE event = '$ai_generation'
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY model
    ORDER BY cost_usd DESC
  `)

  // Daily cost series
  const seriesRes = await hogqlQuery(`
    SELECT
      toDate(timestamp) AS d,
      count() AS calls,
      sum(toFloat(properties.$ai_total_cost_usd)) AS cost_usd
    FROM events
    WHERE event = '$ai_generation'
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY d
    ORDER BY d
  `)

  // Top expensive conversations by distinct_id
  const topConvRes = await hogqlQuery(`
    SELECT
      distinct_id,
      count() AS calls,
      sum(toFloat(properties.$ai_total_cost_usd)) AS cost_usd,
      sum(toInt32(properties.$ai_total_tokens)) AS total_tokens,
      any(properties.purpose) AS purpose
    FROM events
    WHERE event = '$ai_generation'
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY distinct_id
    ORDER BY cost_usd DESC
    LIMIT 15
  `)

  res.json({
    configured: true,
    days,
    summary: {
      calls: Number(summary[0] || 0),
      total_cost_usd: Number(summary[1] || 0),
      total_tokens: Number(summary[2] || 0),
      avg_latency_s: Number(summary[3] || 0),
      errors: Number(summary[4] || 0),
    },
    by_model: (byModelRes?.results || []).map((r) => ({
      model: String(r[0] || "(unknown)"),
      calls: Number(r[1]),
      input_tokens: Number(r[2]),
      output_tokens: Number(r[3]),
      cost_usd: Number(r[4]),
    })),
    series: (seriesRes?.results || []).map((r) => ({
      date: String(r[0]),
      calls: Number(r[1]),
      cost_usd: Number(r[2]),
    })),
    top_conversations: (topConvRes?.results || []).map((r) => ({
      distinct_id: String(r[0]),
      calls: Number(r[1]),
      cost_usd: Number(r[2]),
      total_tokens: Number(r[3]),
      purpose: String(r[4] || ""),
    })),
    posthog_url: `${getPosthogProjectUrl()}/llm`,
  })
}
