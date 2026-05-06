"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import QuickViewModal from "@/components/products/QuickViewModal";

interface QuickViewProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  category?: string;
  description?: string;
}

interface QuickViewContextValue {
  openQuickView: (productSlug: string) => void;
  closeQuickView: () => void;
}

const QuickViewContext = createContext<QuickViewContextValue | null>(null);

export function QuickViewProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<QuickViewProduct | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const closeQuickView = useCallback(() => {
    setProduct(null);
    setVariantId(null);
  }, []);

  const openQuickView = useCallback(async (slug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/product?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.product) {
        setProduct(data.product);
        setVariantId(data.variantId ?? null);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  return (
    <QuickViewContext.Provider value={{ openQuickView, closeQuickView }}>
      {children}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/40">
          <div className="w-10 h-10 border-4 border-orange border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <QuickViewModal
        product={product}
        variantId={variantId}
        onClose={closeQuickView}
      />
    </QuickViewContext.Provider>
  );
}

export function useQuickView() {
  const ctx = useContext(QuickViewContext);
  if (!ctx)
    throw new Error("useQuickView must be used within QuickViewProvider");
  return ctx;
}
