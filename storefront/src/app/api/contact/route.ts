import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "hola@enrola.shop";
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;

async function verifyRecaptcha(token: string): Promise<{ ok: boolean; reason?: string }> {
  // En desarrollo (localhost) saltamos la verificación
  if (process.env.NODE_ENV === "development") return { ok: true };
  if (!RECAPTCHA_SECRET) return { ok: false, reason: "RECAPTCHA_SECRET_KEY no configurada" };

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
  });
  const data = (await res.json()) as { success: boolean; score?: number; "error-codes"?: string[] };
  console.log("reCAPTCHA response:", JSON.stringify(data));

  if (!data.success) return { ok: false, reason: data["error-codes"]?.join(", ") ?? "token inválido" };
  if ((data.score ?? 1) < 0.5) return { ok: false, reason: `score bajo (${data.score})` };
  return { ok: true };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name: string;
      contact: string;
      message: string;
      recaptchaToken: string;
      _hp?: string;       // honeypot
      _ft?: number;       // form load timestamp
    };

    const { name, contact, message, recaptchaToken } = body;

    // Honeypot: bots fill hidden fields
    if (body._hp) {
      return NextResponse.json({ success: true }); // silent drop
    }

    // Time check: reject if form was submitted in < 3 seconds
    if (body._ft && Date.now() - body._ft < 3000) {
      return NextResponse.json({ success: true }); // silent drop
    }

    if (!name?.trim() || !contact?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Nombre, contacto y mensaje son obligatorios" },
        { status: 400 }
      );
    }

    if (!recaptchaToken) {
      return NextResponse.json(
        { error: "Verificación reCAPTCHA requerida" },
        { status: 400 }
      );
    }

    const captcha = await verifyRecaptcha(recaptchaToken);
    if (!captcha.ok) {
      return NextResponse.json(
        { error: `Verificación reCAPTCHA fallida${captcha.reason ? `: ${captcha.reason}` : ""}. Intenta de nuevo.` },
        { status: 400 }
      );
    }

    await sendMail({
      to: CONTACT_EMAIL,
      replyTo: contact.includes("@") ? contact : undefined,
      subject: `[Enrola Shop] Mensaje de ${name.trim()}`,
      html: `
        <h2>Nuevo mensaje desde la web</h2>
        <p><strong>Nombre:</strong> ${name.trim()}</p>
        <p><strong>Contacto (email/IG):</strong> ${contact.trim()}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${message.trim().replace(/\n/g, "<br>")}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact API error:", err);
    return NextResponse.json(
      { error: "Error interno. Intenta más tarde." },
      { status: 500 }
    );
  }
}
