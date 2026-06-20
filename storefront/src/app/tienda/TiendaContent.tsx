"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trackCategoryViewed, trackFilterApplied } from "@/lib/posthog";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/products/ProductCard";
import Link from "next/link";
import { SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import { type ProductCategoryItem, type Product } from "@/lib/medusa";
import ProductCardSkeleton from "@/components/products/ProductCardSkeleton";

type SortOption = "relevance" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

/* ── Shared Button styles ─────────────────────────────────────────── */
function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all text-left w-full ${
        active
          ? "bg-orange text-white border-2 border-dark"
          : "bg-cream text-dark border-2 border-dark hover:bg-dark hover:text-cream"
      }`}
      style={active ? { boxShadow: "3px 3px 0 0 var(--dark)" } : undefined}
    >
      {children}
    </button>
  );
}

/* ── Filter Panel (shared between sidebar and drawer) ─────────────── */
function FilterPanel({
  categories,
  selectedCategoryId,
  materials,
  selectedMaterial,
  setSelectedMaterial,
  priceBounds,
  effectiveMin,
  effectiveMax,
  priceRange,
  setPriceRange,
  hasActiveFilters,
  onClear,
}: {
  categories: ProductCategoryItem[];
  selectedCategoryId: string | null;
  materials: string[];
  selectedMaterial: string;
  setSelectedMaterial: (m: string) => void;
  priceBounds: { min: number; max: number };
  effectiveMin: number;
  effectiveMax: number;
  priceRange: [number, number];
  setPriceRange: (r: [number, number]) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* CATEGORÍAS */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-0.5 w-6 bg-primary" />
          <span className="font-black text-dark text-xs uppercase tracking-widest">Categorías</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Link
            href="/tienda"
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all text-left ${
              selectedCategoryId === null
                ? "bg-orange text-white border-2 border-dark"
                : "bg-cream text-dark border-2 border-dark hover:bg-dark hover:text-cream"
            }`}
            style={selectedCategoryId === null ? { boxShadow: "3px 3px 0 0 var(--dark)" } : undefined}
          >
            Todos
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/tienda?category=${cat.id}`}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all text-left ${
                selectedCategoryId === cat.id
                  ? "bg-orange text-white border-2 border-dark"
                  : "bg-cream text-dark border-2 border-dark hover:bg-dark hover:text-cream"
              }`}
              style={selectedCategoryId === cat.id ? { boxShadow: "3px 3px 0 0 var(--dark)" } : undefined}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* MATERIAL */}
      {materials.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-0.5 w-6 bg-primary" />
            <span className="font-black text-dark text-xs uppercase tracking-widest">Material</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <FilterBtn active={selectedMaterial === "all"} onClick={() => setSelectedMaterial("all")}>
              Todos
            </FilterBtn>
            {materials.map((mat) => (
              <FilterBtn
                key={mat}
                active={selectedMaterial === mat}
                onClick={() => setSelectedMaterial(mat)}
              >
                {mat}
              </FilterBtn>
            ))}
          </div>
        </div>
      )}

      {/* PRECIO */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-0.5 w-6 bg-primary" />
          <span className="font-black text-dark text-xs uppercase tracking-widest">Precio</span>
        </div>

        {/* Price labels */}
        <div className="flex justify-between mb-2">
          <span
            className="px-2 py-0.5 bg-dark text-cream text-[10px] font-black tabular-nums border-2 border-dark"
            style={{ boxShadow: "2px 2px 0 0 var(--orange)" }}
          >
            €{effectiveMin}
          </span>
          <span
            className="px-2 py-0.5 bg-dark text-cream text-[10px] font-black tabular-nums border-2 border-dark"
            style={{ boxShadow: "2px 2px 0 0 var(--orange)" }}
          >
            €{effectiveMax}
          </span>
        </div>

        {/* Dual slider */}
        <div className="relative w-full h-[18px]">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-dark/15 border border-dark/10" />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-orange"
            style={{
              left: `${priceBounds.max > priceBounds.min ? ((effectiveMin - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100 : 0}%`,
              right: `${priceBounds.max > priceBounds.min ? 100 - ((effectiveMax - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100 : 0}%`,
            }}
          />
          <input
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            step={1}
            value={effectiveMin}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v <= effectiveMax) setPriceRange([v, priceRange[1] || priceBounds.max]);
            }}
            className="price-slider absolute inset-0 w-full"
            style={{ zIndex: effectiveMin > priceBounds.max - 5 ? 5 : 3 }}
          />
          <input
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            step={1}
            value={effectiveMax}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= effectiveMin) setPriceRange([priceRange[0] || priceBounds.min, v]);
            }}
            className="price-slider absolute inset-0 w-full"
            style={{ zIndex: 4 }}
          />
        </div>
      </div>

      {/* LIMPIAR */}
      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="mt-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-orange border-2 border-orange hover:bg-orange hover:text-white transition-all w-full"
        >
          Limpiar Filtros
        </button>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────── */
