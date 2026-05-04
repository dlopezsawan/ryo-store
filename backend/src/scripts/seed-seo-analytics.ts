/**
 * Seed SEO Analytics with:
 *   - 10 competitors from 2026-04-21 análisis
 *   - 10 starter keywords Venezuela
 *
 * Run: npx medusa exec ./src/scripts/seed-seo-analytics.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { SEO_ANALYTICS_MODULE } from "../modules/seo-analytics"

const COMPETITORS = [
  { name: "Smokerolla", domain: "smokerolla.com", instagram: "smokerolla.venezuela", threat: "high", notes: "Tienda física Caracas 15 años, catálogo 190+ marcas, envío gratis +$50" },
  { name: "MercadoLibre VE", domain: "mercadolibre.com.ve", instagram: null, threat: "high", notes: "Domina 8/10 SERPs genéricas; convivir no pelear" },
  { name: "Green Smokers", domain: "gsmokers.com", instagram: null, threat: "medium", notes: "E-commerce + local físico activo" },
  { name: "Del Verde al Morao", domain: "delverdealmorao.com", instagram: null, threat: "medium", notes: "Distribuidor oficial RAW + Lion Rolling Circus + Super Smoker" },
  { name: "Paradise Smoking Shop", domain: "paradisesmokingshop.com", instagram: null, threat: "watch", notes: "En maintenance 2026-04; vigilar relanzamiento" },
  { name: "Para La Mata", domain: null, instagram: "paralamata", threat: "low", notes: "IG-only; buen naming nativo pero sin web ni SEO" },
  { name: "Happy Place VZLA", domain: null, instagram: "happy_place_vzla", threat: "low", notes: "IG-only ~1,179 seguidores" },
  { name: "Cherry VE", domain: null, instagram: "cherry__ve", threat: "low", notes: "IG-only" },
  { name: "Rolling Papers VE", domain: null, instagram: "rollingpapersve", threat: "low", notes: "IG-only, nicho papel" },
  { name: "Smoke VZLA", domain: null, instagram: "smoke.vzla", threat: "low", notes: "IG-only" },
]

const STARTER_KEYWORDS = [
  "donde comprar grinder caracas",
  "conos para fumar venezuela",
  "pipa de vidrio caracas",
  "papel para fumar sabores venezuela",
  "parafernalia venezuela",
  "rolling paper venezuela",
  "grinder para fumar venezuela",
  "ocb venezuela",
  "raw papers venezuela",
  "bong caracas",
]

export default async function seedSeoAnalytics({ container }: ExecArgs) {
  const svc: any = container.resolve(SEO_ANALYTICS_MODULE)
  const logger: any = container.resolve("logger")

  // Competitors — upsert by name
  const existingCompetitors = await svc.listSeoCompetitors({})
  const existingNames = new Set(existingCompetitors.map((c: any) => c.name))
  const newCompetitors = COMPETITORS.filter((c) => !existingNames.has(c.name))

  if (newCompetitors.length > 0) {
    await svc.createSeoCompetitors(newCompetitors.map((c) => ({ ...c, active: true })))
    logger.info(`[seo-seed] Creados ${newCompetitors.length} competidores nuevos`)
  } else {
    logger.info(`[seo-seed] Competidores ya existentes: ${existingCompetitors.length}`)
  }

  // Keywords — upsert by (keyword, country, device)
  const existingKws = await svc.listSeoKwTrackeds({})
  const existingKeys = new Set(
    existingKws.map((k: any) => `${k.keyword}|${k.country}|${k.device}`)
  )
  const newKws = STARTER_KEYWORDS.filter(
    (kw) => !existingKeys.has(`${kw}|ve|mobile`)
  ).map((keyword) => ({
    keyword,
    country: "ve",
    device: "mobile",
    source: "suggestion_ve",
    active: true,
    notes: "Starter pack 2026-04-21 (análisis competencia)",
  }))

  if (newKws.length > 0) {
    await svc.createSeoKwTrackeds(newKws)
    logger.info(`[seo-seed] Creadas ${newKws.length} keywords starter`)
  } else {
    logger.info(`[seo-seed] Keywords ya existentes: ${existingKws.length}`)
  }

  logger.info("[seo-seed] Seed completo ✅")
}
