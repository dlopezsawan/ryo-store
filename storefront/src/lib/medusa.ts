/**
 * Cliente API de Medusa Store para el storefront.
 * Usa fetch con x-publishable-api-key en el header.
 * Incluye caché en memoria (30s TTL) para evitar sobrecarga y desapariciones.
 */

// Always use the public URL — internal Docker URL (http://medusa:9000) causes
// intermittent 400 errors due to publishable key validation checking origin.
const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000";
const PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || BACKEND_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

import { centsToDisplay } from "./price";

// ─── In-memory cache (survives across requests in the same process) ──────────
const CACHE_TTL = 60_000; // 60 seconds
const memCache = new Map<string, { data: unknown; ts: number }>();

function cacheGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { memCache.delete(key); return null; }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown) {
  memCache.set(key, { data, ts: Date.now() });
}

// ─── Fetch with retry ────────────────────────────────────────────────────────
async function fetchWithRetry(url: string, init: RequestInit, retries = 4): Promise<Response> {
  let lastRes: Response | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastRes = res;
    } catch (err) {
      if (i === retries) throw err;
    }
    // Brief pause before retry (increases each attempt)
    await new Promise((r) => setTimeout(r, 150 * (i + 1)));
  }
  return lastRes!;
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (PUBLISHABLE_KEY) {
    (headers as Record<string, string>)["x-publishable-api-key"] = PUBLISHABLE_KEY;
  }
  return headers;
}

/**
 * Región por defecto (Venezuela) — SIEMPRE necesaria para precios.
 * Hardcoded fallback para evitar $0.00 cuando el fetch de regiones falla.
 */
const FALLBACK_REGION_ID = process.env.MEDUSA_REGION_ID || "reg_01KKKY6BGV511PKKHK3WRK3VN8";
let cachedRegionId: string | null = null;

async function getDefaultRegionId(): Promise<string> {
  if (cachedRegionId) return cachedRegionId;
  try {
    const res = await fetchWithRetry(
      `${BACKEND_URL}/store/regions?limit=20&fields=id,*countries`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!res.ok) {
      cachedRegionId = FALLBACK_REGION_ID;
      return cachedRegionId;
    }
    const data = (await res.json()) as {
      regions?: Array<{ id: string; countries?: Array<{ iso_2?: string }> }>;
    };
    const regions = data.regions ?? [];
    const ve = regions.find((r) =>
      r.countries?.some((c) => c.iso_2?.toLowerCase() === "ve")
    );
    const id = ve?.id ?? regions[0]?.id ?? FALLBACK_REGION_ID;
    cachedRegionId = id;
    return id;
  } catch {
    cachedRegionId = FALLBACK_REGION_ID;
    return cachedRegionId;
  }
}

// Tipos basados en la respuesta de Medusa Store API
interface MedusaProductImage {
  id: string;
  url: string;
}

interface MedusaVariant {
  id: string;
  calculated_price?: {
    calculated_amount: number | null;
    original_amount?: number | null;
    currency_code: string;
  };
}

interface MedusaProductCategory {
  id: string;
  name: string;
  handle: string;
}

export interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  subtitle?: string;
  description?: string;
  material?: string;
  thumbnail?: string;
  images?: MedusaProductImage[];
  variants?: MedusaVariant[];
  product_categories?: MedusaProductCategory[];
  categories?: MedusaProductCategory[];
}

interface ProductsResponse {
  products: MedusaProduct[];
  count: number;
  offset: number;
  limit: number;
}

export interface ProductCategoryItem {
  id: string;
  name: string;
  handle: string;
}

/** Producto mapeado para el storefront (compatible con ProductCard y páginas) */
export type ProductCategory = "Conos" | "Papers" | "Grinders" | "Accesorios";

export interface Product {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  material?: string;
  price: number;
  rating: number;
  image: string;
  /** Optional standalone hero-slider image (product.metadata.slider_image in Medusa). Falls back to `image` when unset. */
  sliderImage?: string;
  category: string;
  category_id?: string;
  description?: string;
}

