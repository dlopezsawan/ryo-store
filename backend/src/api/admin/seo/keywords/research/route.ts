/**
 * Research a keyword.
 * GET ?q=<keyword>&country=VE&fresh=0|1
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { researchKeyword } from "../../../../../lib/seo-kw-research"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = String(req.query.q || "").trim()
  if (!q) {
    res.status(400).json({ error: "Missing q parameter" })
    return
  }
  const country = String(req.query.country || "VE").toUpperCase()
  const forceFresh = String(req.query.fresh || "0") === "1"

  try {
    const result = await researchKeyword({ pool, keyword: q, country, forceFresh })
    res.json(result)
  } catch (err: any) {
    console.error("[seo/research]", err)
    res.status(500).json({ error: err?.message || "research failed" })
  }
}