export default function TiendaContent({
  products,
  categories,
  selectedCategoryId,
  activeQuery,
}: {
  products: Product[];
  categories: ProductCategoryItem[];
  selectedCategoryId: string | null;
  activeQuery?: string | null;
}) {
  const router = useRouter();
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Track category_viewed once per category change
  const lastCatRef = useRef<string | null>(null);
  useEffect(() => {
    const key = selectedCategoryId || "all";
    if (lastCatRef.current === key) return;
    lastCatRef.current = key;
    const cat = categories.find((c) => c.id === selectedCategoryId);
    trackCategoryViewed({
      category: cat?.name || (selectedCategoryId ? selectedCategoryId : "all"),
      results_count: products.length,
    });
  }, [selectedCategoryId, categories, products.length]);

  // Track filter_applied events
  useEffect(() => {
    if (selectedMaterial !== "all") {
      trackFilterApplied({ filter_type: "material", value: selectedMaterial });
    }
  }, [selectedMaterial]);

  useEffect(() => {
    if (sortBy !== "relevance") {
      trackFilterApplied({ filter_type: "sort", value: sortBy });
    }
  }, [sortBy]);

  useEffect(() => {
    if (priceRange[0] > 0 || priceRange[1] > 0) {
      trackFilterApplied({
        filter_type: "price_range",
        value: `${priceRange[0]}-${priceRange[1]}`,
      });
    }
  }, [priceRange]);

  const materials = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.material) set.add(p.material); });
    return Array.from(set).sort();
  }, [products]);

  const priceBounds = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 100 };
    const prices = products.map((p) => p.price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);

  const effectiveMin = priceRange[0] || priceBounds.min;
  const effectiveMax = priceRange[1] || priceBounds.max;

  const filtered = useMemo(() => {
    const result = products.filter((p) => {
      const minP = priceRange[0] || priceBounds.min;
      const maxP = priceRange[1] || priceBounds.max;
      if (p.price < minP || p.price > maxP) return false;
      if (selectedMaterial !== "all" && p.material !== selectedMaterial) return false;
      return true;
    });

    // Apply sorting
    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        result.sort((a, b) => a.name.localeCompare(b.name, "es"));
        break;
      case "name-desc":
        result.sort((a, b) => b.name.localeCompare(a.name, "es"));
        break;
      default:
        break;
    }

    return result;
  }, [products, priceRange, selectedMaterial, priceBounds, sortBy]);

  const hasActiveFilters =
    !!activeQuery ||
    selectedMaterial !== "all" ||
    (priceRange[0] > 0 && priceRange[0] > priceBounds.min) ||
    (priceRange[1] > 0 && priceRange[1] < priceBounds.max);

  function handleClear() {
    setPriceRange([0, 0]);
    setSelectedMaterial("all");
    // If there's an active search query, navigate back to /tienda to drop it
    if (activeQuery) {
      router.push("/tienda");
    }
  }

  const filterPanelProps = {
    categories,
    selectedCategoryId,
    materials,
    selectedMaterial,
    setSelectedMaterial,
    priceBounds,
    effectiveMin,
    effectiveMax,
    priceRange,
    setPriceRange,
    hasActiveFilters,
    onClear: handleClear,
  };

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-4xl md:text-6xl uppercase tracking-tight">
            Tienda
          </h1>
        </div>

        {/* ── Desktop layout: sidebar + products ── */}
        <div className="flex gap-8 items-start">

          {/* ── Sidebar (desktop only) ── */}
          <aside className="hidden md:block w-[280px] shrink-0 sticky top-24 border-[3px] border-dark bg-white p-5"
            style={{ boxShadow: "6px 6px 0 0 var(--secondary)" }}
          >
            <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-dark">
              <SlidersHorizontal size={16} strokeWidth={2.5} className="text-dark" />
              <h2 className="font-black text-dark text-sm uppercase tracking-widest">Filtros</h2>
            </div>
            <FilterPanel {...filterPanelProps} />
          </aside>

          {/* ── Right column: mobile filter button + count + products ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile: filter toggle + sort */}
            <div className="flex items-center justify-between gap-2 mb-4 md:hidden">
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-dark text-cream font-black text-xs uppercase tracking-widest border-2 border-dark"
                style={{ boxShadow: "3px 3px 0 0 var(--orange)" }}
              >
                <SlidersHorizontal size={14} strokeWidth={2.5} />
                Filtros
                {hasActiveFilters && (
                  <span className="w-4 h-4 rounded-full bg-orange text-white text-[9px] flex items-center justify-center font-black">
                    !
                  </span>
                )}
              </button>
              <div className="relative flex items-center">
                <ArrowUpDown size={12} strokeWidth={2.5} className="absolute left-2.5 text-dark pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-white text-dark font-black text-[10px] uppercase tracking-widest pl-7 pr-6 py-2.5 border-2 border-dark cursor-pointer"
                  style={{ boxShadow: "3px 3px 0 0 var(--dark)" }}
                >
                  <option value="relevance">Relevancia</option>
                  <option value="price-asc">Precio: Menor</option>
                  <option value="price-desc">Precio: Mayor</option>
                  <option value="name-asc">A-Z</option>
                  <option value="name-desc">Z-A</option>
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="var(--dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            {hasActiveFilters && (
              <p className="text-sm text-muted font-bold mb-2 md:hidden">
                {filtered.length} resultado{filtered.length !== 1 && "s"}
              </p>
            )}

            {/* Desktop: results count + sort */}
            <div className="hidden md:flex items-center justify-between mb-4">
              <p className="text-sm text-muted font-bold">
                {filtered.length} {filtered.length === 1 ? "producto encontrado" : "productos encontrados"}
              </p>
              <div className="relative flex items-center">
                <ArrowUpDown size={13} strokeWidth={2.5} className="absolute left-3 text-dark pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-white text-dark font-black text-xs uppercase tracking-widest pl-8 pr-8 py-2 border-2 border-dark cursor-pointer hover:bg-cream transition-colors"
                  style={{ boxShadow: "3px 3px 0 0 var(--dark)" }}
                >
                  <option value="relevance">Relevancia</option>
                  <option value="price-asc">Precio: Menor a Mayor</option>
                  <option value="price-desc">Precio: Mayor a Menor</option>
                  <option value="name-asc">A-Z</option>
                  <option value="name-desc">Z-A</option>
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="var(--dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>

            {/* Active search query chip */}
            {activeQuery && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted font-bold uppercase tracking-widest">Búsqueda:</span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-dark text-cream text-[11px] font-black uppercase tracking-widest border-2 border-dark"
                  style={{ boxShadow: "2px 2px 0 0 var(--orange)" }}
                >
                  {activeQuery}
                  <button
                    onClick={handleClear}
                    aria-label="Limpiar búsqueda"
                    className="ml-0.5 hover:text-orange transition-colors"
                  >
                    <X size={11} strokeWidth={3} />
                  </button>
                </span>
              </div>
            )}

            {/* Product grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted text-lg mb-4">
                  {hasActiveFilters ? "No hay productos con estos filtros" : "No hay productos en esta categoría"}
                </p>
                {hasActiveFilters ? (
                  <button onClick={handleClear} className="text-primary font-bold hover:underline">
                    Limpiar filtros
                  </button>
                ) : (
                  <Link href="/tienda" className="text-primary font-bold hover:underline">
                    Ver todos los productos
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 stagger-children">
                {filtered.map((product, index) => (
                  <ProductCard key={product.id} {...product} priority={index < 4} />
                ))}
              </div>
            )}

            {/* Offer Banner */}
            <div
              className="mt-12 md:mt-16 bg-secondary border-3 border-dark p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6"
              style={{ borderWidth: "3px", boxShadow: "8px 8px 0px 0px var(--primary)" }}
            >
              <div>
                <span className="text-cream/60 text-xs font-bold uppercase tracking-[0.2em]">Oferta Semanal</span>
                <h3 className="font-black text-cream text-2xl md:text-4xl uppercase tracking-tight mt-1">
                  Envío Gratis +$10
                </h3>
                <p className="text-cream/70 text-sm mt-1">En entregas inmediatas en Valencia</p>
              </div>
              <Link
                href="/tienda"
                className="bg-orange text-white px-8 py-3 font-black text-sm uppercase tracking-widest rounded-lg retro-border retro-shadow-sm hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all flex-shrink-0"
              >
                Comprar Ahora
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── Mobile Drawer ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-dark/40 z-40 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div
            className="fixed inset-y-0 left-0 w-[300px] max-w-[85vw] bg-white z-50 md:hidden overflow-y-auto"
            style={{ borderRight: "3px solid var(--dark)", boxShadow: "6px 0 0 0 var(--secondary)" }}
          >
            <div className="flex items-center justify-between p-4 border-b-2 border-dark mb-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} strokeWidth={2.5} />
                <span className="font-black text-dark text-sm uppercase tracking-widest">Filtros</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 border-2 border-dark hover:bg-dark hover:text-cream transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-4">
              <FilterPanel {...filterPanelProps} />
            </div>
            {/* Apply button */}
            <div className="p-4 border-t-2 border-dark mt-4">
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full py-3 bg-orange text-white font-black text-xs uppercase tracking-widest border-2 border-dark"
                style={{ boxShadow: "3px 3px 0 0 var(--dark)" }}
              >
                Ver {filtered.length} resultado{filtered.length !== 1 && "s"}
              </button>
            </div>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}
