import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000";

export async function POST(request: Request) {
  try {
    const { token, password } = (await request.json()) as {
      token?: string;
      password?: string;
    };

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token y contrasena son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${BACKEND_URL}/auth/customer/emailpass/update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      let message = "Error al actualizar la contrasena";
      try {
        const data = JSON.parse(text);
        message = data.message || data.error || message;
      } catch {
        // use default message
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ message: "Password updated" });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
