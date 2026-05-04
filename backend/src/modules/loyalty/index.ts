import { Module } from "@medusajs/framework/utils"
import LoyaltyModuleService from "./service"

export const LOYALTY_MODULE = "loyaltyModuleService"

export default Module(LOYALTY_MODULE, {
  service: LoyaltyModuleService,
})
