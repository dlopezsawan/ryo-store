import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (PUBLISHABLE_KEY) {
    headers["x-publishable-api-key"] = PUBLISHABLE_KEY;
  }
  return headers;
}

async function getRegionId(): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/store/regions?limit=20&fields=id,*countries`, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json() as { regions?: Array<{ id: string; countries?: Array<{ iso_2?: string }> }> };
    const regions = data.regions ?? [];
    const ve = regions.find((r) => r.countries?.some((c) => c.iso_2?.toLowerCase() === "ve"));
    return ve?.id ?? regions[0]?.id ?? null;
  } catch {
    return null;
  }
}

// Cross-sell rules: what goes well together
const CROSS_SELL: Record<string, string[]> = {
  "rolling-paper": ["filtros", "grinder", "conos"],
  filtros: ["rolling-paper", "conos", "grinder"],
  conos: ["filtros", "grinder", "rolling-paper"],
  grinders: ["rolling-paper", "filtros", "conos"],
  pipas: ["grinder", "filtros", "rolling-paper"],
  bongs: ["grinder", "filtros", "rolling-paper"],
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeIds = (searchParams.get("exclude_ids") || "").split(",").filter(Boolean);
    const cartCategories = (searchParams.get("categories") || "").split(",").filter(Boolean);

    const regionId = await getRegionId();

    // Fetch all products
    const params = new URLSearchParams({ limit: "100" });
    if (regionId) { params.set("region_id", regionId); params.set("fields", "*variants.calculated_price"); }

    const res = await fetch(`${BACKEND_URL}/store/products?${params}`, {
      headers: getHeaders(),
      next: { revalidate: 60 },
    });

    if (!res.ok) return NextResponse.json({ products: [] });

    // Also fetch categories to map products
    const catRes = await fetch(`${BACKEND_URL}/store/product-categories?limit=100`, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });
    const catData = catRes.ok ? await catRes.json() as { product_categories?: Array<{ id: string; handle: string }> } : { product_categories: [] };
    const categories = catData.product_categories || [];

    // Build product→category map by fetching per-category
    const productCatMap: Record<string, string> = {};
    await Promise.all(categories.map(async (cat) => {
      try {
        const cParams = new URLSearchParams({ category_id: cat.id, limit: "100" });
        if (regionId) cParams.set("region_id", regionId);
        const cRes = await fetch(`${BACKEND_URL}/store/products?${cParams}`, { headers: getHeaders(), next: { revalidate: 300 } });
        if (!cRes.ok) return;
        const cData = await cRes.json() as { products?: Array<{ id: string }> };
        for (const p of cData.products || []) productCatMap[p.id] = cat.handle;
      } catch {}
    }));

    const data = await res.json() as {
      products: Array<{
        id: string; title: string; handle: string; thumbnail?: string;
        images?: { id: string; url: string }[];
        variants?: Array<{ id: string; calculated_price?: { calculated_amount: number | null; original_amount?: number | null } }>;
      }>;
    };

    const allProducts = (data.products || [])
      .filter((p) => !excludeIds.includes(p.id) && p.variants?.[0]?.id)
      .map((p) => {
        const cp = p.variants?.[0]?.calculated_price;
        const price = cp?.calculated_amount ?? cp?.original_amount ?? 0;
        const category = productCatMap[p.id] || "";
        return { id: p.id, title: p.title, handle: p.handle, variantId: p.variants![0].id, image: p.thumbnail || p.images?.[0]?.url || null, price, category };
      });

    // Determine which categories to suggest based on what's in cart
    const suggestedCats = new Set<string>();
    for (const cartCat of cartCategories) {
      const related = CROSS_SELL[cartCat] || [];
      for (const r of related) suggestedCats.add(r);
    }

    // Score products: cross-sell matches first, then others
    const scored = allProducts.map((p) => ({
      ...p,
      score: suggestedCats.has(p.category) ? 10 : 1,
    }));
    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({ products: scored.slice(0, 6) });
  } catch {
    return NextResponse.json({ products: [] });
  }
}
