import { model } from "@medusajs/framework/utils"

const LoyaltyTransaction = model.define("loyalty_transaction", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  points: model.number(),
  type: model.text(),
  order_id: model.text().nullable(),
  reward_id: model.text().nullable(),
  description: model.text().nullable(),
})

export default LoyaltyTransaction
