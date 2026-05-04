import { model } from "@medusajs/framework/utils"

/**
 * Threaded comments per entity. `entity_type` matches the audit_log values
 * ("pago_movil", "expense", "conversion", "transfer", "product_cost"…). The
 * UI renders the thread inline next to the row.
 *
 * @mentions are stored as plain emails inside `body`; resolution is
 * client-side. Future: dedicated mention table for notifications.
 */
const FinanzasComment = model.define("finanzas_comment", {
  id: model.id().primaryKey(),
  entity_type: model.text(),
  entity_id: model.text(),
  body: model.text(),
  author_id: model.text().nullable(),
  author_email: model.text().nullable(),
  resolved_at: model.dateTime().nullable(),
})

export default FinanzasComment
