/**
 * GET    /admin/remarketing/rules            → list all rules with stats
 * POST   /admin/remarketing/rules            → upsert rule  (body: RemarketingRule)
 * POST   /admin/remarketing/rules  ?action=toggle  → toggle enabled (body: { key, enabled })
 * POST   /admin/remarketing/rules  ?action=delete  → delete rule   (body: { key })
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  listRules,
  upsertRule,
  deleteRule,
  setRuleEnabled,
  getRuleStats,
  getVariantStats,
  seedDefaultRulesIfMissing,
  type RemarketingRule,
} from "../../../../lib/remarketing-rules-db"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    await seedDefaultRulesIfMissing()
    const [rules, stats, variantStats] = await Promise.all([
      listRules(),
      getRuleStats(),
      getVariantStats(),
    ])
    const statsByKey: Record<string, any> = {}
    for (const s of stats) statsByKey[s.rule_key] = s
    const variantsByKey: Record<string, any[]> = {}
    for (const v of variantStats) {
      if (!variantsByKey[v.rule_key]) variantsByKey[v.rule_key] = []
      variantsByKey[v.rule_key].push(v)
    }
    res.json({
      rules: rules.map((r) => ({
        ...r,
        variant_stats: variantsByKey[r.key] || [],
        stats: statsByKey[r.key] || {
          rule_key: r.key,
          fires_total: 0,
          fires_24h: 0,
          fires_7d: 0,
          fires_30d: 0,
          sent: 0,
          failed: 0,
          converted: 0,
          conversion_rate: 0,
          revenue_attributed: 0,
        },
      })),
    })
  } catch (err) {
    console.error("[rules GET] error:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const action = String(req.query.action || "upsert")
  try {
    const body = req.body as any

    if (action === "toggle") {
      if (!body?.key || typeof body.enabled !== "boolean") {
        res.status(400).json({ error: "Missing key or enabled" })
        return
      }
      await setRuleEnabled(body.key, body.enabled)
      res.json({ success: true })
      return
    }

    if (action === "delete") {
      if (!body?.key) {
        res.status(400).json({ error: "Missing key" })
        return
      }
      await deleteRule(body.key)
      res.json({ success: true })
      return
    }

    // upsert
    const rule = body as RemarketingRule
    if (!rule?.key || !rule?.name) {
      res.status(400).json({ error: "Missing key or name" })
      return
    }
    if (!rule.match_signal_id && !rule.match_signal_prefix) {
      res.status(400).json({ error: "Must specify match_signal_id or match_signal_prefix" })
      return
    }
    await upsertRule({
      key: rule.key,
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled ?? false,
      priority: rule.priority ?? 0,
      cooldown_hours: rule.cooldown_hours ?? 48,
      channel: rule.channel ?? "auto",
      match_signal_id: rule.match_signal_id || null,
      match_signal_prefix: rule.match_signal_prefix || null,
      min_severity: rule.min_severity ?? "medium",
      email_subject_template: rule.email_subject_template || null,
      email_html_template: rule.email_html_template || null,
      whatsapp_template: rule.whatsapp_template || null,
      quiet_hours_start: rule.quiet_hours_start ?? null,
      quiet_hours_end: rule.quiet_hours_end ?? null,
      daily_cap: rule.daily_cap ?? null,
      variants: rule.variants ?? null,
      geo_overrides: rule.geo_overrides ?? null,
    })
    res.json({ success: true })
  } catch (err) {
    console.error("[rules POST] error:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}
