import { model } from "@medusajs/framework/utils"

/**
 * Immutable audit log of every mutation on finanzas entities. Used for
 * compliance and "who did what" traceability — never deleted, never updated.
 */
const FinanzasAuditLog = model.define("finanzas_audit_log", {
  id: model.id().primaryKey(),
  // e.g. "pago_movil" | "conversion" | "expense" | "split_rule" | "product_cost" | "wallet" | "transfer"
  entity_type: model.text(),
  entity_id: model.text(),
  // "create" | "update" | "delete" | "recompute" | "transfer"
  action: model.text(),
  before: model.json().nullable(),
  after: model.json().nullable(),
  user_id: model.text().nullable(),
  user_email: model.text().nullable(),
  note: model.text().nullable(),
  at: model.dateTime(),
})

export default FinanzasAuditLog