/** Obtiene la categoría desde product_categories, metadata o valor por defecto */
function getCategoryFromProduct(
  p: MedusaProduct
): { name: string; id?: string } {
  const cats = p.categories ?? p.product_categories;
  const firstCat = cats?.[0];
  if (firstCat) return { name: firstCat.name, id: firstCat.id };
  const meta = (p as { metadata?: Record<string, string> }).metadata;
  const cat = meta?.category;
  if (cat) return { name: String(cat) };
  return { name: "Otros" };
}

/** Mapea un producto de Medusa al formato del storefront. */
function mapMedusaToProduct(p: MedusaProduct): Product {
  const cp = p.variants?.[0]?.calculated_price;
  const amount =
    cp?.calculated_amount != null
      ? cp.calculated_amount
      : cp?.original_amount != null
        ? cp.original_amount
        : null;
  const price = amount != null ? centsToDisplay(amount) : 0;

  const rawImage =
    p.thumbnail ||
    p.images?.[0]?.url ||
    "/images/placeholder-product.png";
  // Prepend public backend URL for relative paths (e.g. /static/uploads/...)
  const absolutize = (u: string) =>
    u.startsWith("http://") || u.startsWith("https://")
      ? u
      : `${PUBLIC_BACKEND_URL.replace(/\/$/, "")}${u.startsWith("/") ? "" : "/"}${u}`;
  const image = absolutize(rawImage);

  // Optional slider-specific image set via Medusa admin widget (product.metadata.slider_image)
  const pmeta = (p as { metadata?: Record<string, unknown> | null }).metadata;
  const metaSliderRaw =
    pmeta && typeof pmeta.slider_image === "string"
      ? (pmeta.slider_image as string)
      : null;
  const sliderImage = metaSliderRaw ? absolutize(metaSliderRaw) : undefined;

  const { name: categoryName, id: categoryId } = getCategoryFromProduct(p);
  return {
    id: p.id,
    slug: p.handle,
    name: p.title,
    price,
    rating: 4,
    image,
    sliderImage,
    category: categoryName,
    category_id: categoryId,
    description: p.description ?? undefined,
    subtitle: p.subtitle ?? undefined,
    material: p.material ?? undefined,
  };
}

/** Lista todas las categorías de productos */
export async function getProductCategories(): Promise<ProductCategoryItem[]> {
  if (!PUBLISHABLE_KEY) return [];
  try {
    const res = await fetch(
      `${BACKEND_URL}/store/product-categories?limit=100`,
      { headers: getHeaders(), next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      product_categories?: { id: string; name: string; handle: string }[];
    };
    return (data.product_categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
    }));
  } catch {
    return [];
  }
}

type CatMap = Record<string, { name: string; id: string; handle: string }>;

/** Cached category map — avoids per-category fetches on every request */
const CAT_MAP_CACHE_TTL = 60_000; // 60 seconds
let catMapCache: { data: CatMap; ts: number } | null = null;

async function getCachedCategoryMap(regionId: string): Promise<CatMap> {
  if (catMapCache && Date.now() - catMapCache.ts < CAT_MAP_CACHE_TTL) {
    return catMapCache.data;
  }
  const map = await buildCategoryMap(regionId);
  if (Object.keys(map).length > 0) {
    catMapCache = { data: map, ts: Date.now() };
  }
  return map;
}

/** Builds a map of productId -> category using a SINGLE fetch per category.
 *  Uses sequential fetches with small delay to avoid overwhelming Medusa. */
