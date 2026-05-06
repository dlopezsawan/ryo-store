/**
 * Formatea precio para display en e-commerce.
 * Siempre 2 decimales, símbolo €.
 */
export function formatPrice(price: number): string {
  return Number(price).toFixed(2);
}

/** Symbol used across the storefront */
export const CURRENCY_SYMBOL = "€";
