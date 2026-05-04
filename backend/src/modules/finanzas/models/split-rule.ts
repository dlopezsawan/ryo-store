import { model } from "@medusajs/framework/utils"

/**
 * Split percentages of the *gross margin* (revenue − COGS) into buckets.
 * "restock" is NOT here because it's literal COGS, not a percentage.
 *
 * Invariant: rows with is_active=true must sum to 100.
 * Service.assertSplitRulesSumTo100() enforces this on writes.
 */
const FinanzasSplitRule = model.define("finanzas_split_rule", {
  id: model.id().primaryKey(),
  // "gastos_fijos" | "marketing" | "ganancia"
  bucket: model.text(),
  percentage: model.number(), // 0–100, integer percentage points
  description: model.text().nullable(),
  is_active: model.boolean().default(true),
})

export default FinanzasSplitRule
