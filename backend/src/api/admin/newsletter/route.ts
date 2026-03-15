import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

const LISTMONK_URL = process.env.LISTMONK_URL || "http://listmonk:9000";
const LISTMONK_USER = process.env.LISTMONK_ADMIN_USER || "admin";
const LISTMONK_PASS = process.env.LISTMONK_ADMIN_PASSWORD || "RyoListmonk2024!";
const basicAuth = Buffer.from(`${LISTMONK_USER}:${LISTMONK_PASS}`).toString("base64");

async function lk(path: string) {
  const res = await fetch(`${LISTMONK_URL}/api/${path}`, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) throw new Error(`Listmonk ${path}: ${res.status}`);
  return res.json();
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const [subsData, listsData, campaignsData] = await Promise.all([
      lk("subscribers?page=1&per_page=10&order_by=created_at&order=DESC"),
      lk("lists?page=1&per_page=50"),
      lk("campaigns?page=1&per_page=5&order_by=created_at&order=DESC"),
    ]);

    const stats = {
      total_subscribers: subsData.data?.total ?? 0,
      enabled_subscribers: subsData.data?.results?.filter((s: { status: string }) => s.status === "enabled").length ?? 0,
      total_lists: listsData.data?.total ?? 0,
      total_campaigns: campaignsData.data?.total ?? 0,
      recent_subscribers: (subsData.data?.results ?? []).slice(0, 10).map((s: {
        id: number; email: string; name: string; status: string; created_at: string
      }) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        status: s.status,
        created_at: s.created_at,
      })),
      lists: (listsData.data?.results ?? []).map((l: {
        id: number; name: string; type: string; subscriber_count: number
      }) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        subscriber_count: l.subscriber_count,
      })),
      recent_campaigns: (campaignsData.data?.results ?? []).slice(0, 5).map((c: {
        id: number; name: string; status: string; subject: string; created_at: string; send_at: string
      }) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        subject: c.subject,
        created_at: c.created_at,
        send_at: c.send_at,
      })),
      listmonk_url: "https://newsletter.enrola.shop",
    };

    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
