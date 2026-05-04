/**
 * GET /admin/finanzas/reports/docx?month=YYYY-MM
 *
 * Downloads the monthly financial report as a Word .docx attachment.
 * Powered by `lib/finanzas-docx.generateMonthlyDocx`.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { generateMonthlyDocx } from "../../../../../lib/finanzas-docx"

function defaultMonth(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const month =
    typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : defaultMonth()

  try {
    const buffer = await generateMonthlyDocx(month)
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="enrola-finanzas-${month}.docx"`
    )
    res.setHeader("Content-Length", String(buffer.length))
    res.end(buffer)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}
