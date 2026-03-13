import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";

/**
 * Establece custom_display_id como los últimos 6 caracteres del order.id
 * para que aparezca en el correo de confirmación y en la UI.
 */
export default async function orderDisplayIdHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data?.id;
  if (!orderId) return;

  const shortId = String(orderId).slice(-6).toUpperCase();

  try {
    const orderModule = container.resolve(Modules.ORDER);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
await orderModule.updateOrders(orderId, { custom_display_id: shortId } as any);
  } catch {
    // Ignore errors
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
