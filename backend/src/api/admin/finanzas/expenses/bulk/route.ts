/**
 * POST /admin/finanzas/expenses/bulk
 *   body: { ids: string[], action: "delete" | "mark_paid", correction_note?: string }
 *
 * Performs the action atomically per row, but reports per-row outcome so the
 * UI can highlight failures (e.g. closed-month gate hits).
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../modules/finanzas"

type Outcome = { id: string; ok: boolean; error?: string }

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as {
    ids?: string[]
    action?: "delete" | "mark_paid"
    correction_note?: string
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return res.status(400).json({ error: "ids[] required" })
  }
  if (body.action !== "delete" && body.action !== "mark_paid") {
    return res.status(400).json({ error: "action must be 'delete' or 'mark_paid'" })
  }

  const results: Outcome[] = []
  for (const id of body.ids) {
    try {
      const e = await fin.retrieveFinanzasExpense(id).catch(() => null)
      if (!e) {
        results.push({ id, ok: false, error: "not_found" })
        continue
      }
      await fin.assertNotClosedOrCorrection(e.expense_date, body.correction_note ?? null)

      if (body.action === "delete") {
        await fin.reverseEntriesBySource("expense", id)
        await fin.deleteFinanzasExpenses(id)
        await fin.recordAudit({
          entity_type: "expense",
          entity_id: id,
          action: "delete",
          before: e as unknown as Record<string, unknown>,
          note: body.correction_note ?? "bulk delete",
        })
      } else if (body.action === "mark_paid") {
        if (e.status === "paid") {
          results.push({ id, ok: true, error: "already_paid" })
          continue
        }
        const walletId =
          e.paid_from_wallet_id ||
          (await fin.getDefaultWalletForCurrency("usdt"))?.id ||
          null
        await fin.updateFinanzasExpenses({
          id,
          status: "paid",
          paid_from_wallet_id: walletId,
        })
        if (walletId) {
          await fin.writeWalletEntry({
            wallet_id: walletId,
            amount: -Math.abs(Number(e.amount_usdt)),
            currency: "usdt",
            source_type: "expense",
            source_id: id,
            note: e.description,
            entry_at: new Date(e.expense_date),
          })
        }
        await fin.recordAudit({
          entity_type: "expense",
          entity_id: id,
          action: "update",
          before: { status: e.status },
          after: { status: "paid", paid_from_wallet_id: walletId },
          note: "bulk mark paid",
        })
      }
      results.push({ id, ok: true })
    } catch (err) {
      results.push({ id, ok: false, error: (err as Error).message })
    }
  }

  const succeeded = results.filter((r) => r.ok).length
  res.json({
    action: body.action,
    succeeded,
    failed: results.length - succeeded,
    results,
  })
}
