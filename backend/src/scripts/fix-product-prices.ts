/**
 * Corrige precios que fueron creados con la unidad incorrecta (10 en vez de 1000 para €10, 15 en vez de 1500 para $15).
 * Medusa espera importes en la unidad mínima de la moneda (centavos).
 * Ejecutar: npm run fix-product-prices
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

const FIXES: Array<{ amount: number; currency: string; newAmount: number }> = [
  { amount: 10, currency: "eur", newAmount: 1000 },
  { amount: 10, currency: "usd", newAmount: 1000 },
  { amount: 15, currency: "eur", newAmount: 1500 },
  { amount: 15, currency: "usd", newAmount: 1500 },
];

function getFix(amount: number, currencyCode: string) {
  return FIXES.find(
    (f) =>
      Math.abs(Number(amount) - f.amount) < 0.01 &&
      (currencyCode?.toLowerCase() ?? "") === f.currency
  );
}

export default async function fixProductPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pricingModule = container.resolve(Modules.PRICING);

  const priceSets = await pricingModule.listPriceSets(
    {},
    { relations: ["prices", "prices.price_rules"], take: null }
  );

  let updated = 0;
  for (const ps of priceSets) {
    const prices = ps.prices ?? [];
    const pricesToFix = prices.filter((p: { amount?: unknown; currency_code?: string }) =>
      getFix(Number(p.amount ?? 0), p.currency_code ?? "")
    );
    if (!pricesToFix.length) continue;

    const allPrices = prices.map(
      (p: { id: string; amount?: unknown; currency_code?: string; price_rules?: unknown[] }) => {
        const amt = Number(p.amount ?? 0);
        const fix = getFix(amt, p.currency_code ?? "");
        if (fix) {
          updated++;
          return { id: p.id, amount: fix.newAmount, currency_code: p.currency_code ?? "" };
        }
        return { id: p.id, amount: amt, currency_code: p.currency_code ?? "" };
      }
    );
    await pricingModule.updatePriceSets(ps.id, { prices: allPrices });
  }

  if (updated > 0) {
    logger.info(`Fixed ${updated} price(s).`);
  } else {
    logger.info("No prices need fixing. All amounts look correct.");
  }
}
