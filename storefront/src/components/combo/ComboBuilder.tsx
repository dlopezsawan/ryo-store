"use client";

import { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";
import { Plus, X, ShoppingBag, Sparkles, Package } from "lucide-react";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  category: string;
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
}

interface ComboItem {
  product: Product;
  quantity: number;
}

const MAX_ITEMS = 10;
const DISCOUNT_THRESHOLD = 3;
const DISCOUNT_PERCENT = 10;

export default function ComboBuilder({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [comboError, setComboError] = useState<string | null>(null);
  const { addItem } = useCart();

  const totalItemCount = useMemo(
    () => comboItems.reduce((sum, item) => sum + item.quantity, 0),
    [comboItems]
  );

  const subtotal = useMemo(
    () =>
      comboItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      ),
    [comboItems]
  );

  const hasDiscount = totalItemCount >= DISCOUNT_THRESHOLD;
  const discountAmount = hasDiscount
    ? subtotal * (DISCOUNT_PERCENT / 100)
    : 0;
  const total = subtotal - discountAmount;

  const filteredProducts = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter(
      (p) => p.category_id === activeCategory || p.category === activeCategory
    );
  }, [products, activeCategory]);

  const addToCombo = useCallback(
    (product: Product) => {
      if (totalItemCount >= MAX_ITEMS) return;

      setAddedId(product.id);
      setTimeout(() => setAddedId(null), 400);

      setComboItems((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return [...prev, { product, quantity: 1 }];
      });
    },
    [totalItemCount]
  );

  const removeFromCombo = useCallback((productId: string) => {
    setComboItems((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      if (!existing) return prev;
      if (existing.quantity > 1) {
        return prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter((item) => item.product.id !== productId);
    });
  }, []);

  const removeAllOfProduct = useCallback((productId: string) => {
    setComboItems((prev) =>
      prev.filter((item) => item.product.id !== productId)
    );
  }, []);

  const addComboToCart = useCallback(async () => {
    if (comboItems.length === 0) return;
    setAdding(true);
    setComboError(null);
    const failedItems: ComboItem[] = [];
    try {
      // Fetch variant IDs for each product, then add to cart
      for (const item of comboItems) {
        let addedOk = false;
        try {
          const res = await fetch(
            `/api/product-variant?slug=${encodeURIComponent(item.product.slug)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.variantId) {
              const { ok } = await addItem(data.variantId, item.quantity);
              addedOk = ok;
            }
          }
        } catch {
          // per-item fetch failure
        }
        if (!addedOk) {
          failedItems.push(item);
        }
      }
      if (failedItems.length === 0) {
        // All items added successfully — clear the combo
        setComboItems([]);
      } else {
        // Keep only the items that failed so the user can retry
        setComboItems(failedItems);
        const names = failedItems.map((i) => i.product.name).join(", ");
        setComboError(
          `No se pudo agregar al carrito: ${names}. Verifica tu conexión e intenta de nuevo.`
        );
      }
    } catch (err) {
      console.error("Error adding combo to cart:", err);
      setComboError("Error inesperado al agregar el combo. Intenta de nuevo.");
    } finally {
      setAdding(false);
    }
  }, [comboItems, addItem]);

  // Build category tabs from actual categories, with "Todos" first
  const categoryTabs = useMemo(() => {
    const tabs: { id: string; label: string }[] = [
      { id: "all", label: "Todos" },
    ];
    // Only show categories that have products
    const productCatIds = new Set(products.map((p) => p.category_id).filter(Boolean));
    const productCatNames = new Set(products.map((p) => p.category));

    for (const cat of categories) {
      if (productCatIds.has(cat.id) || productCatNames.has(cat.name)) {
        tabs.push({ id: cat.id, label: cat.name });
      }
    }

    // If no categories matched, use product category names as fallback
    if (tabs.length === 1 && products.length > 0) {
      const uniqueCats = Array.from(new Set(products.map((p) => p.category)));
      for (const name of uniqueCats) {
        tabs.push({ id: name, label: name });
      }
    }

    return tabs;
  }, [categories, products]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Left Column - Product Selector */}
      <div className="flex-1 min-w-0">
        {/* Category Tabs */}
        <div className="mb-6 overflow-x-auto filter-scroll -mx-4 px-4">
          <div className="flex gap-2 w-max">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-4 py-2 font-bold text-xs uppercase tracking-widest whitespace-nowrap border-2 border-dark transition-all ${
                  activeCategory === tab.id
                    ? "bg-orange text-white shadow-[3px_3px_0px_0px_#1A1A1A]"
                    : "bg-cream text-dark hover:bg-dark hover:text-cream shadow-[2px_2px_0px_0px_#1A1A1A] hover:shadow-[3px_3px_0px_0px_#1A1A1A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {filteredProducts.map((product) => {
            const inCombo = comboItems.find(
              (item) => item.product.id === product.id
            );
            const isJustAdded = addedId === product.id;

            return (
              <div
                key={product.id}
                className={`group relative bg-white border-2 border-dark transition-all duration-150 ${
                  inCombo
                    ? "shadow-[4px_4px_0px_0px_var(--orange)] border-orange"
                    : "shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_#1A1A1A]"
                } ${isJustAdded ? "scale-[0.97]" : ""}`}
              >
                {/* Quantity badge */}
                {inCombo && (
                  <span className="absolute -top-2 -right-2 z-10 min-w-[24px] h-6 bg-orange text-white text-xs font-black border-2 border-dark flex items-center justify-center px-1">
                    {inCombo.quantity}
                  </span>
                )}

                {/* Product Image */}
                <div className="relative aspect-square overflow-hidden bg-cream">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={300}
                    height={300}
                    sizes="(max-width: 768px) 45vw, 30vw"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Product Info */}
                <div className="p-2.5 md:p-3 border-t-2 border-dark">
                  <span className="text-secondary text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
                    {product.category}
                  </span>
                  <h3 className="font-bold text-dark text-xs md:text-sm leading-tight line-clamp-2 mt-0.5">
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-black text-dark text-base md:text-lg">
                      €{formatPrice(product.price)}
                    </span>
                    <button
                      onClick={() => addToCombo(product)}
                      disabled={totalItemCount >= MAX_ITEMS}
                      className={`flex items-center justify-center w-8 h-8 md:w-9 md:h-9 border-2 border-dark font-black text-lg transition-all ${
                        totalItemCount >= MAX_ITEMS
                          ? "bg-cream text-muted cursor-not-allowed"
                          : "bg-orange text-white shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:scale-95"
                      }`}
                      aria-label={`Agregar ${product.name} al combo`}
                    >
                      <Plus size={18} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div
            className="text-center py-12 border-2 border-dark bg-white"
            style={{ boxShadow: "4px 4px 0 0 var(--secondary)" }}
          >
            <p className="text-muted text-sm">
              No hay productos en esta categoria.
            </p>
          </div>
        )}
      </div>

      {/* Right Column - Combo Summary (sticky) */}
      <div className="lg:w-[380px] xl:w-[420px] flex-shrink-0">
        <div className="lg:sticky lg:top-24">
          {/* Title bar */}
          <div className="bg-dark text-cream px-4 py-3 flex items-center gap-3">
            <Package size={20} strokeWidth={2.5} />
            <span className="font-black text-base uppercase tracking-widest">
              Tu Combo
            </span>
            {totalItemCount > 0 && (
              <span className="ml-auto bg-orange text-white text-xs font-black px-2 py-0.5 border border-cream/30">
                {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
              </span>
            )}
          </div>

          {/* Workspace area */}
          <div
            className="bg-cream border-[3px] border-dark border-t-0 p-4 md:p-5 min-h-[300px] flex flex-col"
            style={{ boxShadow: "8px 8px 0px 0px var(--secondary)" }}
          >
            {comboItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 border-2 border-dark/20 flex items-center justify-center mb-4 bg-white">
                  <ShoppingBag
                    size={28}
                    strokeWidth={1.5}
                    className="text-muted"
                  />
                </div>
                <p className="text-muted text-sm font-medium">
                  Agrega productos para armar tu combo
                </p>
                <p className="text-muted/60 text-xs mt-1">
                  Selecciona productos del catalogo
                </p>
              </div>
            ) : (
              <div className="flex-1">
                {/* Combo items */}
                <div className="flex flex-col gap-2.5 mb-4">
                  {comboItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-3 bg-white border-2 border-dark p-2 shadow-[2px_2px_0px_0px_#1A1A1A] transition-all"
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 flex-shrink-0 border border-dark overflow-hidden bg-cream">
                        <Image
                          src={item.product.image}
                          alt={item.product.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-dark text-xs leading-tight line-clamp-1">
                          {item.product.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-dark text-xs font-black">
                            €{formatPrice(item.product.price)}
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-muted text-[10px]">
                              x{item.quantity}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => removeFromCombo(item.product.id)}
                          className="w-6 h-6 flex items-center justify-center border border-dark bg-cream text-dark text-xs font-black hover:bg-primary hover:text-white transition-colors"
                          aria-label="Quitar uno"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-black text-dark">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addToCombo(item.product)}
                          disabled={totalItemCount >= MAX_ITEMS}
                          className="w-6 h-6 flex items-center justify-center border border-dark bg-cream text-dark text-xs font-black hover:bg-orange hover:text-white transition-colors disabled:opacity-40"
                          aria-label="Agregar uno mas"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeAllOfProduct(item.product.id)}
                          className="w-6 h-6 flex items-center justify-center ml-1 border border-dark bg-white text-dark hover:bg-primary hover:text-white transition-colors"
                          aria-label={`Eliminar ${item.product.name}`}
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t-2 border-dark pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark font-medium">Subtotal</span>
                    <span className="text-dark font-bold">
                      €{formatPrice(subtotal)}
                    </span>
                  </div>

                  {hasDiscount && (
                    <div className="flex justify-between text-sm items-center">
                      <span className="flex items-center gap-1.5">
                        <span className="bg-primary text-white text-[10px] font-black px-1.5 py-0.5 uppercase tracking-wider">
                          -{DISCOUNT_PERCENT}%
                        </span>
                        <span className="text-primary font-bold">
                          Descuento combo
                        </span>
                      </span>
                      <span className="text-primary font-black">
                        -€{formatPrice(discountAmount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between border-t-2 border-dark pt-2">
                    <span className="text-dark font-black text-lg uppercase">
                      Total
                    </span>
                    <span className="text-dark font-black text-xl">
                      €{formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Discount hint */}
            {!hasDiscount && (
              <div className="mt-4 bg-white border-2 border-dashed border-secondary/50 p-3 text-center">
                <p className="text-secondary text-xs font-bold flex items-center justify-center gap-1.5">
                  <Sparkles size={14} strokeWidth={2.5} />
                  Agrega {DISCOUNT_THRESHOLD - totalItemCount}{" "}
                  {DISCOUNT_THRESHOLD - totalItemCount === 1
                    ? "producto mas"
                    : "productos mas"}{" "}
                  para obtener 10% de descuento
                </p>
              </div>
            )}

            {/* Error message for partial/full add failures */}
            {comboError && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 border-2 border-red-400 p-3">
                <span className="text-red-600 font-black text-base leading-none flex-shrink-0 mt-0.5">!</span>
                <p className="text-red-700 text-xs font-medium leading-snug">{comboError}</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={addComboToCart}
              disabled={comboItems.length === 0 || adding}
              className={`mt-4 w-full flex items-center justify-center gap-2 px-6 py-3.5 font-black text-sm uppercase tracking-widest border-2 border-dark transition-all ${
                comboItems.length === 0
                  ? "bg-cream text-muted cursor-not-allowed"
                  : "bg-orange text-white shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[1px_1px_0px_0px_#1A1A1A] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
              }`}
            >
              {adding ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent" />
                  Agregando...
                </>
              ) : (
                <>
                  <ShoppingBag size={16} strokeWidth={2.5} />
                  Agregar combo al carrito
                </>
              )}
            </button>

            {totalItemCount >= MAX_ITEMS && (
              <p className="text-primary text-[10px] font-bold text-center mt-2">
                Maximo {MAX_ITEMS} items por combo
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
