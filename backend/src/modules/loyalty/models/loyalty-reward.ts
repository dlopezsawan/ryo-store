import { model } from "@medusajs/framework/utils"

const LoyaltyReward = model.define("loyalty_reward", {
  id: model.id().primaryKey(),
  name: model.text(),
  description: model.text().nullable(),
  points_required: model.number(),
  image_url: model.text().nullable(),
  is_active: model.boolean().default(true),
  stock: model.number().nullable(),
})

export default LoyaltyReward
