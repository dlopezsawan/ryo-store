import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/store/product-categories?limit=100`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json({ categories: [] });
    const data = await res.json();
    const categories = (data.product_categories || []).map(
      (c: { id: string; name: string; handle: string }) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
      })
    );
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ categories: [] });
  }
}
