import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows";

/**
 * Creates a shared discount code `ENROLAWELCOME`.
 *
 * Rules:
 *  - Applies only to the product "Rolling Paper Sabores Alien Puff"
 *  - Fixed €2.50 off (= free paper)
 *  - Max 1 unit discounted per cart (apply_to_quantity + max_quantity = 1)
 *  - Requires a registered customer (customer.id must exist)
 *  - No global usage limit — meant to spread organically
 */
export default async function createEnrolaWelcomePromo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModule = container.resolve(Modules.PRODUCT);
  const promotionModule = container.resolve(Modules.PROMOTION);

  // 1. Find the Alien Puff Sabores product by title
  const products = await productModule.listProducts({}, { take: 200 });
  const alien = products.find((p) => {
    const title = (p.title ?? "").toLowerCase();
    return title.includes("alien puff") && title.includes("sabores");
  });

  if (!alien) {
    logger.error(
      "❌ Could not find product with title matching 'Alien Puff' + 'Sabores'. " +
        "Available titles:\n" +
        products.map((p) => `  - ${p.title} (id: ${p.id})`).join("\n")
    );
    return;
  }

  logger.info(`✓ Found product: "${alien.title}" (id: ${alien.id}, handle: ${alien.handle})`);

  // 2. Check if a promo with this code already exists
  const existing = await promotionModule.listPromotions({ code: "ENROLAWELCOME" });
  if (existing.length > 0) {
    logger.warn(
      `⚠️  Promotion ENROLAWELCOME already exists (id: ${existing[0].id}). ` +
        `Delete it first from the admin if you want to re-create.`
    );
    return;
  }

  // 3. Create the promotion
  const { result } = await createPromotionsWorkflow(container).run({
    input: {
      promotionsData: [
        {
          code: "ENROLAWELCOME",
          type: "standard",
          status: "active",
          is_automatic: false,
          application_method: {
            type: "fixed",
            target_type: "items",
            allocation: "each",
            value: 2.5,
            currency_code: "eur",
            apply_to_quantity: 1,
            max_quantity: 1,
            target_rules: [
              {
                attribute: "product.id",
                operator: "eq",
                values: [alien.id],
              },
            ],
          },
          rules: [
            {
              attribute: "customer.id",
              operator: "ne",
              values: ["null"],
            },
          ],
        },
      ],
    },
  });

  const promo = result[0];
  logger.info(`✅ Promotion created successfully:`);
  logger.info(`   Code: ${promo.code}`);
  logger.info(`   ID: ${promo.id}`);
  logger.info(`   Status: ${promo.status}`);
  logger.info(`   Target product: "${alien.title}"`);
  logger.info(`   Discount: €2.50 off (fixed)`);
  logger.info(`   Max 1 unit per cart · requires registered customer`);
  logger.info("");
  logger.info(`   Admin: https://enrola.shop/dashboard/promotions/${promo.id}`);
}
