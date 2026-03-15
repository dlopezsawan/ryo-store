import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";

/**
 * Suscribe automáticamente a Listmonk cuando se crea un nuevo cliente.
 */
export default async function customerListmonkHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = data?.id;
  if (!customerId) return;

  try {
    const customerModule = container.resolve(Modules.CUSTOMER);
    const customer = await customerModule.retrieveCustomer(customerId);
    if (!customer?.email) return;

    const LISTMONK_URL = process.env.LISTMONK_URL || "http://listmonk:9000";
    const LISTMONK_USER = process.env.LISTMONK_ADMIN_USER || "admin";
    const LISTMONK_PASS = process.env.LISTMONK_ADMIN_PASSWORD || "RyoListmonk2024!";
    const LISTMONK_LIST_ID = parseInt(process.env.LISTMONK_LIST_ID || "3", 10);
    const basicAuth = Buffer.from(`${LISTMONK_USER}:${LISTMONK_PASS}`).toString("base64");

    const name =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.email.split("@")[0];

    await fetch(`${LISTMONK_URL}/api/subscribers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        email: customer.email.trim().toLowerCase(),
        name,
        status: "enabled",
        lists: [LISTMONK_LIST_ID],
        preconfirm_subscriptions: true,
      }),
    });
  } catch {
    // No bloquear la creación del cliente si Listmonk falla
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
};
