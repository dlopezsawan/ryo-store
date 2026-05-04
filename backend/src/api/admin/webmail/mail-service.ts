import { ImapFlow } from "imapflow";
import * as nodemailer from "nodemailer";
import { simpleParser, ParsedMail } from "mailparser";
import * as crypto from "crypto";

export interface MailFolder {
  path: string;
  name: string;
  unseen: number;
  total: number;
}

export interface MailMessageSummary {
  uid: number;
  seq: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  size: number;
  preview: string;
}

export interface MailMessageDetail {
  uid: number;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  html: string;
  text: string;
  seen: boolean;
  attachments: { filename: string; size: number; contentType: string }[];
}

interface Session {
  email: string;
  password: string;
  createdAt: number;
}

const IMAP_HOST = process.env.MAIL_IMAP_HOST || "mailserver";
const IMAP_PORT = Number(process.env.MAIL_IMAP_PORT) || 143;
const SMTP_HOST = process.env.MAIL_SMTP_HOST || "mailserver";
const SMTP_PORT = Number(process.env.MAIL_SMTP_PORT) || 587;

const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours
const sessions = new Map<string, Session>();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) sessions.delete(token);
  }
}

export async function login(email: string, password: string): Promise<string> {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: false,
    auth: { user: email, pass: password },
    logger: false,
  });
  await client.connect();
  await client.logout();

  cleanExpiredSessions();
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { email, password, createdAt: Date.now() });
  return token;
}

export function logout(token: string): void {
  sessions.delete(token);
}

export function getSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  return session;
}

async function withImap<T>(
  session: Session,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: false,
    auth: { user: session.email, pass: session.password },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout();
  }
}

export async function listFolders(session: Session): Promise<MailFolder[]> {
  return withImap(session, async (client) => {
    const mailboxes = await client.list();
    const folders: MailFolder[] = [];
    for (const mb of mailboxes) {
      try {
        const status = await client.status(mb.path, { messages: true, unseen: true });
        folders.push({
          path: mb.path,
          name: mb.name,
          unseen: status.unseen ?? 0,
          total: status.messages ?? 0,
        });
      } catch {
        folders.push({ path: mb.path, name: mb.name, unseen: 0, total: 0 });
      }
    }
    return folders;
  });
}

function addressToString(addr: any): string {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  if (Array.isArray(addr)) {
    return addr.map((a) => a.address || a.name || String(a)).join(", ");
  }
  if (addr.value && Array.isArray(addr.value)) {
    return addr.value.map((a: any) => a.address || a.name || "").join(", ");
  }
  return addr.address || addr.name || String(addr);
}

export async function listMessages(
  session: Session,
  folder: string,
  page: number,
  limit: number
): Promise<{ messages: MailMessageSummary[]; total: number }> {
  return withImap(session, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const total = (client.mailbox as any)?.exists ?? 0;
      if (total === 0) return { messages: [], total: 0 };

      const end = Math.max(total - (page - 1) * limit, 0);
      const start = Math.max(end - limit + 1, 1);
      if (end <= 0) return { messages: [], total };

      const range = `${start}:${end}`;
      const messages: MailMessageSummary[] = [];

      const fetched = await client.fetchAll(range, {
        envelope: true,
        flags: true,
        bodyStructure: true,
      });

      for (const msg of fetched) {
        const env = msg.envelope;
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          from: env?.from?.[0]?.address || env?.from?.[0]?.name || "",
          to: env?.to?.[0]?.address || env?.to?.[0]?.name || "",
          subject: env?.subject || "(sin asunto)",
          date: env?.date?.toISOString() || "",
          seen: msg.flags?.has("\\Seen") ?? false,
          flagged: msg.flags?.has("\\Flagged") ?? false,
          size: (msg as any).size ?? 0,
          preview: "",
        });
      }

      messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { messages, total };
    } finally {
      lock.release();
    }
  });
}

export async function getMessage(
  session: Session,
  folder: string,
  uid: number
): Promise<MailMessageDetail | null> {
  return withImap(session, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const raw = await client.fetchOne(String(uid), { source: true, flags: true, uid: true }, { uid: true }) as any;
      if (!raw) return null;
      if (!raw.source) return null;

      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });

      const parsed: ParsedMail = await simpleParser(raw.source);
      return {
        uid,
        from: addressToString(parsed.from),
        to: addressToString(parsed.to),
        cc: addressToString(parsed.cc),
        subject: parsed.subject || "(sin asunto)",
        date: parsed.date?.toISOString() || "",
        html: parsed.html || "",
        text: parsed.text || "",
        seen: raw.flags?.has?.("\\Seen") ?? true,
        attachments: (parsed.attachments || []).map((a) => ({
          filename: a.filename || "adjunto",
          size: a.size,
          contentType: a.contentType,
        })),
      };
    } finally {
      lock.release();
    }
  });
}

export interface MailAttachment {
  name: string;
  data: string;   // base64
  type: string;
  size: number;
}

export async function sendMessage(
  session: Session,
  to: string,
  subject: string,
  html: string,
  options?: { cc?: string; bcc?: string; inReplyTo?: string; attachments?: MailAttachment[] }
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: session.email, pass: session.password },
    tls: { rejectUnauthorized: false },
  });

  const nodemailerAttachments = (options?.attachments ?? []).map((a) => ({
    filename: a.name,
    content: Buffer.from(a.data, "base64"),
    contentType: a.type,
  }));

  await transport.sendMail({
    from: session.email,
    to,
    ...(options?.cc ? { cc: options.cc } : {}),
    ...(options?.bcc ? { bcc: options.bcc } : {}),
    subject,
    html,
    ...(options?.inReplyTo ? { inReplyTo: options.inReplyTo, references: options.inReplyTo } : {}),
    ...(nodemailerAttachments.length > 0 ? { attachments: nodemailerAttachments } : {}),
  });
}

export async function setMessageFlags(
  session: Session,
  folder: string,
  uid: number,
  flags: { seen?: boolean; flagged?: boolean }
): Promise<void> {
  return withImap(session, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      if (flags.seen !== undefined) {
        if (flags.seen) {
          await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        } else {
          await client.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
        }
      }
      if (flags.flagged !== undefined) {
        if (flags.flagged) {
          await client.messageFlagsAdd(String(uid), ["\\Flagged"], { uid: true });
        } else {
          await client.messageFlagsRemove(String(uid), ["\\Flagged"], { uid: true });
        }
      }
    } finally {
      lock.release();
    }
  });
}

export async function markAllRead(
  session: Session,
  folder: string
): Promise<void> {
  return withImap(session, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const total = (client.mailbox as any)?.exists ?? 0;
      if (total === 0) return;
      await client.messageFlagsAdd("1:*", ["\\Seen"]);
    } finally {
      lock.release();
    }
  });
}

export async function deleteMessage(
  session: Session,
  folder: string,
  uid: number
): Promise<void> {
  return withImap(session, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageMove(String(uid), "Trash", { uid: true });
    } catch {
      await client.messageFlagsAdd(String(uid), ["\\Deleted"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function moveMessage(
  session: Session,
  folder: string,
  uid: number,
  destination: string
): Promise<void> {
  return withImap(session, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageMove(String(uid), destination, { uid: true });
    } finally {
      lock.release();
    }
  });
}
