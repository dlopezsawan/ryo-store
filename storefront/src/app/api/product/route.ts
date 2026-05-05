import { NextResponse, type NextRequest } from "next/server";
import { getProductByHandleWithVariant } from "@/lib/medusa";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { error: "slug parameter is required" },
      { status: 400 }
    );
  }

  try {
    const result = await getProductByHandleWithVariant(slug);

    if (!result) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      product: result.product,
      variantId: result.variantId,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
