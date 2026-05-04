import { Module } from "@medusajs/framework/utils"
import FinanzasModuleService from "./service"

export const FINANZAS_MODULE = "finanzasModuleService"

export default Module(FINANZAS_MODULE, {
  service: FinanzasModuleService,
})
