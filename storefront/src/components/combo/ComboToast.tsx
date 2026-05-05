"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import {
  countQualifyingUniqueSkus,
  getActiveTier,
  getNextTier,
  WHOLESALE_MIN,
} from "@/lib/combo-tiers";

/**
 * Toast tras añadir/incrementar un producto.
 *
 * Modelo: combo se desbloquea por VARIEDAD (productos únicos en el cart),
 * mayorista por VOLUMEN del mismo SKU. El descuento real se aplica
 * server-side per-línea (1 unidad para combo, todas para mayorista).
 */
export default function ComboToast() {
  const { cart, openDrawer } = useCart();
  const [visible, setVisible] = useState(false);
  const [tierMsg, setTierMsg] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [prevCount, setPrevCount] = useState<number | null>(null);
  const [prevUnique, setPrevUnique] = useState<number | null>(null);
  const [prevMaxLine, setPrevMaxLine] = useState<number | null>(null);

  const totalItems = cart?.item_count ?? 0;
  const items = cart?.items ?? [];
  const uniqueSkus = countQualifyingUniqueSkus(items);
  const maxLineQty = items.length ? Math.max(...items.map((i) => i.quantity)) : 0;

  useEffect(() => {
    const countIncreased =
      totalItems > (prevCount ?? totalItems) ||
      (prevCount === 0 && totalItems > 0);

    if (countIncreased) {
      const next = getNextTier(uniqueSkus);
      const active = getActiveTier(uniqueSkus);
      const prevActiveDiscount = getActiveTier(prevUnique ?? 0)?.discount ?? 0;
      const comboJustUnlocked = !!active && active.discount > prevActiveDiscount;

      const hasWholesale = maxLineQty >= WHOLESALE_MIN;
      const prevHadWholesale = (prevMaxLine ?? 0) >= WHOLESALE_MIN;
      const wholesaleJustUnlocked = hasWholesale && !prevHadWholesale;

      if (wholesaleJustUnlocked) {
        setTierMsg("¡30% Mayorista desbloqueado en esa línea!");
        setUnlocked(true);
      } else if (comboJustUnlocked) {
        setTierMsg(`¡${active!.label} a 1 unidad de cada producto!`);
        setUnlocked(true);
      } else if (next) {
        setTierMsg(
          next.skusNeeded === 1
            ? `Agrega 1 producto distinto más → ${next.tier.label}`
            : `${next.skusNeeded} productos distintos más → ${next.tier.label}`
        );
        setUnlocked(false);
      } else if (active) {
        setTierMsg(`${active.label} aplicado a 1 unidad de cada producto`);
        setUnlocked(false);
      } else {
        setTierMsg("");
        setUnlocked(false);
      }
      setVisible(true);
    }

    setPrevCount(totalItems);
    setPrevUnique(uniqueSkus);
    setPrevMaxLine(maxLineQty);
  }, [totalItems, uniqueSkus, maxLineQty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-hide after 3.5 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleViewCart = useCallback(() => {
    setVisible(false);
    openDrawer();
  }, [openDrawer]);

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] max-w-[380px] w-[calc(100%-2rem)] transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-4 opacity-0 pointer-events-none"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-dark text-cream border-2 border-dark shadow-[4px_4px_0px_0px_var(--orange)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 bg-secondary text-cream flex items-center justify-center flex-shrink-0">
            <Check size={14} strokeWidth={3} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Añadido al carrito</p>
            {tierMsg && (
              <p className={`text-[11px] font-bold mt-0.5 truncate ${unlocked ? "text-orange" : "text-cream/60"}`}>
                {unlocked ? "🎉 " : "⚡ "}{tierMsg}
              </p>
            )}
          </div>
          <button
            onClick={handleViewCart}
            className="flex items-center gap-1.5 bg-orange text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border border-orange/60 hover:bg-orange/80 transition-colors flex-shrink-0"
          >
            <ShoppingBag size={11} strokeWidth={2.5} />
            Ver
          </button>
          <button
            onClick={() => setVisible(false)}
            className="text-cream/40 hover:text-cream transition-colors flex-shrink-0 ml-0.5"
            aria-label="Cerrar"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        {unlocked && <div className="h-1 bg-orange animate-pulse" />}
      </div>
    </div>
  );
}
