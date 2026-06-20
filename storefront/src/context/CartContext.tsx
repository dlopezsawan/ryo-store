"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import * as cartApi from "@/lib/cart";
import type { Cart } from "@/lib/cart";

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  addItem: (variantId: string, quantity?: number) => Promise<{ ok: boolean; error?: string }>;
  updateQuantity: (lineItemId: string, quantity: number) => Promise<void>;
  removeItem: (lineItemId: string) => Promise<void>;
  refresh: () => Promise<void>;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Internal error state: tracks the last cart-mutation error for debugging.
  // Not yet surfaced in UI — a toast layer can read this when one is wired up.
  const [_cartError, setCartError] = useState<string | null>(null);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const refresh = useCallback(async () => {
    const id = await cartApi.getOrCreateCartId();
    if (!id) {
      setCart(null);
      setLoading(false);
      return;
    }
    const c = await cartApi.getCart(id);
    setCart(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1): Promise<{ ok: boolean; error?: string }> => {
      const id = await cartApi.getOrCreateCartId();
      if (!id) return { ok: false, error: "No se pudo crear el carrito. Verifica la conexión." };
      const { cart: updated, error } = await cartApi.addToCart(id, variantId, quantity);
      if (updated) {
        setCart(updated);
        return { ok: true };
      }
      return { ok: false, error: error || "No se pudo agregar" };
    },
    []
  );

  const updateQuantity = useCallback(async (lineItemId: string, quantity: number) => {
    const id = cartApi.getCartId();
    if (!id || !cart) return;
    try {
      const updated = await cartApi.updateLineItem(id, lineItemId, quantity);
      if (updated) {
        setCart(updated);
        setCartError(null);
      } else {
        const msg = `updateQuantity: no se recibió carrito actualizado (lineItem=${lineItemId}, qty=${quantity})`;
        console.error("[CartContext]", msg);
        setCartError(msg);
      }
    } catch (err) {
      const msg = `updateQuantity falló: ${String(err)}`;
      console.error("[CartContext]", msg);
      setCartError(msg);
    }
  }, [cart]);

  const removeItem = useCallback(async (lineItemId: string) => {
    const id = cartApi.getCartId();
    if (!id) return;
    try {
      const updated = await cartApi.removeLineItem(id, lineItemId);
      if (updated) {
        setCart(updated);
        setCartError(null);
      } else {
        const msg = `removeItem: no se recibió carrito actualizado (lineItem=${lineItemId})`;
        console.error("[CartContext]", msg);
        setCartError(msg);
      }
    } catch (err) {
      const msg = `removeItem falló: ${String(err)}`;
      console.error("[CartContext]", msg);
      setCartError(msg);
    }
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        addItem,
        updateQuantity,
        removeItem,
        refresh,
        drawerOpen,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
