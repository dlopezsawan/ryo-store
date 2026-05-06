/**
 * Cliente del carrito Medusa para el storefront.
 * Usa las rutas API de Next.js como proxy para evitar CORS.
 */

import { centsToDisplay } from "./price";

const CART_ID_KEY = "ryo_cart_id";
const API = "/api/cart";

/**
 * Tras cada operación de cart (add/update/remove), pedimos al backend que
 * recalcule los descuentos combo+wholesale como adjustments por línea.
 * Best-effort: si falla, el cart sigue funcional pero sin descuentos
 * actualizados — el siguiente cambio lo arreglará.
 */
async function recalculateCombos(cartId: string): Promise<void> {
  try {
    await fetch(`${API}/${encodeURIComponent(cartId)}/recalculate-combos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // never block UI on a recalc failure
  }
}

/** Obtiene la región preferida (por defecto Venezuela). Los carritos nuevos usarán esta región. */
export async function getRegionId(countryCode = "ve"): Promise<string | null> {
  try {
    const res = await fetch(`${API}/regions?country=${encodeURIComponent(countryCode)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { regions?: { id: string }[] };
    return data.regions?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function createCart(regionId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_id: regionId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { cart?: { id: string } };
    const id = data.cart?.id;
    if (id && typeof window !== "undefined") {
      localStorage.setItem(CART_ID_KEY, id);
    }
    return id ?? null;
  } catch {
    return null;
  }
}

export function getCartId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CART_ID_KEY);
}

export async function getOrCreateCartId(): Promise<string | null> {
  let id = getCartId();
  if (id) {
    const ok = await verifyCart(id);
    if (ok) return id;
    if (typeof window !== "undefined") localStorage.removeItem(CART_ID_KEY);
  }
  const regionId = await getRegionId();
  if (!regionId) return null;
  return createCart(regionId);
}

async function verifyCart(cartId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}?cartId=${encodeURIComponent(cartId)}`);
    return res.ok;
  } catch {
    return false;
  }
}

export interface CartLineItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  thumbnail?: string;
  variant_id: string;
}

export interface Cart {
  id: string;
  items: CartLineItem[];
  subtotal: number;
  item_count: number;
}

export async function getCart(cartId: string): Promise<Cart | null> {
  try {
    const res = await fetch(`${API}?cartId=${encodeURIComponent(cartId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      cart?: Parameters<typeof normalizeCart>[0];
    };
    const c = data.cart;
    if (!c) return null;
    return normalizeCart(c);
  } catch {
    return null;
  }
}

function normalizeCart(c: {
  id: string;
  items?: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    thumbnail?: string;
    variant_id: string;
    variant?: { product?: { thumbnail?: string; images?: Array<{ url?: string }> } };
  }>;
}): Cart {
  const items: CartLineItem[] = (c.items || []).map((i) => {
    const thumb =
      i.thumbnail ||
      i.variant?.product?.thumbnail ||
      i.variant?.product?.images?.[0]?.url;
    return {
      id: i.id,
      title: i.title,
      quantity: i.quantity,
      unit_price: i.unit_price,
      thumbnail: thumb || undefined,
      variant_id: i.variant_id,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  return {
    id: c.id,
    items,
    subtotal: centsToDisplay(subtotal),
    item_count: items.reduce((s, i) => s + i.quantity, 0),
  };
}

export async function addToCart(
  cartId: string,
  variantId: string,
  quantity = 1
): Promise<{ cart: Cart | null; error?: string }> {
  try {
    const res = await fetch(`${API}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        variant_id: variantId,
        quantity,
      }),
    });
    const data = (await res.json()) as {
      cart?: { id: string; items?: unknown[] };
      error?: string;
    };
    if (!res.ok) {
      return { cart: null, error: data?.error || "Error al agregar" };
    }
    if (data.cart?.id) {
      // Recalcular descuentos server-side con la nueva línea ya presente,
      // luego releemos el cart para obtener los adjustments aplicados.
      await recalculateCombos(data.cart.id);
      const refreshed = await getCart(data.cart.id);
      return { cart: refreshed ?? normalizeCart(data.cart as Parameters<typeof normalizeCart>[0]) };
    }
    return { cart: null, error: "No se obtuvo el carrito" };
  } catch (e) {
    return { cart: null, error: e instanceof Error ? e.message : "Error de conexión" };
  }
}

export async function updateLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<Cart | null> {
  try {
    const res = await fetch(
      `${API}/line-items/${lineItemId}?cartId=${encodeURIComponent(cartId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { cart?: { id: string } };
    if (!data.cart?.id) return null;
    await recalculateCombos(data.cart.id);
    return getCart(data.cart.id);
  } catch {
    return null;
  }
}

export async function removeLineItem(
  cartId: string,
  lineItemId: string
): Promise<Cart | null> {
  try {
    const res = await fetch(
      `${API}/line-items/${lineItemId}?cartId=${encodeURIComponent(cartId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { parent?: { id: string }; cart?: { id: string } };
    const updatedId = data.parent?.id ?? data.cart?.id;
    if (!updatedId) return null;
    await recalculateCombos(updatedId);
    return getCart(updatedId);
  } catch {
    return null;
  }
}
