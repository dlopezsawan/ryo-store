import { NextRequest, NextResponse } from "next/server";
import { medusaRegister } from "@/lib/medusaAuth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, firstName, lastName, phone } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }
    await medusaRegister(email, password, firstName || "", lastName || "", phone || undefined);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al registrarse";
    const status = msg.toLowerCase().includes("exist") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
