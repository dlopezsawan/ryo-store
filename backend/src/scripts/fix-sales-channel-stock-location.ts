/**
 * Vincula sales channels a stock locations y crea inventory levels.
 * Necesario cuando el seed falló antes de completar.
 * Ejecutar: npm run fix-sales-channel
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function fixSalesChannelStockLocation({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);

  const stockLocations = await stockLocationModule.listStockLocations({});
  const salesChannels = await salesChannelModule.listSalesChannels({});

  if (!stockLocations?.length || !salesChannels?.length) {
    logger.warn("No stock locations or sales channels found. Run seed first.");
    return;
  }

  // 1. Link sales channels to stock locations
  const scIds = salesChannels.map((sc) => sc.id);
  for (const loc of stockLocations) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: loc.id, add: scIds },
      });
      logger.info(`Linked ${scIds.length} sales channel(s) to ${loc.name}`);
    } catch {
      /* already linked */
    }
  }

  // 2. Link fulfillment provider manual_manual to all stock locations (para shipping options)
  const { batchLinksWorkflow } = await import("@medusajs/medusa/core-flows");
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT);
  const providers = await fulfillmentModule.listFulfillmentProviders({});
  const manualId = providers.find((p: { id: string }) => String(p.id).includes("manual"))?.id ?? "manual_manual";
  for (const loc of stockLocations) {
    try {
      await batchLinksWorkflow(container).run({
        input: {
          create: [
            {
              [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
              [Modules.FULFILLMENT]: { fulfillment_provider_id: manualId },
            },
          ],
        },
      });
      logger.info(`Linked fulfillment provider to ${loc.name}`);
    } catch (e) {
      logger.info(`Provider link for ${loc.name}: ${String(e)}`);
    }
  }

  // 3. Create inventory levels for all inventory items in each stock location
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });
  if (inventoryItems?.length) {
    const levels: { inventory_item_id: string; location_id: string; stocked_quantity?: number }[] = [];
    for (const item of inventoryItems) {
      for (const loc of stockLocations) {
        levels.push({
          inventory_item_id: item.id,
          location_id: loc.id,
          stocked_quantity: 999999,
        });
      }
    }
    try {
      await createInventoryLevelsWorkflow(container).run({
        input: { inventory_levels: levels },
      });
      logger.info(`Created inventory levels for ${inventoryItems.length} items × ${stockLocations.length} locations`);
    } catch (e) {
      logger.info("Inventory levels may already exist: " + String(e));
    }
  }
  logger.info("Done.");
}
