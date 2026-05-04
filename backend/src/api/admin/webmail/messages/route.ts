import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSession, listMessages, sendMessage, MailAttachment } from "../mail-service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const folder = String(req.query.folder || "INBOX");
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 25;

  try {
    const result = await listMessages(session, folder, page, limit);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.headers["x-webmail-token"] || "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const { to, subject, html, cc, bcc, inReplyTo, attachments } = req.body as {
    to?: string; subject?: string; html?: string;
    cc?: string; bcc?: string; inReplyTo?: string;
    attachments?: MailAttachment[];
  };

  if (!to || !subject) {
    return res.status(400).json({ error: "to, subject requeridos" });
  }

  try {
    await sendMessage(session, to, subject, html || "", { cc, bcc, inReplyTo, attachments });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
