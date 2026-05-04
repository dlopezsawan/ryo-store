import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function fixShippingProfiles({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  logger.info("Starting shipping profile fix...");

  // 1. Get default shipping profile
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  const defaultProfile = shippingProfiles[0];

  if (!defaultProfile) {
    logger.error("Default shipping profile not found.");
    return;
  }

  logger.info(`Using default profile: ${defaultProfile.id} (${defaultProfile.name})`);

  // 2. Find products missing profiles using query
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title"],
  });

  const { data: links } = await query.graph({
    entity: "product_shipping_profile",
    fields: ["product_id"],
  });

  const productsWithProfile = new Set(links.map((l: any) => l.product_id));
  const missing = products.filter((p: any) => !productsWithProfile.has(p.id));

  if (missing.length === 0) {
    logger.info("No products missing shipping profiles.");
    return;
  }

  logger.info(`Found ${missing.length} product(s) missing profiles.`);

  // 3. Link them
  for (const p of missing) {
    try {
      await link.create({
        [Modules.PRODUCT]: { product_id: p.id },
        [Modules.FULFILLMENT]: { shipping_profile_id: defaultProfile.id },
      });
      logger.info(`Linked product "${p.title}" (${p.id}) to profile.`);
    } catch (err: any) {
      logger.error(`Error linking "${p.title}": ${err.message}`);
    }
  }

  logger.info("Finished shipping profile fix.");
}
