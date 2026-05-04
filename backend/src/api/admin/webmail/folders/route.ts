import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSession, listFolders } from "../mail-service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  try {
    const folders = await listFolders(session);
    res.json({ folders });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
