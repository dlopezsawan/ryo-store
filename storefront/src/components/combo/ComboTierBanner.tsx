"use client";

import { Zap, TrendingUp, Package } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { countQualifyingUniqueSkus, getActiveTier, getNextTier, applyComboDiscount } from "@/lib/combo-tiers";
import { formatPrice } from "@/lib/format";
import { centsToDisplay } from "@/lib/price";

/**
 * Banner del cart: muestra el tier combo activo (basado en SKUs únicos del
 * cart) y nudge al siguiente tier. El descuento real lo aplica el backend
 * via /store/carts/:id/recalculate-combos.
 */
export default function ComboTierBanner({ compact = false }: { compact?: boolean }) {
  const { cart } = useCart();
  const items = cart?.items ?? [];
  if (items.length === 0) return null;

  const lineItems = items.map((i) => ({
    quantity: i.quantity,
    unit_price: centsToDisplay(i.unit_price),
    variant_id: i.variant_id,
  }));
  const result = applyComboDiscount(lineItems);
  const uniqueSkus = countQualifyingUniqueSkus(items);
  const active = getActiveTier(uniqueSkus);
  const next = getNextTier(uniqueSkus);
  const savings = result.discount;

  return (
    <div className={`border-2 border-dark bg-white overflow-hidden ${compact ? "" : "shadow-[3px_3px_0px_0px_var(--secondary)]"}`}>
      {active && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-secondary/10 border-b-2 border-dark/20">
          <div className="w-7 h-7 bg-secondary text-cream flex items-center justify-center flex-shrink-0 border border-dark">
            <Zap size={14} strokeWidth={3} fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-xs uppercase tracking-wide text-secondary">
              {active.label} a 1 unidad de cada producto
            </p>
            <p className="text-[11px] text-dark/70 font-medium">
              {uniqueSkus} productos distintos · ahorras <span className="font-black text-secondary">€{formatPrice(savings)}</span>
            </p>
          </div>
        </div>
      )}

      {next && (
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-7 h-7 bg-orange/15 text-orange flex items-center justify-center flex-shrink-0 border border-orange/30">
            <TrendingUp size={14} strokeWidth={2.5} />
          </div>
          <p className="text-[11px] text-dark font-medium leading-snug">
            {next.skusNeeded === 1 ? (
              <>Agrega <span className="font-black text-orange">1 producto distinto más</span> y desbloqueas <span className="font-black text-orange">{next.tier.label}</span></>
            ) : (
              <>Agrega <span className="font-black text-orange">{next.skusNeeded} productos distintos más</span> y desbloqueas <span className="font-black text-orange">{next.tier.label}</span></>
            )}
          </p>
        </div>
      )}

      {!active && !compact && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b-2 border-dark/10">
          <div className="w-7 h-7 bg-cream text-dark flex items-center justify-center flex-shrink-0 border border-dark/20">
            <Package size={14} strokeWidth={2.5} />
          </div>
          <p className="text-[11px] text-dark/60 font-medium">
            Compra <span className="font-black">3 productos distintos</span> y obtienes 10% en 1 unidad de cada uno
          </p>
        </div>
      )}
    </div>
  );
}
