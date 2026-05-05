import { NextRequest, NextResponse } from "next/server";

const LISTMONK_URL = process.env.LISTMONK_URL || "http://listmonk:9000";
const LISTMONK_USER = process.env.LISTMONK_ADMIN_USER || "admin";
const LISTMONK_PASS = process.env.LISTMONK_ADMIN_PASSWORD || "RyoListmonk2024!";
const LISTMONK_LIST_ID = parseInt(process.env.LISTMONK_LIST_ID || "1", 10);

const basicAuth = Buffer.from(`${LISTMONK_USER}:${LISTMONK_PASS}`).toString("base64");

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const res = await fetch(`${LISTMONK_URL}/api/subscribers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        name: name || email.split("@")[0],
        status: "enabled",
        lists: [LISTMONK_LIST_ID],
        preconfirm_subscriptions: true,
      }),
    });

    // 409 = already subscribed — treat as success
    if (res.ok || res.status === 409) {
      return NextResponse.json({ ok: true });
    }

    const err = await res.text();
    console.error("Listmonk error:", err);
    return NextResponse.json({ error: "Error al suscribir" }, { status: 500 });
  } catch (e) {
    console.error("Newsletter API error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
