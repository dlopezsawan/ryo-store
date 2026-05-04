import { model } from "@medusajs/framework/utils"

/**
 * One row per successful (or in-flight) referral relationship.
 *
 * Lifecycle:
 *   pending  → captured at order.placed but couldn't be awarded yet (rare)
 *   awarded  → both parties received their points
 *   rejected → blocked (self-referral, invalid code, customer already referred,
 *              not first purchase, etc) — kept for audit so the same code on a
 *              future cart can also be rejected idempotently
 */
const LoyaltyReferral = model.define("loyalty_referral", {
  id: model.id().primaryKey(),
  referrer_customer_id: model.text(),
  referee_customer_id: model.text(),
  referee_email: model.text().nullable(),
  code: model.text(),
  order_id: model.text().nullable(),
  status: model.text(), // pending | awarded | rejected
  rejected_reason: model.text().nullable(),
  referrer_points: model.number().default(0),
  referee_points: model.number().default(0),
  awarded_at: model.dateTime().nullable(),
})

export default LoyaltyReferral
