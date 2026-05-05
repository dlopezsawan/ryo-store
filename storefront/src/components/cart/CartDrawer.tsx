"use client";
// cart drawer v3 - BCV price labels
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Minus, Plus, Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { centsToDisplay } from "@/lib/price";
import { formatPrice } from "@/lib/format";
import ComboTierBanner from "@/components/combo/ComboTierBanner";
import UpsellSection from "@/components/cart/UpsellSection";
import QuantityInput from "@/components/form/QuantityInput";
import { applyComboDiscount } from "@/lib/combo-tiers";
import { trackCartViewed, trackProductRemovedFromCart } from "@/lib/posthog";

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "";
const FREE_SHIPPING_THRESHOLD = 10;

function getThumbnailUrl(thumbnail?: string): string | null {
  if (!thumbnail) return null;
  if (thumbnail.startsWith("http://") || thumbnail.startsWith("https://")) return thumbnail;
  const base = BACKEND_URL.replace(/\/$/, "");
  return base ? `${base}${thumbnail.startsWith("/") ? "" : "/"}${thumbnail}` : thumbnail;
}

export default function CartDrawer() {
  const { cart, loading, drawerOpen, closeDrawer, updateQuantity, removeItem } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);
  const items = cart?.items ?? [];
  const isEmpty = items.length === 0;
  const subtotal = cart?.subtotal ?? 0;
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const hasFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const progressPct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      trackCartViewed({
        item_count: cart?.item_count ?? 0,
        subtotal: cart?.subtotal ?? 0,
        source: "drawer",
      });
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && drawerOpen) closeDrawer();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [drawerOpen, closeDrawer]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-dark/60 transition-opacity duration-300 ${
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 z-[70] h-full w-full max-w-[420px] bg-cream border-l-[3px] border-dark shadow-[-6px_0px_0px_0px_var(--dark)] flex flex-col transition-transform duration-300 ease-in-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
      >
        {/* Header — compact */}
        <div className="flex items-center justify-between px-5 py-3 border-b-[3px] border-dark bg-white">
          <div className="flex items-center gap-2.5">
            <h2 className="font-black text-dark text-base uppercase tracking-wide">
              Tu Carrito
            </h2>
            {cart && cart.item_count > 0 && (
              <span className="min-w-[20px] h-[20px] bg-orange text-white text-[10px] font-black border-[1.5px] border-dark flex items-center justify-center px-1">
                {cart.item_count}
              </span>
            )}
          </div>
          <button
            onClick={closeDrawer}
            className="w-8 h-8 flex items-center justify-center border-2 border-dark bg-cream hover:bg-dark hover:text-cream transition-colors"
            aria-label="Cerrar carrito"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Free shipping progress */}
        {!isEmpty && (
          <div className="px-5 py-3 border-b-2 border-dark/20 bg-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-dark">
                {hasFreeShipping
                  ? "Tienes envio gratis!"
                  : `Te faltan €${formatPrice(remaining)} para envio gratis`}
              </span>
              {hasFreeShipping && (
                <span className="text-xs font-black text-orange uppercase">Gratis</span>
              )}
            </div>
            <div className="w-full h-3 bg-dark/15 border-2 border-dark overflow-hidden">
              <div
                className="h-full bg-orange transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Combo tier nudge — above items */}
        {!isEmpty && (
          <div className="px-5 py-2 border-b border-dark/10">
            <ComboTierBanner compact />
          </div>
        )}

        {/* Scrollable: items + upsell */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted font-medium">Cargando...</p>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
              <ShoppingCart size={48} className="text-muted" strokeWidth={1.5} />
              <p className="font-bold text-muted text-lg uppercase">Tu carrito esta vacio</p>
              <button
                onClick={closeDrawer}
                className="mt-2 bg-orange text-white px-8 py-2.5 font-black text-xs uppercase tracking-widest border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              >
                Ir a la Tienda
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {items.map((item) => {
                  const price = centsToDisplay(item.unit_price);
                  const thumbUrl = getThumbnailUrl(item.thumbnail);

                  return (
                    <div
                      key={item.id}
                      className="border-2 border-dark bg-white p-2.5 flex items-center gap-3"
                    >
                      {/* Thumbnail */}
                      <div className="w-14 h-14 border-[1.5px] border-dark overflow-hidden flex-shrink-0 relative bg-cream">
                        {thumbUrl ? (
                          <Image src={thumbUrl} alt={item.title} fill className="object-cover" sizes="56px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted text-xs" aria-hidden>&mdash;</div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-dark text-xs truncate uppercase leading-tight">
                          {item.title}
                        </p>
                        <p className="font-black text-dark text-sm mt-0.5">
                          €{price.toFixed(2)} <span className="text-[8px] font-bold text-dark/40">BCV</span>
                        </p>
                      </div>

                      {/* Controls — right side */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="flex items-center">
                          <button
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            className="w-6 h-6 border-[1.5px] border-dark bg-cream flex items-center justify-center hover:bg-dark hover:text-cream transition-colors"
                            aria-label="Reducir cantidad"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <QuantityInput
                            value={item.quantity}
                            onCommit={(n) => updateQuantity(item.id, n)}
                            className="w-6 h-6 border-y-[1.5px] border-dark text-center font-bold text-[11px] bg-white focus:outline-none focus:bg-cream"
                          />
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 border-[1.5px] border-dark bg-cream flex items-center justify-center hover:bg-dark hover:text-cream transition-colors"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            trackProductRemovedFromCart({
                              product_id: (item as any).product_id,
                              variant_id: (item as any).variant_id,
                              title: item.title,
                              quantity: item.quantity,
                              cart_size_after: Math.max(0, (cart?.item_count ?? 0) - item.quantity),
                              reason: "drawer_remove_click",
                            });
                            removeItem(item.id);
                          }}
                          className="text-muted hover:text-primary transition-colors p-0.5"
                          aria-label="Eliminar producto"
                        >
                          <Trash2 size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cross-sell inside scroll area */}
              <UpsellSection
                cartItemIds={cart!.items.map((i) => i.id)}
                compact
              />
            </>
          )}
        </div>

        {/* Footer — clean subtotal + checkout */}
        {!isEmpty && (() => {
          const totalItems = cart?.item_count ?? 0;
          const cartLineItems = (cart?.items ?? []).map(i => ({ quantity: i.quantity, unit_price: centsToDisplay(i.unit_price), variant_id: i.variant_id }));
          const { discount, discountedTotal, activeTier, wholesaleDiscount, hasWholesale } = applyComboDiscount(subtotal, totalItems, cartLineItems);
          const hasDiscount = activeTier || hasWholesale;

          return (
          <div className="border-t-[3px] border-dark bg-white px-5 py-3">
            {/* Price summary */}
            {hasDiscount ? (
              <div className="flex items-baseline justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-dark uppercase tracking-wide text-sm">Total</span>
                  <span className="text-xs text-dark/40 line-through">€{formatPrice(subtotal)}</span>
                  {activeTier && (
                    <span className="text-[10px] font-bold text-secondary uppercase bg-secondary/10 px-1.5 py-0.5 border border-secondary/20">
                      {activeTier.label}
                    </span>
                  )}
                </div>
                <span className="font-black text-orange text-xl">€{formatPrice(discountedTotal)} <span className="text-[9px] font-bold text-orange/50">BCV</span></span>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-3">
                <span className="font-black text-dark uppercase tracking-wide text-sm">Total</span>
                <span className="font-black text-dark text-xl">€{formatPrice(subtotal)} <span className="text-[9px] font-bold text-dark/40">BCV</span></span>
              </div>
            )}

            {/* Checkout button */}
            <Link
              href="/checkout"
              onClick={closeDrawer}
              className="flex items-center justify-center gap-2 w-full bg-orange text-white py-3 font-black text-xs uppercase tracking-widest border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
              Pagar
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>

            <button
              onClick={closeDrawer}
              className="w-full text-center mt-2 text-muted text-xs font-medium hover:text-dark transition-colors uppercase py-1"
            >
              Seguir Comprando
            </button>
          </div>
          );
        })()}
      </div>
    </>
  );
}
