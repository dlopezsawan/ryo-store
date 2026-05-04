/**
 * Actionable keyword suggestions for Venezuela.
 * Combines striking-distance detection, local-intent queries, and brand gaps.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { generateSuggestions } from "../../../../../lib/seo-kw-research"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const items = await generateSuggestions(pool)
    // group by category for UI
    const byCategory = {
      striking_distance: items.filter((i) => i.category === "striking_distance"),
      local_intent: items.filter((i) => i.category === "local_intent"),
      brand_gap: items.filter((i) => i.category === "brand_gap"),
      rising_query: items.filter((i) => i.category === "rising_query"),
    }
    res.json({ total: items.length, by_category: byCategory, items })
  } catch (err: any) {
    console.error("[seo/suggestions]", err)
    res.status(500).json({ error: err?.message || "suggestions failed" })
  }
}
