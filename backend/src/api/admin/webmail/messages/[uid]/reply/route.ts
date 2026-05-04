import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSession, sendMessage } from "../../../mail-service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const { to, subject, html, inReplyTo } = req.body as {
    to?: string;
    subject?: string;
    html?: string;
    inReplyTo?: string;
  };

  if (!to || !subject) {
    return res.status(400).json({ error: "to, subject requeridos" });
  }

  try {
    await sendMessage(session, to, subject, html || "", { inReplyTo });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
