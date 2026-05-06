"use client";
// v2 - BCV price labels
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Check, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/context/CartContext";

export interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  rating: number;
  image: string;
  slug: string;
  tall?: boolean;
  badge?: string;
  category?: string;
  priority?: boolean;
}

export default function ProductCard({
  name,
  price,
  image,
  slug,
  badge,
  category,
  priority = false,
}: ProductCardProps) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (adding || added) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/product-variant?handle=${encodeURIComponent(slug)}`);
      if (!res.ok) { setAdding(false); return; }
      const data = await res.json();
      const variantId = data.variantId;
      if (!variantId) { setAdding(false); return; }
      const { ok } = await addItem(variantId, 1);
      if (ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
      }
    } catch {
      // silently fail
    } finally {
      setAdding(false);
    }
  };

  return (
    <Link
      href={`/productos/${slug}`}
      className="group flex flex-col bg-cream border-3 border-dark retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all duration-150"
      style={{ borderWidth: "3px" }}
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-white aspect-square">
        {badge && (
          <span className="absolute top-2 left-2 z-10 bg-primary text-white text-[10px] font-black uppercase tracking-wider px-2 py-1">
            {badge}
          </span>
        )}
        <Image
          src={image}
          alt={name}
          width={400}
          height={400}
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          loading={priority ? "eager" : "lazy"}
          priority={priority}
          placeholder="empty"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Info */}
      <div className="p-3 md:p-4 border-t-3 border-dark flex flex-col gap-1" style={{ borderTopWidth: "3px" }}>
        {category && (
          <span className="text-secondary text-[10px] md:text-xs font-bold uppercase tracking-wider">
            {category}
          </span>
        )}
        <h3 className="font-bold text-dark text-sm md:text-base leading-tight line-clamp-2">
          {name}
        </h3>
        {/* Price + Add to cart button */}
        <div className="flex items-center justify-between mt-1 gap-2">
          <span className="font-black text-dark text-lg md:text-xl">
            €{formatPrice(price)} <span className="text-[9px] font-bold text-dark/40">BCV</span>
          </span>
          <button
            onClick={handleAddToCart}
            disabled={adding}
            className={`flex items-center justify-center gap-1 h-8 px-2.5 border-2 border-dark text-[10px] font-black uppercase tracking-wider transition-all shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex-shrink-0 ${
              added
                ? "bg-secondary text-white"
                : "bg-orange text-white"
            }`}
            aria-label="Agregar al carrito"
          >
            {adding ? (
              <Loader2 size={13} strokeWidth={2.5} className="animate-spin" />
            ) : added ? (
              <Check size={13} strokeWidth={3} />
            ) : (
              <ShoppingBag size={13} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}
