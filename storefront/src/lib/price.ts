/**
 * Utilidad centralizada para precios de Medusa.
 * Medusa guarda importes en centavos (1500 = $15) por defecto.
 * Si usas PRICE_DIVISOR=1, Medusa guarda 1:1 (15 = $15).
 */

const PRICE_DIVISOR =
  Number(process.env.NEXT_PUBLIC_PRICE_DIVISOR) || 1;

/** Convierte el importe raw de Medusa (centavos o unidades) a valor para mostrar */
export function centsToDisplay(amount: number): number {
  return amount / PRICE_DIVISOR;
}
