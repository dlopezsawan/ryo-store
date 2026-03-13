/**
 * Crea o obtiene un Publishable API Key para el storefront.
 * Ejecutar: npm run get-publishable-key
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function getPublishableKey({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);
  const salesChannels = await salesChannelModule.listSalesChannels({});
  const defaultChannel = salesChannels.find((s: { name?: string }) => s.name === "Default Sales Channel") ?? salesChannels[0];
  if (!defaultChannel) {
    logger.warn("No hay sales channels. Ejecuta: npm run seed");
    return;
  }

  const { result } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [{ title: "RYO Storefront", type: "publishable", created_by: "" }],
    },
  });
  const newKey = result?.[0] as { id?: string; token?: string } | undefined;
  if (!newKey?.token) {
    logger.warn("No se pudo crear la clave. Revisa que el backend esté bien configurado.");
    return;
  }

  if (!newKey.id) return;
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: newKey.id, add: [defaultChannel.id] },
  });

  logger.info("");
  logger.info("Copia esta línea a storefront/.env.local:");
  logger.info("");
  logger.info(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${newKey.token}`);
  logger.info("");
}
