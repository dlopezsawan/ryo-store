"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Zap } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { getNextTier, getActiveTier, countQualifyingUniqueSkus } from "@/lib/combo-tiers";
import QuantityInput from "@/components/form/QuantityInput";
import { trackAddToCart, trackProductViewed, trackVariantSelected } from "@/lib/posthog";
import { useEngagement } from "@/lib/useEngagement";

interface VariantOption {
  id: string;
  title: string;
  optionValue?: string;
}

interface Props {
  variantId: string;
  variants?: VariantOption[];
  productId?: string;
  productTitle?: string;
  productPrice?: number;
  category?: string;
}

export default function ProductActions({ variantId, variants, productId, productTitle, productPrice, category }: Props) {
  const { addItem, cart, openDrawer } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState(variantId);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track product_viewed once per product view
  useEffect(() => {
    if (productId && productTitle) {
      trackProductViewed({
        product_id: productId,
        variant_id: variantId,
        title: productTitle,
        price: productPrice,
        category,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Track high engagement + scroll depth on PDP
  useEngagement({
    page: typeof window !== "undefined" ? window.location.pathname : "/pdp",
    productId,
    enabled: !!productId,
  });

  // Track when user switches variants (signal of interest in specific option)
  useEffect(() => {
    if (!productId || !productTitle) return;
    if (selectedVariantId === variantId) return; // skip initial render
    const opt = variants?.find((v) => v.id === selectedVariantId);
    trackVariantSelected({
      product_id: productId,
      variant_id: selectedVariantId,
      title: productTitle,
      price: productPrice,
      category,
      option_values: opt?.optionValue ? { value: opt.optionValue } : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariantId]);

  // Combo se mide por VARIEDAD: cuántos SKUs únicos no-mayoristas hay en
  // el cart. Si esta línea ya está en el cart no añade unique count;
  // si es nueva lo aumenta en 1.
  const items = cart?.items ?? [];
  const currentUnique = countQualifyingUniqueSkus(items);
  const variantAlreadyInCart = items.some((i) => i.variant_id === selectedVariantId);
  // Proyectamos +1 al unique count solo si el variant no está aún en el cart
  // y la qty proyectada no lo lleva a mayorista (entonces seguiría sin contar).
  const existingLineQty = items.find((i) => i.variant_id === selectedVariantId)?.quantity ?? 0;
  const projectedLineQty = existingLineQty + quantity;
  const projectedUnique = variantAlreadyInCart || projectedLineQty >= 24
    ? currentUnique
    : currentUnique + 1;
  const currentTier = getActiveTier(currentUnique);
  const projectedTier = getActiveTier(projectedUnique);
  const nextTier = getNextTier(projectedUnique);
  const wouldUnlockNew = projectedTier && (!currentTier || projectedTier.discount > currentTier.discount);

  function decrement() {
    setQuantity((q) => Math.max(1, q - 1));
  }

  function increment() {
    setQuantity((q) => Math.min(99, q + 1));
  }

  async function handleAddToCart() {
    setLoading(true);
    setFeedback(null);
    setErrorMsg(null);
    const { ok, error } = await addItem(selectedVariantId, quantity);
    setLoading(false);
    if (ok) {
      setFeedback("success");
      openDrawer();
      trackAddToCart({
        product_id: productId || "(unknown)",
        variant_id: selectedVariantId,
        title: productTitle || "(unknown)",
        price: productPrice,
        category,
        quantity,
        // cart?.item_count is already updated by addItem (context sets new cart)
        cart_size_after: (cart?.item_count ?? 0) + quantity,
      });
      setTimeout(() => setFeedback(null), 2000);
    } else {
      setFeedback("error");
      setErrorMsg(error || "No se pudo añadir");
      setTimeout(() => {
        setFeedback(null);
        setErrorMsg(null);
      }, 5000);
    }
  }

  return (
    <div>
      {/* Variant selector */}
      {variants && variants.length > 1 && (
        <div className="mb-4">
          <span className="font-bold text-sm uppercase tracking-wider text-dark block mb-2">
            Variedad:
          </span>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariantId(v.id)}
                className={`px-4 py-2.5 text-sm font-bold uppercase tracking-wide border-2 transition-all ${
                  selectedVariantId === v.id
                    ? "bg-dark text-cream border-dark"
                    : "bg-cream text-dark border-dark/30 hover:border-dark"
                }`}
              >
                {v.optionValue || v.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity selector */}
      <div className="flex items-center gap-3 mb-3">
        <span className="font-bold text-sm uppercase tracking-wider text-dark">
          Cantidad:
        </span>
        <div className="flex items-center border-2 border-dark">
          <button
            type="button"
            onClick={decrement}
            disabled={quantity <= 1}
            className="w-10 h-10 border-r-2 border-dark bg-cream flex items-center justify-center hover:bg-dark hover:text-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minus size={16} strokeWidth={3} />
          </button>
          <QuantityInput
            value={quantity}
            onCommit={setQuantity}
            className="w-12 h-10 text-center font-black text-base text-dark bg-white border-0 focus:outline-none focus:bg-cream"
          />
          <button
            type="button"
            onClick={increment}
            disabled={quantity >= 99}
            className="w-10 h-10 border-l-2 border-dark bg-cream flex items-center justify-center hover:bg-dark hover:text-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Combo se desbloquea por VARIEDAD: cuántos productos distintos
          hay en el cart. El % se aplica a 1 unidad de cada línea. */}
      {wouldUnlockNew && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-secondary/10 border-2 border-secondary/30 animate-[fadeIn_0.2s_ease-out]">
          <Zap size={14} strokeWidth={3} className="text-secondary flex-shrink-0" />
          <p className="text-xs font-bold text-secondary">
            ¡Añadir esto desbloquea <span className="text-orange">{projectedTier!.label}</span> en 1 unidad de cada producto del cart!
          </p>
        </div>
      )}
      {!wouldUnlockNew && nextTier && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-cream border border-dark/15">
          <Zap size={12} strokeWidth={2.5} className="text-orange flex-shrink-0" />
          <p className="text-[11px] font-medium text-dark/70">
            {nextTier.skusNeeded === 1 ? (
              <>Agrega <span className="font-black text-orange">1 producto distinto más</span> → {nextTier.tier.label}</>
            ) : (
              <>Agrega <span className="font-black text-orange">{nextTier.skusNeeded} productos distintos más</span> → {nextTier.tier.label}</>
            )}
          </p>
        </div>
      )}

      {/* Add to cart + View cart */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="flex-1 min-w-0 relative">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={loading}
            className="block w-full text-center bg-orange text-white py-4 font-black text-base uppercase tracking-widest border-3 border-dark retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-60"
          >
            {loading
              ? "Añadiendo..."
              : feedback === "success"
                ? "Añadido ✓"
                : "AGREGAR AL CARRITO"}
          </button>
          {feedback === "error" && errorMsg && (
            <p className="absolute left-0 right-0 top-full mt-2 text-center text-sm text-red-600">
              {errorMsg}
            </p>
          )}
        </div>
        <Link
          href="/carrito"
          className="flex-1 min-w-0 block text-center bg-secondary text-white py-4 font-black text-base uppercase tracking-widest border-3 border-dark retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
        >
          VER CARRITO
        </Link>
      </div>

      {/* Continue shopping */}
      <Link
        href="/tienda"
        className="block text-center border-2 border-dark text-dark py-3.5 font-black text-sm uppercase tracking-widest hover:bg-dark hover:text-cream transition-all"
      >
        SEGUIR COMPRANDO
      </Link>

      {/* Trust text */}
      <p className="mt-6 text-xs text-muted border-t border-dark/10 pt-4">
        Pagos seguros desde Venezuela y el exterior &bull; Envíos rápidos &bull;
        Atención por Instagram
      </p>
    </div>
  );
}
