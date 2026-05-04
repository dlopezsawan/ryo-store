import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { login, logout, getSession } from "../mail-service";
import { getAccountPassword } from "../accounts/route";

/**
 * POST /admin/webmail/auth
 *
 * Dos modos:
 *   1. Manual:  body = { email, password }  → login con creds del cliente
 *   2. Auto:    body = { email }            → server lee password de env
 *                                              WEBMAIL_PASS_<EMAIL_SANITIZED>
 *                                              y hace login transparente
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email) {
    return res.status(400).json({ error: "Email requerido" });
  }

  let pass = password;
  if (!pass) {
    const stored = getAccountPassword(email);
    if (!stored) {
      return res.status(404).json({
        error: "Auto-login no configurado para este buzón",
        hint: `Definí WEBMAIL_PASS_${email.toUpperCase().replace(/[^A-Z0-9]+/g, "_")} en env`,
      });
    }
    pass = stored;
  }

  try {
    const token = await login(email, pass);
    res.json({ token, email });
  } catch (e: any) {
    res.status(401).json({ error: "Credenciales inválidas" });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  logout(token);
  res.json({ success: true });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });
  res.json({ email: session.email });
}
