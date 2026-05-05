"use client";

import { Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { WHOLESALE_MIN, WHOLESALE_DISCOUNT } from "@/lib/combo-tiers";

/**
 * Wholesale pricing info + add-24 CTA button.
 * Used on product detail pages.
 */
export default function ComboTierInfo({
  variantId,
  productName,
}: {
  variantId: string;
  productName: string;
}) {
  const { addItem } = useCart();

  const handleAddWholesale = async () => {
    await addItem(variantId, WHOLESALE_MIN);
  };

  return (
    <div className="border-2 border-dark bg-white mb-6 overflow-hidden">
      {/* Wholesale info */}
      <div className="flex items-center gap-3 px-4 py-3 bg-cream/50">
        <div className="w-7 h-7 bg-orange/15 text-orange flex items-center justify-center flex-shrink-0 border border-orange/30">
          <Truck size={14} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-dark">
              {WHOLESALE_MIN}+ unidades
            </span>
            <span className="font-black text-sm text-orange">
              {Math.round(WHOLESALE_DISCOUNT * 100)}% MAYORISTA
            </span>
          </div>
          <p className="text-[10px] text-dark/50 mt-0.5">Precio especial para revendedores</p>
        </div>
      </div>

      {/* Wholesale CTA */}
      <div className="border-t-2 border-dark px-4 py-3 bg-cream/50">
        <button
          type="button"
          onClick={handleAddWholesale}
          className="w-full flex items-center justify-center gap-2 bg-dark text-cream py-2.5 font-black text-xs uppercase tracking-widest border-2 border-dark hover:bg-secondary transition-colors"
        >
          <Truck size={14} strokeWidth={2.5} />
          Agregar {WHOLESALE_MIN} al Carrito — Precio Mayorista
        </button>
        <p className="text-[10px] text-dark/40 text-center mt-1.5">
          {WHOLESALE_MIN} unidades de {productName} con {Math.round(WHOLESALE_DISCOUNT * 100)}% de descuento
        </p>
      </div>
    </div>
  );
}
