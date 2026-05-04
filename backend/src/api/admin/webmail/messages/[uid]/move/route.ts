import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSession, moveMessage } from "../../../mail-service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const uid = Number(req.params.uid);
  const { folder, destination } = req.body as {
    folder?: string;
    destination?: string;
  };

  if (!folder || !destination || !uid) {
    return res.status(400).json({ error: "folder, destination, uid requeridos" });
  }

  try {
    await moveMessage(session, folder, uid, destination);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
