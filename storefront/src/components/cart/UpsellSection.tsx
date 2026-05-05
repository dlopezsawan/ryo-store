"use client";
// v2 - BCV price labels
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface UpsellProduct {
  id: string;
  title: string;
  handle: string;
  variantId: string;
  image: string | null;
  price: number;
}

interface Props {
  cartItemIds: string[];
  cartCategories?: string[];
  compact?: boolean;
}

export default function UpsellSection({ cartItemIds, cartCategories = [], compact = false }: Props) {
  const { addItem } = useCart();
  const [products, setProducts] = useState<UpsellProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    const excludeParam = cartItemIds.join(",");
    const catParam = cartCategories.join(",");
    fetch(`/api/upsell?exclude_ids=${excludeParam}&categories=${catParam}`)
      .then((r) => r.json())
      .then((data: { products: UpsellProduct[] }) => {
        setProducts(data.products || []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [cartItemIds.join(",")]);

  async function handleAdd(product: UpsellProduct) {
    if (!product.variantId || addingId) return;
    setAddingId(product.id);
    const { ok } = await addItem(product.variantId, 1);
    setAddingId(null);
    if (ok) {
      setAddedId(product.id);
      setTimeout(() => setAddedId(null), 2000);
    }
  }

  if (loading) {
    if (compact) return null;
    return (
      <div className="mt-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-1 w-10 bg-primary" />
          <h2 className="font-black text-dark text-2xl md:text-3xl uppercase tracking-tight">
            Completa tu pedido
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-44 sm:w-52 h-64 bg-white border-[3px] border-dark animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  // Compact mode for CartDrawer — full-width horizontal strip
  if (compact) {
    return (
      <div className="mt-3 mb-2 flex gap-2">
        {products.slice(0, 4).map((product) => {
          const isAdding = addingId === product.id;
          const isAdded = addedId === product.id;
          return (
            <div key={product.id} className="flex-1 flex flex-col items-stretch gap-1 min-w-0">
              <Link href={`/productos/${product.handle}`} className="relative w-full aspect-square overflow-hidden bg-cream border-2 border-dark">
                {product.image ? (
                  <Image src={product.image} alt={product.title} fill sizes="80px" className="object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingCart size={12} className="text-muted" /></div>
                )}
              </Link>
              <Link href={`/productos/${product.handle}`} className="text-[9px] font-bold text-dark uppercase leading-tight line-clamp-2 text-center hover:text-primary transition-colors">
                {product.title}
              </Link>
              <span className="text-[9px] font-black text-dark text-center">€{product.price.toFixed(2)} <span className="text-[7px] font-bold text-dark/40">BCV</span></span>
              <button
                onClick={() => handleAdd(product)}
                disabled={isAdding || isAdded}
                className="mt-auto w-full h-5 flex items-center justify-center bg-orange text-white text-[9px] font-black border-2 border-dark disabled:opacity-60"
              >
                {isAdding ? "·" : isAdded ? "✓" : "+ agregar"}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // Full mode for cart page
  return (
    <div className="mt-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-1 w-10 bg-primary" />
        <h2 className="font-black text-dark text-2xl md:text-3xl uppercase tracking-tight">
          Completa tu pedido
        </h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {products.map((product) => {
          const isAdding = addingId === product.id;
          const isAdded = addedId === product.id;
          return (
            <div key={product.id} className="flex-shrink-0 w-44 sm:w-52 flex flex-col bg-white border-[3px] border-dark" style={{ boxShadow: "4px 4px 0px 0px #4D5431" }}>
              <Link href={`/productos/${product.handle}`} className="block relative w-full aspect-square overflow-hidden bg-cream border-b-[3px] border-dark">
                {product.image ? (
                  <Image src={product.image} alt={product.title} fill sizes="(max-width: 768px) 176px, 208px" className="object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingCart size={32} className="text-muted" /></div>
                )}
              </Link>
              <div className="p-3 flex flex-col flex-1 gap-2">
                <Link href={`/productos/${product.handle}`}>
                  <p className="font-bold text-dark text-xs sm:text-sm uppercase leading-tight line-clamp-2 hover:text-primary transition-colors">{product.title}</p>
                </Link>
                <p className="font-black text-dark text-base sm:text-lg">€{product.price.toFixed(2)} <span className="text-[9px] font-bold text-dark/40">BCV</span></p>
                <button
                  onClick={() => handleAdd(product)}
                  disabled={isAdding || isAdded}
                  className="mt-auto w-full flex items-center justify-center gap-1.5 bg-orange text-white py-2 font-black text-xs uppercase tracking-wider border-2 border-dark transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{ boxShadow: isAdded ? "none" : "2px 2px 0px 0px #1A1A1A" }}
                >
                  {isAdding ? "..." : isAdded ? "✓ Añadido" : <><Plus size={12} strokeWidth={3} /> Agregar</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
