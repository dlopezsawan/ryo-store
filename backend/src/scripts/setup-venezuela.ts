/**
 * Crea la región Venezuela y configura lo necesario para el envío.
 * Ejecutar: npm run setup-venezuela
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function setupVenezuela({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const regionModule = container.resolve(Modules.REGION);

  const existing = await regionModule.listRegions({}, { relations: ["countries"] });
  const hasVe = existing.some((r: { countries?: Array<{ iso_2?: string }> }) =>
    r.countries?.some((c) => c.iso_2?.toLowerCase() === "ve")
  );

  if (hasVe) {
    logger.info("La región Venezuela ya existe.");
    return;
  }

  const { result } = await createRegionsWorkflow(container).run({
    input: {
      regions: [{
        name: "Venezuela",
        currency_code: "usd",
        countries: ["ve"],
        payment_providers: ["pp_system_default"],
      }],
    },
  });

  const venezuelaRegion = result[0];
  await createTaxRegionsWorkflow(container).run({
    input: [{ country_code: "ve", provider_id: "tp_system" }],
  });

  logger.info(`Región Venezuela creada: ${venezuelaRegion.id}`);
  logger.info("");
  logger.info("Importante:");
  logger.info("1. Borra el carrito (localStorage) y crea uno nuevo para que use región Venezuela.");
  logger.info("2. En Medusa Admin, verifica que las opciones de envío tengan precios para región Venezuela.");
  logger.info("");
}
