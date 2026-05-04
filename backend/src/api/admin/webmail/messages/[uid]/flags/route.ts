import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSession, setMessageFlags } from "../../../mail-service";

// PATCH /admin/webmail/messages/:uid/flags
// Body: { folder, seen?, flagged? }
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const uid = Number((req.params as any).uid);
  const { folder, seen, flagged } = req.body as {
    folder?: string;
    seen?: boolean;
    flagged?: boolean;
  };

  if (!folder) return res.status(400).json({ error: "folder requerido" });

  try {
    await setMessageFlags(session, folder, uid, { seen, flagged });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
