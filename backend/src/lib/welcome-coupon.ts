/**
 * Cupón de bienvenida — ÚNICO por cliente.
 *
 * Modelo (definido por el negocio):
 *  - 15% de descuento sobre 1 producto del carrito (cualquier producto, 1 unidad).
 *  - Solo lo puede usar ESE cliente (rule customer.id eq) → "1 por cliente" real.
 *  - 1 uso total (campaign budget usage=1) + caduca a las 48h (campaign ends_at).
 *
 * Cada llamada crea una campaña + una promoción con código único y la liga al
 * cliente. Se invoca desde el subscriber de bienvenida (customer.created).
 */

import { createPromotionsWorkflow, createCampaignsWorkflow } from "@medusajs/medusa/core-flows"

export const WELCOME_DISCOUNT_PERCENT = 15
export const WELCOME_EXPIRES_HOURS = 48

// Alfabeto sin caracteres ambiguos (0/O, 1/I) para que el código sea fácil de tipear.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomCode(): string {
  let s = ""
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return `BIENVENIDA-${s}`
}

export interface WelcomeCoupon {
  code: string
  percent: number
  hours: number
  expiresAt: Date
}

/**
 * Crea el cupón de bienvenida para un cliente. Devuelve el cupón o null si falla
 * (en cuyo caso el subscriber manda la bienvenida sin cupón, sin romperse).
 */
export async function createWelcomeCoupon(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  container: any,
  customerId: string
): Promise<WelcomeCoupon | null> {
  try {
    const code = randomCode()
    const now = Date.now()
    const expiresAt = new Date(now + WELCOME_EXPIRES_HOURS * 3600 * 1000)

    // Campaña: caducidad (ends_at) + límite de 1 uso (budget usage).
    const { result: campaigns } = await createCampaignsWorkflow(container).run({
      input: {
        campaignsData: [
          {
            name: `Bienvenida ${code}`,
            campaign_identifier: code,
            starts_at: new Date(now),
            ends_at: expiresAt,
            budget: { type: "usage", limit: 1 },
          },
        ],
      },
    })
    const campaign = campaigns?.[0]
    if (!campaign?.id) {
      console.error("[welcome-coupon] no se pudo crear la campaña")
      return null
    }

    // Promoción: 15% sobre 1 producto (cualquiera), atada a ESTE cliente.
    const { result: promos } = await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code,
            type: "standard",
            status: "active",
            is_automatic: false,
            campaign_id: campaign.id,
            application_method: {
              type: "percentage",
              target_type: "items",
              allocation: "each",
              value: WELCOME_DISCOUNT_PERCENT,
              apply_to_quantity: 1,
              max_quantity: 1,
            },
            rules: [
              {
                attribute: "customer.id",
                operator: "eq",
                values: [customerId],
              },
            ],
          },
        ],
      },
    })

    if (!promos?.[0]) {
      console.error("[welcome-coupon] no se pudo crear la promoción")
      return null
    }

    return { code, percent: WELCOME_DISCOUNT_PERCENT, hours: WELCOME_EXPIRES_HOURS, expiresAt }
  } catch (e) {
    console.error("[welcome-coupon] creación falló:", e)
    return null
  }
}

/** Texto corto y claro de las condiciones del cupón (para WhatsApp/email). */
export function welcomeCouponConditions(c: WelcomeCoupon): string {
  return `${c.percent}% de descuento en 1 producto de tu carrito · solo para ti · 1 uso · válido ${c.hours}h`
}
