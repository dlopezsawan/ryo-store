import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { getStats, getAllSettings, updateSetting } from "../../../lib/remarketing-db"
import {
  sendEmail,
  welcomeEmailHtml,
  birthdayEmailHtml,
  winBackEmailHtml,
  abandonedCartEmailHtml,
  postPurchaseEmailHtml,
  restockEmailHtml,
  graduationEmailHtml,
  pendingPaymentEmailHtml,
  stockoutAlertEmailHtml,
} from "../../../lib/email-service"

const STORE_URL = process.env.STORE_URL || "https://enrola.shop"

const DEFAULT_CAMPAIGN_KEYS = [
  "welcome",
  "abandoned_cart",
  "birthday",
  "win_back",
  "post_purchase",
  "restock",
  "graduation",
  "pending_payment",
  "stockout_alert",
]

/**
 * GET /admin/remarketing
 * Returns stats + all settings + products list
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    const [stats, settings, productsResult] = await Promise.all([
      getStats(),
      getAllSettings(),
      pool.query(
        `SELECT id, title, handle, thumbnail
         FROM product
         WHERE deleted_at IS NULL AND status = 'published'
         ORDER BY title ASC`
      ),
    ])

    await pool.end()

    // Merge in default entries for any campaign type missing from the DB,
    // so newly-introduced campaigns (e.g. graduation) render in the admin UI
    // before the user saves them for the first time.
    const existingKeys = new Set(settings.map(s => s.key))
    const mergedSettings = [
      ...settings,
      ...DEFAULT_CAMPAIGN_KEYS
        .filter(k => !existingKeys.has(k))
        .map(k => ({ key: k, value: { enabled: true } })),
    ]

    return res.json({ stats, settings: mergedSettings, products: productsResult.rows })
  } catch (err: any) {
    console.error("[admin/remarketing] GET error:", err)
    return res.status(500).json({ error: err.message })
  }
}

/**
 * POST /admin/remarketing
 * Actions:
 *   - update_setting: { key, value }
 *   - save_crosssell: { map: { productId: productId[] } }
 *   - test_email:     { type, to }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as any

  // ── Update remarketing setting ─────────────────────────────────────────────
  if (body.action === "update_setting") {
    const { key, value } = body
    if (!key || value === undefined) {
      return res.status(400).json({ error: "key and value required" })
    }
    await updateSetting(key, value)
    return res.json({ success: true })
  }

  // ── Save cross-sell map ────────────────────────────────────────────────────
  if (body.action === "save_crosssell") {
    const { map } = body
    if (!map || typeof map !== "object") {
      return res.status(400).json({ error: "map required" })
    }
    await updateSetting("crosssell_map", { map })
    return res.json({ success: true })
  }

  // ── Test email ─────────────────────────────────────────────────────────────
  if (body.action === "test_email") {
    const { type, to } = body
    if (!to) return res.status(400).json({ error: "to required" })

    let subject = ""
    let html = ""
    const testName = "Amigo/a Enrola"

    switch (type) {
      case "welcome":
        subject = "¡Bienvenido/a al Club Enrola! 🎉 [TEST]"
        html = welcomeEmailHtml(testName)
        break
      case "birthday":
        subject = "¡Feliz cumpleaños! 🎂 [TEST]"
        html = birthdayEmailHtml(testName, "CUMPLE15", 15)
        break
      case "win_back":
        subject = "¡Te echamos de menos! 👋 [TEST]"
        html = winBackEmailHtml(testName, "TEVEMOS20", 20, 75)
        break
      case "abandoned_cart":
        subject = "Dejaste algo en el carrito 🛒 [TEST]"
        html = abandonedCartEmailHtml(
          testName,
          [
            { title: "Tabaco Virginia Gold 50g", quantity: 2, unit_price: 12 },
            { title: "Papel OCB Organic King Size", quantity: 1, unit_price: 3.5 },
          ],
          27.5,
          `${STORE_URL}/carrito`
        )
        break
      case "post_purchase":
        subject = "¿Cómo fue tu pedido? 📦 [TEST]"
        html = postPurchaseEmailHtml(testName, "1234", [
          { title: "Tabaco Virginia Gold 50g", quantity: 1 },
        ])
        break
      case "restock":
        subject = "¿Ya se te acabó tu producto? 🔥 [TEST]"
        html = restockEmailHtml(
          testName,
          "Tabaco Virginia Gold 50g",
          `${STORE_URL}/productos/tabaco-virginia-gold`,
          [
            { title: "Papel OCB Organic King Size", url: `${STORE_URL}/productos/papel-ocb` },
            { title: "Filtros de Cartón Raw", url: `${STORE_URL}/productos/filtros-raw` },
          ]
        )
        break
      case "graduation":
        subject = "🎓 Tu descuento exclusivo web [TEST]"
        html = graduationEmailHtml(testName, "WEB20", 20)
        break
      case "pending_payment":
        subject = "⏳ Pedido pendiente de pago [TEST]"
        html = pendingPaymentEmailHtml(testName, "1234", 42.5, 6)
        break
      case "stockout_alert":
        subject = "⚠ Último stock de Tabaco Virginia Gold [TEST]"
        html = stockoutAlertEmailHtml(
          testName,
          "Tabaco Virginia Gold 50g",
          `${STORE_URL}/productos/tabaco-virginia-gold`,
          4
        )
        break
      default:
        return res.status(400).json({ error: "Unknown email type" })
    }

    const sent = await sendEmail({ to, subject, html })
    return res.json({ success: sent, to, type })
  }

  return res.status(400).json({ error: "Unknown action" })
}
