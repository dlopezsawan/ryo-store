"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";

export interface QuickViewModalProps {
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    image: string;
    category?: string;
    description?: string;
  } | null;
  variantId: string | null;
  onClose: () => void;
}

export default function QuickViewModal({
  product,
  variantId,
  onClose,
}: QuickViewModalProps) {
  const { addItem, openDrawer } = useCart();

  // Lock body scroll when open
  useEffect(() => {
    if (product) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [product]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (product) {
      window.addEventListener("keydown", handleKey);
    }
    return () => window.removeEventListener("keydown", handleKey);
  }, [product, onClose]);

  if (!product) return null;

  const handleAddToCart = async () => {
    if (!variantId) return;
    const result = await addItem(variantId, 1);
    if (result.ok) {
      onClose();
      openDrawer();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-dark/60" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg border-[3px] border-dark bg-cream shadow-[8px_8px_0px_0px_#1A1A1A] animate-[quickview-in_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center bg-white border-2 border-dark shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          aria-label="Cerrar"
        >
          <X size={18} strokeWidth={3} />
        </button>

        {/* Image */}
        <div className="relative aspect-square bg-white overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            width={500}
            height={500}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="p-5 border-t-[3px] border-dark space-y-3">
          {product.category && (
            <span className="text-secondary text-[10px] font-bold uppercase tracking-wider">
              {product.category}
            </span>
          )}

          <h2 className="font-black text-dark text-xl uppercase tracking-wide leading-tight">
            {product.name}
          </h2>

          <span className="block font-black text-dark text-2xl">
            €{formatPrice(product.price)} <span className="text-xs font-bold text-dark/40">BCV</span>
          </span>

          {product.description && (
            <p className="text-dark/70 text-sm leading-relaxed line-clamp-3">
              {product.description}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAddToCart}
              disabled={!variantId}
              className="flex-1 bg-orange text-white py-3 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-60"
            >
              Agregar al carrito
            </button>

            <Link
              href={`/productos/${product.slug}`}
              onClick={onClose}
              className="flex items-center justify-center px-4 py-3 border-2 border-dark bg-white font-bold text-xs uppercase tracking-widest shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
              Ver completo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
