/**
 * Cron job: auto-post recurring expenses.
 *
 * Scans expense categories flagged as recurring (e.g. monthly rent, ISP,
 * services) and creates the corresponding `finanzas_expense` rows on the
 * 1st of each month so the operator doesn't have to remember to log them
 * manually.
 *
 * NOTE: this is a placeholder restored after the file was lost during the
 * initial GitHub-flow migration (PR #1). The implementation should iterate
 * over expense_category rows with `recurring=true`, check if an entry for
 * the current month already exists (idempotency), and if not insert one
 * via FinanzasService.createExpenses.
 *
 * TODO: implement using the finanzas service. Run on the 1st of each
 * month at 07:00 UTC (~03:00 VE) so totals are settled before the
 * operator checks the day's KPIs.
 */

import { ExecArgs } from "@medusajs/framework/types"

export default async function finanzasRecurringExpensesJob(_args: ExecArgs) {
  console.log("[finanzas-recurring-expenses] job triggered (stub — needs reimplementation)")
  return { ok: true, stub: true }
}

export const config = {
  name: "finanzas-recurring-expenses",
  // 1st of each month at 07:00 UTC.
  schedule: "0 7 1 * *",
}
