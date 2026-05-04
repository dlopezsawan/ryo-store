import { model } from "@medusajs/framework/utils"

/**
 * Immutable monthly close. When a month is "cerrado", the service rejects any
 * mutation on entities whose `created_at` (or expense_date / converted_at)
 * fall inside the closed month — unless the request includes an explicit
 * `correction_note`, in which case it's recorded as a separate adjustment in
 * the audit log.
 *
 * Snapshot json captures the canonical totals at close time so future
 * recomputes can compare against the historical baseline.
 */
const FinanzasMonthClose = model.define("finanzas_month_close", {
  id: model.id().primaryKey(),
  // "YYYY-MM"
  month: model.text().unique(),
  closed_at: model.dateTime(),
  closed_by_user_id: model.text().nullable(),
  closed_by_email: model.text().nullable(),
  snapshot: model.json(),
  reopened_at: model.dateTime().nullable(),
  reopened_by_email: model.text().nullable(),
  reopen_reason: model.text().nullable(),
})

export default FinanzasMonthClose
