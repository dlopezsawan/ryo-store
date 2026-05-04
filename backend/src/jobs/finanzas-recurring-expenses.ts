/**
 * Cron job: auto-post recurring expenses for the current month.
 *
 * For every active expense category flagged `is_recurring=true`:
 * - Check if a finanzas_expense already exists for the current month
 *   (idempotent via auto_generated_for_month)
 * - If none, and today is on or past the category's recurring_day_of_month,
 *   create one with status="pending_payment" so the operator can mark it
 *   paid when the actual transfer happens.
 *
 * The intent is: the operator never has to remember to log the rent, the
 * ISP, the BC payroll, the SaaS subscriptions — they materialize as
 * pending entries on the right day of every month and the operator just
 * confirms paid + attaches the receipt.
 *
 * Schedule: 07:00 UTC every day. Daily (not monthly) because:
 * - some categories use day_of_month=15 etc. — running monthly on the 1st
 *   would never create those
 * - daily is cheap (a quick listing + create) and self-correcting if a run
 *   was missed (e.g. VPS reboot on the day-of-month)
 */

import { ExecArgs } from "@medusajs/framework/types"
import FinanzasModuleService from "../modules/finanzas/service"
import { FINANZAS_MODULE } from "../modules/finanzas"

function currentMonthYYYYMM(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export default async function finanzasRecurringExpensesJob({ container }: ExecArgs) {
  const log = (msg: string) => console.log(`[finanzas-recurring-expenses] ${msg}`)

  const fin = container.resolve(FINANZAS_MODULE) as FinanzasModuleService
  const month = currentMonthYYYYMM()
  const today = new Date()
  const dayOfMonth = today.getUTCDate()

  // Pull only categories that opted into recurring auto-posting
  const categories = await fin.listFinanzasExpenseCategories({
    is_recurring: true,
    is_active: true,
  })

  if (categories.length === 0) {
    log("no recurring categories configured — nothing to do")
    return { ok: true, created: 0, scanned: 0 }
  }

  let created = 0
  let skipped = 0
  let waiting = 0

  for (const cat of categories) {
    // Don't post before the configured day of month (default 1)
    const targetDay = cat.recurring_day_of_month ?? 1
    if (dayOfMonth < targetDay) {
      waiting++
      continue
    }

    // Idempotency: did we already post this month?
    const existing = await fin.listFinanzasExpenses({
      category_id: cat.id,
      auto_generated_for_month: month,
    })
    if (existing.length > 0) {
      skipped++
      continue
    }

    // Default amount comes from the category's recurring_amount_usdt;
    // if not set, we still post a $0 placeholder so the operator can
    // edit it inline (better than missing the entry entirely).
    const amount = Number(cat.recurring_amount_usdt) || 0

    await fin.createFinanzasExpenses({
      category_id: cat.id,
      description: `${cat.name} — ${month} (recurrente)`,
      amount_usdt: amount,
      amount_bs: null,
      rate_bs_per_usdt: null,
      paid_from_wallet_id: null,
      receipt_url: null,
      expense_date: today,
      notes: "Generado automáticamente por el cron de gastos recurrentes. Marcar como pagado cuando se haga la transferencia + adjuntar comprobante.",
      status: "pending_payment",
      auto_generated_for_month: month,
    })

    created++
    log(`✓ created pending expense for "${cat.name}" — $${amount} USDT (day ${targetDay} of month)`)
  }

  log(`done — month=${month}, scanned=${categories.length}, created=${created}, skipped(already)=${skipped}, waiting(future-day)=${waiting}`)

  return {
    ok: true,
    month,
    scanned: categories.length,
    created,
    skipped_already_exists: skipped,
    waiting_for_target_day: waiting,
  }
}

export const config = {
  name: "finanzas-recurring-expenses",
  // 07:00 UTC daily. Runs early enough that the operator's morning Finanzas
  // check shows freshly-materialized entries.
  schedule: "0 7 * * *",
}
