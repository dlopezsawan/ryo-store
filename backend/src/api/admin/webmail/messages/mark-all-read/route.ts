import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSession, markAllRead } from "../../mail-service";

// POST /admin/webmail/messages/mark-all-read
// Body: { folder }
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const { folder } = req.body as { folder?: string };
  if (!folder) return res.status(400).json({ error: "folder requerido" });

  try {
    await markAllRead(session, folder);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
