import { model } from "@medusajs/framework/utils"

/**
 * One row per customer. Holds the canonical, immutable referral code we hand
 * out to that customer. Codes are deterministic from customer_id, but stored
 * so we can look up by code in O(1) without scanning customers.
 */
const LoyaltyReferralCode = model.define("loyalty_referral_code", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  code: model.text(),
})

export default LoyaltyReferralCode
