import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createShippingOptionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function addVenezuelaShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const regionModuleService = container.resolve(Modules.REGION);
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION);

  logger.info("Adding Venezuela shipping...");

  const allRegions = await regionModuleService.listRegions(
    {},
    { relations: ["countries"] }
  );
  const venezuelaRegion = allRegions.find((r: { countries?: Array<{ iso_2?: string }> }) =>
    r.countries?.some((c) => c.iso_2?.toLowerCase() === "ve")
  );
  if (!venezuelaRegion) {
    logger.warn("Venezuela region not found. Create it in Medusa Admin first.");
    return;
  }

  // Usar el fulfillment set existente del seed (European Warehouse) que ya tiene
  // manual_manual vinculado a la ubicación
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones"] }
  );
  const existingFulfillmentSet = fulfillmentSets.find(
    (fs: { name?: string; service_zones?: Array<{ name?: string }> }) =>
      fs.name === "Venezuela delivery" ||
      fs.name === "European Warehouse delivery" ||
      fs.service_zones?.some((z) => z.name === "Venezuela")
  ) ?? fulfillmentSets.find((fs: { service_zones?: unknown[] }) => (fs.service_zones?.length ?? 0) > 0) ?? fulfillmentSets[0];

  if (!existingFulfillmentSet) {
    logger.warn("No fulfillment set found. Run seed first: npm run seed");
    return;
  }

  const fsWithZones = existingFulfillmentSet as { id: string; service_zones?: Array<{ id: string; name?: string }> };
  const venezuelaZone = fsWithZones.service_zones?.find((sz) => sz.name === "Venezuela");
  const europeZone = fsWithZones.service_zones?.find((sz) => sz.name === "Europe");
  let serviceZoneId = venezuelaZone?.id ?? europeZone?.id ?? fsWithZones.service_zones?.[0]?.id;

  if (serviceZoneId && !venezuelaZone && europeZone) {
    const zoneFull = await fulfillmentModuleService.retrieveServiceZone(serviceZoneId, { relations: ["geo_zones"] });
    const hasVe = (zoneFull.geo_zones ?? []).some((g: { country_code?: string }) => g.country_code?.toLowerCase() === "ve");
    if (!hasVe) {
      await fulfillmentModuleService.createGeoZones([{ service_zone_id: serviceZoneId, type: "country", country_code: "ve" }]);
      logger.info("Added Venezuela to service zone.");
    }
  }
  if (!serviceZoneId) {
    logger.warn("No service zone found.");
    return;
  }

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  const profile = shippingProfiles[0];
  if (!profile) {
    logger.warn("No shipping profile found.");
    return;
  }

  const providers = await fulfillmentModuleService.listFulfillmentProviders({});
  const manualProvider = providers.find((p: { id: string }) =>
    p.id === "manual_manual" || p.id === "fp_manual_manual" || String(p.id).includes("manual")
  );
  const providerId = manualProvider?.id ?? "manual_manual";

  // CRÍTICO: 1) Vincular stock locations al fulfillment set
  // 2) Vincular manual_manual a cada stock location (batchLinksWorkflow como Admin API)
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const stockLocs = await stockLocationModule.listStockLocations({});
  const fsId = (existingFulfillmentSet as { id: string }).id;

  for (const loc of stockLocs) {
    try {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: fsId },
      });
      logger.info(`Linked ${loc.name} to fulfillment set`);
    } catch {
      /* ya vinculado */
    }
  }

  for (const loc of stockLocs) {
    try {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: providerId },
      });
      logger.info(`Linked provider to ${loc.name}`);
    } catch {
      /* ya vinculado */
    }
  }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Inmediato (Valencia) - Gratis",
        price_type: "flat",
        provider_id: providerId,
        service_zone_id: serviceZoneId,
        shipping_profile_id: profile.id,
        type: { label: "Inmediato Gratis", description: "Solo Valencia, orden >=$10", code: "inmediato_gratis" },
        prices: [{ region_id: venezuelaRegion.id, amount: 0 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Inmediato (Valencia) - $3",
        price_type: "flat",
        provider_id: providerId,
        service_zone_id: serviceZoneId,
        shipping_profile_id: profile.id,
        type: { label: "Inmediato $3", description: "Solo Valencia, orden <$10", code: "inmediato_3" },
        prices: [{ region_id: venezuelaRegion.id, amount: 300 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "MRW - Cobro a destino",
        price_type: "flat",
        provider_id: providerId,
        service_zone_id: serviceZoneId,
        shipping_profile_id: profile.id,
        type: { label: "MRW", description: "Resto de Venezuela", code: "mrw" },
        prices: [{ region_id: venezuelaRegion.id, amount: 0 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });

  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);
  const salesChannels = await salesChannelModule.listSalesChannels({});
  const stockLocations = await stockLocationModule.listStockLocations({});
  const locId = stockLocations[0]?.id;
  const scId = salesChannels[0]?.id;
  if (locId && scId) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: locId, add: [scId] },
      });
    } catch {
      // may already be linked
    }
  }

  logger.info("Venezuela shipping options added.");
}
