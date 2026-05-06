import { NextRequest, NextResponse } from "next/server";
import { medusaGetOrders } from "@/lib/medusaAuth";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ orders: [] });
  const orders = await medusaGetOrders(token);
  return NextResponse.json({ orders });
}
