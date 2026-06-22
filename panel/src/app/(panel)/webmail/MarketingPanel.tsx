"use client"

import { AtSign, BarChart3 } from "lucide-react"
import type { ResendAudience, ResendEmail } from "@/lib/resend"
import { fmtRelative } from "@/lib/utils"
import { BroadcastComposer } from "./audiences/BroadcastComposer"

/**
 * Marketing tab: integra audiences + broadcasts + KPIs de envíos.
 * Reusa BroadcastComposer ya existente (modal con preview + send).
 */
export function MarketingPanel({
  configured,
  audiences,
  contactCounts = {},
  emails,
  listError,
  defaultFrom,
}: {
  configured: boolean
  audiences: ResendAudience[]
  contactCounts?: Record<string, number | null>
  emails: ResendEmail[]
  listError: string | null
  defaultFrom: string
}) {
  if (!configured) {
    return (
      <div className="stamp-card p-5 bg-orange/5" style={{ borderColor: "#FF3B27" }}>
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider mb-2">
          Resend no configurado
        </h3>
        <p className="text-[12px] text-ink-2 leading-relaxed">
          Email marketing requiere <code className="font-mono">RESEND_API_KEY</code> en el env del panel.
        </p>
      </div>
    )
  }

  // KPIs agregados sobre los últimos 50 emails
  const total = emails.length
  const delivered = emails.filter((e) => e.last_event === "delivered" || e.last_event === "opened" || e.last_event === "clicked").length
  const opened = emails.filter((e) => e.last_event === "opened" || e.last_event === "clicked").length
  const clicked = emails.filter((e) => e.last_event === "clicked").length
  const bounced = emails.filter((e) => e.last_event === "bounced" || e.last_event === "complained").length

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <Kpi label="Enviados (50)"  value={total.toString()} sub="últimos 50" />
        <Kpi label="Entregados"     value={delivered.toString()} sub={total > 0 ? `${((delivered / total) * 100).toFixed(0)}%` : "—"} tone="secondary" />
        <Kpi label="Abiertos"       value={opened.toString()}    sub={delivered > 0 ? `${((opened / delivered) * 100).toFixed(0)}% open rate` : "—"} tone="secondary" />
        <Kpi label="Clicks"         value={clicked.toString()}   sub={opened > 0 ? `${((clicked / opened) * 100).toFixed(0)}% CTR` : "—"} tone="orange" />
        <Kpi label="Bounces"        value={bounced.toString()}   sub={total > 0 ? `${((bounced / total) * 100).toFixed(0)}%` : "—"} tone={bounced > 0 ? "primary" : undefined} />
      </div>

      {/* Audiences + broadcast */}
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
          <div className="flex items-center gap-2">
            <AtSign size={14} strokeWidth={2.4} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              Audiences ({audiences.length})
            </h3>
          </div>
          {audiences.length > 0 && (
            <BroadcastComposer
              audiences={audiences.map((a) => ({ id: a.id, name: a.name, contactCount: contactCounts[a.id] ?? null }))}
              defaultFrom={defaultFrom}
            />
          )}
        </div>
        {listError && (
          <div className="p-4 text-[12px] text-primary">{listError}</div>
        )}
        {audiences.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-display font-bold text-[13px] uppercase tracking-wider text-ink-3">
              Sin audiences en Resend
            </p>
            <p className="text-[11px] text-ink-3 mt-1">
              Crea una desde{" "}
              <a href="https://resend.com/audiences" target="_blank" rel="noopener noreferrer" className="text-orange hover:underline">
                resend.com/audiences
              </a>
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-warm-200/50">
            {audiences.map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-center gap-3 row-hover">
                <div className="w-9 h-9 bg-orange text-dark flex items-center justify-center" style={{ border: "1.5px solid var(--border)" }}>
                  <AtSign size={14} strokeWidth={2.4} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13px] truncate">{a.name}</div>
                  <div className="text-[10px] font-mono text-ink-3">
                    desde {fmtRelative(a.created_at)} · {contactCounts[a.id] != null ? `${contactCounts[a.id]} contacto${contactCounts[a.id] === 1 ? "" : "s"}` : <span title="No se pudo obtener el conteo de Resend">— contactos</span>}
                  </div>
                </div>
                <a href="/webmail/audiences" className="text-[10px] font-display font-bold uppercase tracking-wider text-orange hover:underline">
                  Ver contactos →
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Eventos recientes (tabla) */}
      <div className="stamp-card overflow-hidden">
        <div className="px-5 py-3 bg-dark text-cream flex items-center gap-2">
          <BarChart3 size={14} strokeWidth={2.4} />
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Últimos envíos · {emails.length}</h3>
        </div>
        {emails.length === 0 ? (
          <div className="p-10 text-center text-[12px] text-ink-3 font-mono italic">Sin envíos recientes.</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Evento</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Asunto</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Para</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {emails.slice(0, 50).map((e) => (
                <tr key={e.id} className="row-zebra border-b border-warm-200/50 last:border-b-0">
                  <td className="px-3 py-2"><EventPill event={e.last_event ?? "sent"} /></td>
                  <td className="px-3 py-2 truncate max-w-[300px] font-display font-bold">{e.subject}</td>
                  <td className="px-3 py-2 font-mono text-ink-3 truncate max-w-[200px]">
                    {Array.isArray(e.to) ? e.to.join(", ") : e.to}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-3 whitespace-nowrap">
                    {fmtRelative(e.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}

function EventPill({ event }: { event: string }) {
  const META: Record<string, { label: string; cls: string }> = {
    sent:       { label: "Enviado",   cls: "text-ink-3 bg-cream-2" },
    delivered:  { label: "Entregado", cls: "text-secondary bg-secondary/10" },
    opened:     { label: "Abierto",   cls: "text-secondary bg-secondary/10" },
    clicked:    { label: "Click",     cls: "text-orange bg-orange/10" },
    bounced:    { label: "Bounced",   cls: "text-primary bg-primary/10" },
    complained: { label: "Complaint", cls: "text-primary bg-primary/10" },
  }
  const m = META[event] ?? { label: event, cls: "text-ink-3 bg-cream-2" }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-display font-bold uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "primary" | "orange" | "secondary" }) {
  const bgClass = tone === "primary" ? "bg-primary/5" : tone === "orange" ? "bg-orange/5" : tone === "secondary" ? "bg-secondary/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : ""
  return (
    <div className={`stamp-card p-3 ${bgClass}`}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`stat-display text-[24px] mt-1 num ${valueTone}`}>{value}</div>
      <div className="text-[9px] text-ink-3 font-mono mt-1">{sub}</div>
    </div>
  )
}
