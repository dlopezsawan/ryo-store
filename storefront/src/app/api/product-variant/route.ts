import { NextRequest, NextResponse } from "next/server";
import { getProductByHandleWithVariant } from "@/lib/medusa";

// In-memory cache for variant lookups (survives across requests in same worker)
const variantCache = new Map<string, { variantId: string; ts: number }>();
const CACHE_TTL = 60_000; // 60 seconds
const CACHE_MAX = 500;    // cap to prevent unbounded growth in long-lived workers

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || req.nextUrl.searchParams.get("handle");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  // Check cache first
  const cached = variantCache.get(slug);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ variantId: cached.variantId });
  }

  const result = await getProductByHandleWithVariant(slug);
  if (!result) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Cache the result — evict oldest entry if cap reached
  if (variantCache.size >= CACHE_MAX) {
    const oldestKey = variantCache.keys().next().value;
    if (oldestKey !== undefined) variantCache.delete(oldestKey);
  }
  variantCache.set(slug, { variantId: result.variantId, ts: Date.now() });

  return NextResponse.json({ variantId: result.variantId });
}
