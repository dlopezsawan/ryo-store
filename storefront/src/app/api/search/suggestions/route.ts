import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

const headers = () => ({
  "Content-Type": "application/json",
  ...(PUBLISHABLE_KEY && {
    "x-publishable-api-key": PUBLISHABLE_KEY,
  }),
});

/** Tags usados internamente (combo, featured) - no aparecen como sugerencias */
const EXCLUDED_TAGS = new Set(["combo", "featured"]);

export async function GET(request: NextRequest) {
  // Guard: without a publishable key the backend will reject every request;
  // return empty suggestions silently rather than letting all requests fail.
  if (!PUBLISHABLE_KEY) {
    console.warn(
      "[search/suggestions] NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is not set — returning empty suggestions."
    );
    return NextResponse.json({ products: [], keywords: [] });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) {
    return NextResponse.json({ products: [], keywords: [] });
  }

  try {
    const [productsRes, tagsRes] = await Promise.all([
      fetch(
        `${BACKEND}/store/products?q=${encodeURIComponent(q)}&limit=5`,
        { headers: headers() }
      ),
      fetch(`${BACKEND}/store/product-tags?limit=100`, { headers: headers() }),
    ]);

    const products: { id: string; title: string; handle: string }[] = [];
    if (productsRes.ok) {
      const data = (await productsRes.json()) as {
        products?: { id: string; title: string; handle: string }[];
      };
      products.push(...(data.products ?? []));
    }

    const keywords: string[] = [];
    if (tagsRes.ok) {
      const data = (await tagsRes.json()) as {
        product_tags?: { value: string }[];
      };
      const tagValues =
        (data.product_tags ?? [])
          .map((t) => (t.value ?? "").trim())
          .filter(
            (v) =>
              v.length > 0 &&
              !EXCLUDED_TAGS.has(v.toLowerCase()) &&
              v.toLowerCase().includes(q)
          ) || [];
      // Evitar duplicados y ordenar por relevancia (los que empiezan con q primero)
      const seen = new Set<string>();
      const sorted = tagValues
        .filter((v) => {
          const lower = v.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        })
        .sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(q) ? 1 : 0;
          const bStarts = b.toLowerCase().startsWith(q) ? 1 : 0;
          return bStarts - aStarts;
        })
        .slice(0, 8);
      keywords.push(...sorted);
    }

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        slug: p.handle,
      })),
      keywords,
    });
  } catch (e) {
    return NextResponse.json(
      { products: [], keywords: [], error: String(e) },
      { status: 500 }
    );
  }
}
