import { NextRequest, NextResponse } from "next/server";

const MEDUSA_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { cartId, code } = await req.json();
    if (!cartId || !code) {
      return NextResponse.json(
        { error: "cartId y code son requeridos" },
        { status: 400 }
      );
    }

    const res = await fetch(`${MEDUSA_URL}/store/carts/${cartId}/promotions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUB_KEY,
      },
      body: JSON.stringify({ promo_codes: [code] }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg =
        data?.message ||
        data?.error ||
        "Código de descuento inválido o expirado";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Compute discount figures for the coupon_applied PostHog event
    const cart = data.cart as Record<string, unknown> | undefined;
    const subtotal = typeof cart?.subtotal === "number" ? cart.subtotal : 0;
    const discountTotal = typeof cart?.discount_total === "number" ? cart.discount_total : 0;
    const discount_amount = discountTotal;
    const discount_pct =
      subtotal > 0 ? Math.round((discountTotal / subtotal) * 100 * 100) / 100 : 0;

    return NextResponse.json({ success: true, cart: data.cart, discount_amount, discount_pct });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al aplicar el descuento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { cartId, code } = await req.json();
    if (!cartId || !code) {
      return NextResponse.json(
        { error: "cartId y code son requeridos" },
        { status: 400 }
      );
    }

    const res = await fetch(`${MEDUSA_URL}/store/carts/${cartId}/promotions`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUB_KEY,
      },
      body: JSON.stringify({ promo_codes: [code] }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data?.message || data?.error || "Error al remover el descuento";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al remover el descuento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
