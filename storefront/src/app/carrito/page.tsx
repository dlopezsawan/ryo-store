"use client";

import { useEffect } from "react";
import { trackCartViewed, trackProductRemovedFromCart } from "@/lib/posthog";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { Trash2, Plus, Minus, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { centsToDisplay } from "@/lib/price";
import { formatPrice } from "@/lib/format";
import UpsellSection from "@/components/cart/UpsellSection";
import QuantityInput from "@/components/form/QuantityInput";
import ComboTierBanner from "@/components/combo/ComboTierBanner";
import { applyComboDiscount } from "@/lib/combo-tiers";

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "";

function getThumbnailUrl(thumbnail?: string): string | null {
  if (!thumbnail) return null;
  if (thumbnail.startsWith("http://") || thumbnail.startsWith("https://")) return thumbnail;
  const base = BACKEND_URL.replace(/\/$/, "");
  return base ? `${base}${thumbnail.startsWith("/") ? "" : "/"}${thumbnail}` : thumbnail;
}

function CartItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: { id: string; title: string; quantity: number; unit_price: number; thumbnail?: string };
  onUpdate: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const price = centsToDisplay(item.unit_price);
  const thumbUrl = getThumbnailUrl(item.thumbnail);

  return (
    <div className="border-2 border-dark bg-white p-3 flex items-center gap-3">
      {/* Thumbnail */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-dark overflow-hidden flex-shrink-0 relative bg-cream">
        {thumbUrl ? (
          <Image src={thumbUrl} alt={item.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs" aria-hidden>&mdash;</div>
        )}
      </div>

      {/* Product info + controls */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-dark text-sm sm:text-base truncate uppercase leading-tight">{item.title}</p>
        <p className="font-black text-dark text-lg sm:text-xl mt-0.5">€{price.toFixed(2)} <span className="text-[9px] font-bold text-dark/40">BCV</span></p>

        {/* Controls row */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center">
            <button
              onClick={() => onUpdate(item.id, Math.max(1, item.quantity - 1))}
              className="w-8 h-8 border-2 border-dark bg-cream flex items-center justify-center hover:bg-dark hover:text-cream transition-colors"
            >
              <Minus size={12} strokeWidth={3} />
            </button>
            <QuantityInput
              value={item.quantity}
              onCommit={(n) => onUpdate(item.id, n)}
              className="w-8 h-8 border-y-2 border-dark text-center font-bold text-sm bg-white focus:outline-none focus:bg-cream"
            />
            <button
              onClick={() => onUpdate(item.id, item.quantity + 1)}
              className="w-8 h-8 border-2 border-dark bg-cream flex items-center justify-center hover:bg-dark hover:text-cream transition-colors"
            >
              <Plus size={12} strokeWidth={3} />
            </button>
          </div>
          <button
            onClick={() => onRemove(item.id)}
            className="text-muted hover:text-primary transition-colors p-1"
          >
            <Trash2 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CarritoPage() {
  const { cart, loading, updateQuantity, removeItem } = useCart();
  const isEmpty = !cart?.items?.length;

  useEffect(() => {
    if (cart?.item_count) {
      trackCartViewed({
        item_count: cart.item_count,
        subtotal: cart.subtotal ?? 0,
        source: "page",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.item_count]);

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-4xl md:text-6xl uppercase tracking-tight">
            Tu Carrito
          </h1>
        </div>

        {loading ? (
          <p className="text-muted">Cargando carrito...</p>
        ) : isEmpty ? (
          <div className="text-center py-20 border-3 border-dark bg-white" style={{ borderWidth: "3px", boxShadow: "6px 6px 0 0 var(--secondary)" }}>
            <ShoppingCart size={56} className="text-muted mx-auto mb-6" strokeWidth={1.5} />
            <p className="font-bold text-muted text-2xl mb-6 uppercase">Tu carrito está vacío</p>
            <Link
              href="/tienda"
              className="inline-block bg-orange text-white px-10 py-3.5 font-black text-sm uppercase tracking-widest rounded-lg retro-border retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              IR A LA TIENDA
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {/* Items */}
            <div className="md:col-span-2 flex flex-col gap-0">
              {cart!.items.map((item, idx) => (
                <div key={item.id}>
                  <CartItemRow
                    item={item}
                    onUpdate={updateQuantity}
                    onRemove={(id) => {
                      trackProductRemovedFromCart({
                        product_id: (item as any).product_id,
                        variant_id: (item as any).variant_id,
                        title: item.title,
                        quantity: item.quantity,
                        cart_size_after: Math.max(0, (cart?.item_count ?? 0) - item.quantity),
                        reason: "cart_page_remove_click",
                      });
                      removeItem(id);
                    }}
                  />
                  {idx < cart!.items.length - 1 && (
                    <div className="border-b-2 border-dashed border-secondary/40 my-0" />
                  )}
                </div>
              ))}

              {/* Upsell — debajo de los items */}
              <UpsellSection cartItemIds={cart!.items.map((i) => i.id)} />
            </div>

            {/* Summary sidebar */}
            <div className="h-fit border-[3px] border-dark bg-white p-5 md:p-6" style={{ boxShadow: "6px 6px 0px 0px var(--primary)" }}>
              <h2 className="font-black text-dark text-lg uppercase tracking-wide mb-5 pb-3 border-b-2 border-dark">
                Resumen
              </h2>

              {/* Combo tier nudge */}
              <div className="mb-4">
                <ComboTierBanner />
              </div>

              {(() => {
                const totalItems = cart!.item_count;
                const cartLineItems = cart!.items.map(i => ({ quantity: i.quantity, unit_price: centsToDisplay(i.unit_price), variant_id: i.variant_id }));
                const { discount, discountedTotal, activeTier, wholesaleDiscount, hasWholesale } = applyComboDiscount(cart!.subtotal, totalItems, cartLineItems);
                return (
                  <div className="flex flex-col gap-3 mb-5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted font-medium uppercase">Subtotal</span>
                      <span className="font-bold">€{formatPrice(cart!.subtotal)} <span className="text-[8px] font-bold text-dark/40">BCV</span></span>
                    </div>
                    {activeTier && (
                      <div className="flex justify-between text-sm">
                        <span className="text-secondary font-bold uppercase">Dto. Combo {activeTier.label}</span>
                        <span className="font-black text-secondary">-€{formatPrice(discount - wholesaleDiscount)}</span>
                      </div>
                    )}
                    {hasWholesale && (
                      <div className="flex justify-between text-sm">
                        <span className="text-orange font-bold uppercase">Dto. Mayorista 30%</span>
                        <span className="font-black text-orange">-€{formatPrice(wholesaleDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted font-medium uppercase">Envío</span>
                      <span className="text-muted text-sm">A calcular</span>
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const totalItems = cart!.item_count;
                const lineItems = cart!.items.map(i => ({ quantity: i.quantity, unit_price: centsToDisplay(i.unit_price), variant_id: i.variant_id }));
                const { discountedTotal, activeTier, hasWholesale, discount } = applyComboDiscount(cart!.subtotal, totalItems, lineItems);
                const hasAnyDiscount = activeTier || hasWholesale;
                return (
                  <div className="border-t-2 border-dashed border-secondary/40 pt-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-dark uppercase">Total</span>
                      <span className={`font-black text-2xl ${hasAnyDiscount ? "text-orange" : "text-dark"}`}>
                        €{formatPrice(hasAnyDiscount ? discountedTotal : cart!.subtotal)} <span className="text-[9px] font-bold opacity-50">BCV</span>
                      </span>
                    </div>
                    {hasAnyDiscount && (
                      <p className="text-right text-xs text-secondary font-bold mt-1">
                        Ahorras €{formatPrice(discount)}
                      </p>
                    )}
                  </div>
                );
              })()}

              <Link
                href="/checkout"
                className="block text-center bg-orange text-white py-3.5 font-black text-xs uppercase tracking-widest border-2 border-dark retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
              >
                Continuar con el Pago
              </Link>
              <Link
                href="/tienda"
                className="block text-center mt-4 text-muted text-sm font-medium hover:text-dark transition-colors uppercase"
              >
                Seguir comprando
              </Link>

              <div className="mt-6 pt-4 border-t border-dark/10 text-center">
                <p className="text-xs text-muted">Pago 100% Seguro</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
