import { model } from "@medusajs/framework/utils"

/**
 * Per-user finanzas role. Only users in this table can do anything beyond
 * GET. Default for authenticated admin users without an entry: "admin".
 *
 * Roles:
 *   - admin     full access (defaults for owner)
 *   - contador  read + export, no mutations
 *   - operario  can register expenses, can view own data, no closes/configs
 */
const FinanzasUserRole = model.define("finanzas_user_role", {
  id: model.id().primaryKey(),
  user_id: model.text().unique(),
  user_email: model.text().nullable(),
  role: model.text(), // "admin" | "contador" | "operario"
  granted_by: model.text().nullable(),
})

export default FinanzasUserRole
