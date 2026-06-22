import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createWelcomeCoupon } from "../lib/welcome-coupon"

/**
 * Verificación en runtime del cupón de bienvenida.
 * Crea un cupón para el primer customer existente, imprime la config de la
 * promoción + campaña creadas y valida que coincide con el modelo pedido:
 *   - percentage 15, target items, max 1 unidad
 *   - rule customer.id eq <ese cliente>
 *   - campaña con ends_at ~48h + budget usage 1
 *
 * Correr:  npx medusa exec ./src/scripts/verify-welcome-coupon.ts
 */
export default async function verifyWelcomeCoupon({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const customerModule = container.resolve(Modules.CUSTOMER)
  const promotionModule = container.resolve(Modules.PROMOTION)

  const customers = await customerModule.listCustomers({}, { take: 1 })
  if (!customers.length) {
    logger.error("No hay customers para probar.")
    return
  }
  const customerId = customers[0].id
  logger.info(`Probando cupón para customer ${customerId} (${customers[0].email})`)

  const coupon = await createWelcomeCoupon(container, customerId)
  if (!coupon) {
    logger.error("❌ createWelcomeCoupon devolvió null — revisar logs de error arriba.")
    return
  }
  logger.info(`✓ Cupón creado: ${coupon.code} · ${coupon.percent}% · ${coupon.hours}h · expira ${coupon.expiresAt.toISOString()}`)

  const [promo] = await promotionModule.listPromotions(
    { code: coupon.code },
    { relations: ["application_method", "rules", "campaign", "campaign.budget"] }
  )
  if (!promo) {
    logger.error("❌ La promoción no aparece tras crearla.")
    return
  }
  const am = promo.application_method as Record<string, unknown> | undefined
  const rule = (promo.rules as Array<Record<string, unknown>> | undefined)?.[0]
  const camp = promo.campaign as Record<string, unknown> | undefined
  const budget = camp?.budget as Record<string, unknown> | undefined

  logger.info("── Config verificada ──")
  logger.info(`status: ${promo.status} (esperado: active)`)
  logger.info(`method: ${am?.type} ${am?.value} · target ${am?.target_type} · max_qty ${am?.max_quantity} (esperado: percentage 15 items 1)`)
  logger.info(`rule: ${rule?.attribute} ${rule?.operator} ${JSON.stringify(rule?.values)} (esperado: customer.id eq [${customerId}])`)
  logger.info(`campaign ends_at: ${camp?.ends_at} · budget: ${budget?.type} limit ${budget?.limit} (esperado: usage 1, ~48h)`)
}
