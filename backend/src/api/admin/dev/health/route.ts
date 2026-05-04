/**
 * Services Health dashboard for DEV tab.
 *
 * Pings internal + external services in parallel, reports status + latency.
 * All checks have short timeouts; never blocks for >3s total.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const TIMEOUT_MS = 2500

async function pingHttp(url: string, opts: RequestInit = {}): Promise<{ ok: boolean; status: number | null; latency_ms: number; error?: string }> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - start }
  } catch (err: any) {
    return { ok: false, status: null, latency_ms: Date.now() - start, error: err?.name || String(err).slice(0, 60) }
  } finally {
    clearTimeout(timer)
  }
}

async function pingPostgres(): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 })
  const start = Date.now()
  try {
    await pool.query("SELECT 1")
    return { ok: true, latency_ms: Date.now() - start }
  } catch (err: any) {
    return { ok: false, latency_ms: Date.now() - start, error: err?.message || "err" }
  } finally {
    try { await pool.end() } catch {}
  }
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const checks = await Promise.all([
    (async () => ({ name: "medusa", kind: "internal", label: "Medusa API", ...(await pingHttp("http://localhost:9000/health")) }))(),
    (async () => ({ name: "storefront", kind: "internal", label: "Storefront (Next.js)", ...(await pingHttp("https://enrola.shop/")) }))(),
    (async () => ({ name: "umami", kind: "internal", label: "Umami analytics", ...(await pingHttp("https://analytics.enrola.shop/api/heartbeat")) }))(),
    (async () => ({ name: "postgres", kind: "internal", label: "PostgreSQL", ...(await pingPostgres()) }))(),
    // External APIs — quotas & reachability
    (async () => ({ name: "gsc", kind: "external", label: "Google Search Console API", ...(await pingHttp("https://searchconsole.googleapis.com/")) }))(),
    (async () => ({ name: "ga4", kind: "external", label: "Google Analytics Data API", ...(await pingHttp("https://analyticsdata.googleapis.com/")) }))(),
    (async () => ({ name: "crux", kind: "external", label: "Chrome UX Report API", ...(await pingHttp(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${process.env.CRUX_API_KEY || "missing"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin: "https://enrola.shop" }) })) }))(),
    (async () => ({ name: "posthog", kind: "external", label: "PostHog Cloud", ...(await pingHttp(`${process.env.POSTHOG_HOST || "https://us.i.posthog.com"}/decide/?v=3`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: process.env.POSTHOG_PROJECT_API_KEY || "", distinct_id: "health-check" }) })) }))(),
    (async () => ({ name: "clarity", kind: "external", label: "Microsoft Clarity", ...(await pingHttp("https://www.clarity.ms/tag/wfp9s5wh5i")) }))(),
    (async () => ({ name: "deepseek", kind: "external", label: "DeepSeek (WhatsApp bot LLM)", ...(await pingHttp("https://api.deepseek.com/")) }))(),
    (async () => ({ name: "resend", kind: "external", label: "Resend (emails)", ...(await pingHttp("https://api.resend.com/domains", { headers: { authorization: `Bearer ${process.env.RESEND_API_KEY || ""}` } })) }))(),
  ])

  const grouped = {
    internal: checks.filter((c) => c.kind === "internal"),
    external: checks.filter((c) => c.kind === "external"),
  }

  const summary = {
    total: checks.length,
    up: checks.filter((c) => c.ok).length,
    down: checks.filter((c) => !c.ok).length,
  }

  res.json({
    summary,
    checks: grouped,
    checked_at: new Date().toISOString(),
  })
}