async function buildCategoryMap(
  regionId: string
): Promise<CatMap> {
  const categories = await getProductCategories();
  if (categories.length === 0) return {};
  const map: CatMap = {};
  // Fetch sequentially to avoid overwhelming Medusa (which returns 400 on burst)
  for (const cat of categories) {
    try {
      const p = new URLSearchParams({ category_id: cat.id, limit: "200", region_id: regionId });
      const res = await fetchWithRetry(`${BACKEND_URL}/store/products?${p}`, {
        headers: getHeaders(),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const d = (await res.json()) as ProductsResponse;
      for (const prod of d.products || []) {
        map[prod.id] = { name: cat.name, id: cat.id, handle: cat.handle };
      }
    } catch {
      // ignore per-category fetch failures
    }
  }
  return map;
}

/** Lista productos, opcionalmente filtrados por categoría o búsqueda */
export async function getProducts(options?: {
  categoryId?: string;
  q?: string;
}): Promise<Product[]> {
  if (!PUBLISHABLE_KEY) return [];

  const cacheKey = `products:${options?.categoryId ?? ""}:${options?.q ?? ""}`;
  const cached = cacheGet<Product[]>(cacheKey);
  if (cached) return cached;

  const doFetch = async (regionId: string) => {
    const params = new URLSearchParams({
      limit: "100",
      region_id: regionId,
      fields: "*variants.calculated_price,*categories,+metadata",
    });
    if (options?.categoryId) params.set("category_id", options.categoryId);
    if (options?.q?.trim()) params.set("q", options.q.trim());
    const url = `${BACKEND_URL}/store/products?${params.toString()}`;
    const res = await fetchWithRetry(url, { headers: getHeaders(), cache: "no-store" });
    if (!res.ok) return [];
    const data: ProductsResponse = await res.json();
    return data.products || [];
  };
  try {
    const regionId = await getDefaultRegionId();
    const rawProducts = await doFetch(regionId);
    if (rawProducts.length === 0) return [];

    // Get category map (cached separately for 60s)
    const catMap = await getCachedCategoryMap(regionId);
    const result = rawProducts.map((p) => {
      const catInfo = catMap[p.id];
      if (catInfo && !p.product_categories?.length) {
        p = { ...p, product_categories: [{ id: catInfo.id, name: catInfo.name, handle: catInfo.handle }] };
      }
      return mapMedusaToProduct(p);
    });
    cacheSet(cacheKey, result);
    return result;
  } catch {
    return [];
  }
}

/** Obtiene un producto por handle (slug) */
export async function getProductByHandle(handle: string): Promise<Product | null> {
  const r = await getProductByHandleWithVariant(handle);
  return r?.product ?? null;
}

/** Variant option for display */
export interface VariantOption {
  id: string;
  title: string;
  optionValue?: string;
}

/** Producto con variantId para añadir al carrito */
export interface ProductWithVariant {
  product: Product;
  variantId: string;
  variants?: VariantOption[];
}

/** Obtiene producto por handle con variant_id (primera variante) para el carrito */
export async function getProductByHandleWithVariant(
  handle: string
): Promise<ProductWithVariant | null> {
  if (!PUBLISHABLE_KEY) return null;

  const cacheKey = `product:${handle}`;
  const cached = cacheGet<ProductWithVariant>(cacheKey);
  if (cached) return cached;

  try {
    const regionId = await getDefaultRegionId();
    const params = new URLSearchParams({
      handle,
      limit: "1",
      region_id: regionId,
      fields: "*variants.calculated_price,*variants.options,*categories,+metadata",
    });
    const res = await fetchWithRetry(
      `${BACKEND_URL}/store/products?${params.toString()}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const data: ProductsResponse = await res.json();
    const p = data.products?.[0];
    if (!p) return null;
    const variantId = p.variants?.[0]?.id;
    if (!variantId) return null;
    // Map all variants with their option values for variant selector
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variants: VariantOption[] = (p.variants || []).map((v: any) => ({
      id: v.id as string,
      title: (v.title as string) || "Default",
      optionValue: (v.options?.[0]?.value as string) || (v.title as string) || "",
    }));
    const result = { product: mapMedusaToProduct(p), variantId, variants: variants.length > 1 ? variants : undefined };
    cacheSet(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/** Mapa slug -> Product para uso legacy (best sellers, slider, etc.) */
export async function getProductsBySlug(): Promise<Record<string, Product>> {
  const list = await getProducts();
  return list.reduce((acc, p) => {
    acc[p.slug] = p;
    return acc;
  }, {} as Record<string, Product>);
}

/** Tag por defecto para productos destacados en el slider */
const FEATURED_TAG = "Featured";

/** Producto combo para la página Combos (tag "combo" + metadata opcional) */
export interface ComboProduct extends Product {
  originalPrice?: number;
  savings?: number;
  items?: string[];
}

function mapMedusaToComboProduct(p: MedusaProduct): ComboProduct {
  const base = mapMedusaToProduct(p);
  const meta = (p as { metadata?: Record<string, unknown> }).metadata;
  if (!meta) return base;

  const originalPrice =
    typeof meta.original_price === "number"
      ? meta.original_price
      : typeof meta.original_price === "string"
        ? parseFloat(meta.original_price)
        : undefined;
  const savings =
    typeof meta.savings === "number"
      ? meta.savings
      : typeof meta.savings === "string"
        ? parseFloat(meta.savings)
        : undefined;
  let items: string[] | undefined;
  if (Array.isArray(meta.combo_items)) {
    items = meta.combo_items.map(String);
  } else if (typeof meta.combo_items === "string") {
    try {
      const parsed = JSON.parse(meta.combo_items) as unknown;
      items = Array.isArray(parsed) ? parsed.map(String) : meta.combo_items.split(",").map((s) => s.trim());
    } catch {
      items = meta.combo_items.split(",").map((s) => s.trim());
    }
  }

  return {
    ...base,
    ...(originalPrice != null && !Number.isNaN(originalPrice) && { originalPrice }),
    ...(savings != null && !Number.isNaN(savings) && { savings }),
    ...(items?.length && { items }),
  };
}

const COMBO_TAG = "Combos";

/** Productos combo para la página Combos (tag "combo" en Medusa) */
export async function getComboProducts(): Promise<ComboProduct[]> {
  if (!PUBLISHABLE_KEY) return [];
  try {
    const tagsRes = await fetch(
      `${BACKEND_URL}/store/product-tags?value=${encodeURIComponent(COMBO_TAG)}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (tagsRes.ok) {
      const tagsData = (await tagsRes.json()) as { product_tags?: { id: string }[] };
      const tagId = tagsData.product_tags?.[0]?.id;
      if (tagId) {
        const regionId = await getDefaultRegionId();
        const fetchWithRegion = (rid: string | null) => {
          const params = new URLSearchParams({ tag_id: tagId!, limit: "50" });
          if (rid) { params.set("region_id", rid); params.set("fields", "*variants.calculated_price,+metadata"); }
          return fetch(`${BACKEND_URL}/store/products?${params}`, {
            headers: getHeaders(),
            cache: "no-store",
          });
        };
        let res = await fetchWithRegion(regionId);
        if (res.ok) {
          const data: ProductsResponse = await res.json();
          let combos = (data.products || []).map(mapMedusaToComboProduct);
          if (combos.length === 0 && regionId) {
            res = await fetchWithRegion(null);
            if (res.ok) {
              const d2 = (await res.json()) as ProductsResponse;
              combos = (d2.products || []).map(mapMedusaToComboProduct);
            }
          }
          if (combos.length > 0) return combos;
        }
      }
    }

    // Fallback: primeros 4 productos como "combos" si no hay tag "combo"
    const all = await getProducts();
    return all.slice(0, 4).map((p) => ({ ...p, originalPrice: undefined, savings: undefined, items: undefined }));
  } catch {
    const all = await getProducts();
    return all.slice(0, 4).map((p) => ({ ...p, originalPrice: undefined, savings: undefined, items: undefined }));
  }
}

/** Productos destacados para el slider (tag "featured" en Medusa) */
export async function getFeaturedProducts(): Promise<Product[]> {
  if (!PUBLISHABLE_KEY) return [];
  const cacheKey = "featured";
  const cached = cacheGet<Product[]>(cacheKey);
  if (cached) return cached;
  try {
    const tagsRes = await fetchWithRetry(
      `${BACKEND_URL}/store/product-tags?value=${encodeURIComponent(FEATURED_TAG)}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (tagsRes.ok) {
      const tagsData = (await tagsRes.json()) as { product_tags?: { id: string }[] };
      const tagId = tagsData.product_tags?.[0]?.id;

      if (tagId) {
        const regionId = await getDefaultRegionId();
        const fetchWithRegion = (rid: string | null) => {
          const params = new URLSearchParams({ tag_id: tagId, limit: "20" });
          if (rid) { params.set("region_id", rid); params.set("fields", "*variants.calculated_price,+metadata"); }
          return fetchWithRetry(`${BACKEND_URL}/store/products?${params}`, {
            headers: getHeaders(),
            cache: "no-store",
          });
        };
        let res = await fetchWithRegion(regionId);
        if (res.ok) {
          const data: ProductsResponse = await res.json();
          let featured = (data.products || []).map(mapMedusaToProduct);
          if (featured.length === 0 && regionId) {
            res = await fetchWithRegion(null);
            if (res.ok) {
              const d2 = (await res.json()) as ProductsResponse;
              featured = (d2.products || []).map(mapMedusaToProduct);
            }
          }
          if (featured.length > 0) { cacheSet(cacheKey, featured); return featured; }
        }
      }
    }

    const all = await getProducts();
    const fallback = all.slice(0, 6);
    if (fallback.length > 0) cacheSet(cacheKey, fallback);
    return fallback;
  } catch {
    const all = await getProducts();
    return all.slice(0, 6);
  }
}

const BEST_SELLERS_TAG = "Best Sellers";

/** Productos más vendidos para la sección home (tag "Best Sellers" en Medusa) */
export async function getBestSellerProducts(): Promise<Product[]> {
  if (!PUBLISHABLE_KEY) return [];
  const cacheKey = "bestsellers";
  const cached = cacheGet<Product[]>(cacheKey);
  if (cached) return cached;
  try {
    const tagsRes = await fetchWithRetry(
      `${BACKEND_URL}/store/product-tags?value=${encodeURIComponent(BEST_SELLERS_TAG)}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (tagsRes.ok) {
      const tagsData = (await tagsRes.json()) as { product_tags?: { id: string }[] };
      const tagId = tagsData.product_tags?.[0]?.id;
      if (tagId) {
        const regionId = await getDefaultRegionId();
        const fetchWithRegion = (rid: string | null) => {
          const params = new URLSearchParams({ tag_id: tagId, limit: "20" });
          if (rid) { params.set("region_id", rid); params.set("fields", "*variants.calculated_price,+metadata"); }
          return fetchWithRetry(`${BACKEND_URL}/store/products?${params}`, {
            headers: getHeaders(),
            cache: "no-store",
          });
        };
        let res = await fetchWithRegion(regionId);
        if (res.ok) {
          const data: ProductsResponse = await res.json();
          let products = (data.products || []).map(mapMedusaToProduct);
          if (products.length === 0 && regionId) {
            res = await fetchWithRegion(null);
            if (res.ok) {
              const d2 = (await res.json()) as ProductsResponse;
              products = (d2.products || []).map(mapMedusaToProduct);
            }
          }
          if (products.length > 0) { cacheSet(cacheKey, products); return products; }
        }
      }
    }
    const all = await getProducts();
    const fallback = all.slice(0, 8);
    if (fallback.length > 0) cacheSet(cacheKey, fallback);
    return fallback;
  } catch {
    const all = await getProducts();
    return all.slice(0, 8);
  }
}
