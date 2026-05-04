import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSession, getMessage, deleteMessage } from "../../mail-service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const uid = Number(req.params.uid);
  const folder = String(req.query.folder || "INBOX");

  if (!uid) return res.status(400).json({ error: "uid requerido" });

  try {
    const message = await getMessage(session, folder, uid);
    if (!message) return res.status(404).json({ error: "Mensaje no encontrado" });
    res.json({ message });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const uid = Number(req.params.uid);
  const folder = String(req.query.folder || "INBOX");

  if (!uid) return res.status(400).json({ error: "uid requerido" });

  try {
    await deleteMessage(session, folder, uid);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
