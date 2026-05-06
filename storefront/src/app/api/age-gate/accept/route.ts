import { NextResponse } from "next/server";

/**
 * POST /api/age-gate/accept
 *
 * Logs an age-gate acceptance for legal traceability. Compliance:
 *   - docs/compliance/02-WEB.md §3.2 (validez del clic-aceptación):
 *     Decreto-Ley sobre Mensajes de Datos exige registro técnico
 *     (timestamp + IP + UA + texto exacto del aviso) para que la
 *     aceptación tenga valor probatorio.
 *   - docs/compliance/02-WEB.md §6.2.1: cada aceptación debe loggearse.
 *
 * Today: appends to a JSON-lines file under public/uploads/age-gate-log/
 * which is mounted on the Docker volume `payment_proofs` (we reuse the
 * volume — no schema/infra change needed). Each line is a self-contained
 * JSON object so the file can be `tail -f`ed and grep'd; rotation is
 * not implemented here (file grows unbounded). When the volume of
 * acceptances justifies the cost, migrate to the finanzas audit-log
 * table or a dedicated `age_gate_log` table and add retention.
 *
 * The endpoint is best-effort — it never blocks the visitor's UX. If
 * the file write fails (FS pressure, ENOSPC, etc.), the cookie is
 * already set client-side and the visitor proceeds.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "public", "uploads", "age-gate-log");

function clientIp(req: Request): string {
  // Cloudflare → Traefik → Next: the original IP is in CF-Connecting-IP
  // first, then x-forwarded-for (which Traefik appends to). Fall back to
  // x-real-ip and finally to "unknown".
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = h.get("x-real-ip");
  if (xri) return xri;
  return "unknown";
}

export async function POST(req: Request) {
  let body: {
    disclaimer_version?: string;
    disclaimer_text?: string;
    accepted_at?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* tolerate empty body — we still log */
  }

  const entry = {
    accepted_at: body.accepted_at ?? new Date().toISOString(),
    disclaimer_version: body.disclaimer_version ?? "unknown",
    // Truncate to a sane upper bound; the actual disclaimer is ~250
    // chars but a malicious client could send megabytes.
    disclaimer_text: (body.disclaimer_text ?? "").slice(0, 1000),
    ip: clientIp(req),
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? "unknown",
    referer: req.headers.get("referer")?.slice(0, 500) ?? null,
  };

  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    // One file per day so rotation/archival is grep-friendly.
    const date = entry.accepted_at.slice(0, 10); // YYYY-MM-DD
    const file = path.join(LOG_DIR, `${date}.jsonl`);
    await fs.appendFile(file, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    // Don't surface FS errors to the client — visitor experience must
    // not depend on a write succeeding. Log server-side so an operator
    // notices if the disk fills up.
    console.error("[age-gate/accept] log write failed:", e);
  }

  return NextResponse.json({ ok: true });
}
