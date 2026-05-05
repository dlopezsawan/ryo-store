"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";

interface StickyBuyBarProps {
  productName: string;
  price: number;
  variantId: string;
}

export default function StickyBuyBar({ productName, price, variantId }: StickyBuyBarProps) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);
    await addItem(variantId);
    setAdding(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-[3px] border-dark md:hidden">
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
          className="flex items-center gap-2 bg-orange text-white px-5 py-2.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-70 flex-shrink-0"
        >
          <ShoppingBag size={16} strokeWidth={2.5} />
          {adding ? "..." : "AGREGAR"}
        </button>
      </div>
    </div>
  );
}
