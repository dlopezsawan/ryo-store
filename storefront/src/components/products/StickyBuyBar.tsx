"use client";

import { useState } from "react";
import { ShoppingBag, AlertTriangle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";

interface StickyBuyBarProps {
  productName: string;
  price: number;
  variantId: string;
}

export default function StickyBuyBar({ productName, price, variantId }: StickyBuyBarProps) {
  const { addItem, openDrawer } = useCart();
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);
    setFailed(false);
    const { ok } = await addItem(variantId);
    setAdding(false);
    if (ok) {
      openDrawer();
    } else {
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-[3px] border-dark md:hidden">
      {failed && (
        <div className="bg-red-500 text-white text-xs font-bold text-center py-1.5 px-4 flex items-center justify-center gap-1.5">
          <AlertTriangle size={12} strokeWidth={2.5} />
          No se pudo agregar al carrito. Intenta de nuevo.
        </div>
      )}
      <div className="flex items-center justify-between h-16 px-4 gap-3">
        {/* Product info */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-black text-dark text-xs uppercase tracking-tight truncate">
            {productName}
          </span>
          <span className="font-black text-primary text-lg leading-tight">
            €{formatPrice(price)}
          </span>
          <span className="text-[9px] font-bold text-dark/40 ml-1">BCV</span>
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={adding}
          className={`flex items-center gap-2 px-5 py-2.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-70 flex-shrink-0 ${
            failed ? "bg-red-500 text-white" : "bg-orange text-white"
          }`}
        >
          <ShoppingBag size={16} strokeWidth={2.5} />
          {adding ? "..." : "AGREGAR"}
        </button>
      </div>
    </div>
  );
}
