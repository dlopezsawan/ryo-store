import { model } from "@medusajs/framework/utils"

/**
 * Categories for outgoing expenses. Each maps to a bucket so the dashboard
 * can show "we budgeted X in marketing this month, we spent Y".
 *
 * Recurring entries (alquiler, suscripciones, sueldos) define a target
 * monthly amount; a job/cron could materialize them but for v1 the user
 * registers actuals manually.
 */
const FinanzasExpenseCategory = model.define("finanzas_expense_category", {
  id: model.id().primaryKey(),
  name: model.text(),
  // gastos_fijos | marketing | restock | comisiones_pago | envios | otros
  bucket: model.text(),
  description: model.text().nullable(),

  is_recurring: model.boolean().default(false),
  recurring_amount_usdt: model.number().nullable(),  // monthly budget
  recurring_day_of_month: model.number().nullable(), // 1–28
  is_active: model.boolean().default(true),
})

export default FinanzasExpenseCategory
