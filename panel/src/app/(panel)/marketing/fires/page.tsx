import Link from "next/link"
import { AlertCircle, Mail, MessageCircle, ExternalLink } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { listRemarketingFires, MedusaError, type RemarketingFire } from "@/lib/medusa"
import { fmtRelative } from "@/lib/utils"

interface SearchParams {
  rule_key?: string
  status?: string
  hours?: string
}

const STATUS_META: Record<string, { label: string; cls: string; bg: string }> = {
  pending:              { label: "Pendiente",       cls: "text-orange",    bg: "bg-orange/10" },
  sent:                 { label: "Enviado",         cls: "text-secondary", bg: "bg-secondary/10" },
  failed:               { label: "Falló",           cls: "text-primary",   bg: "bg-primary/10" },
  skipped_cooldown:     { label: "Cooldown",        cls: "text-ink-3",     bg: "bg-cream-2" },
  skipped_quiet_hours:  { label: "Quiet hours",     cls: "text-ink-3",     bg: "bg-cream-2" },
  skipped_cap:          { label: "Cap diario",      cls: "text-ink-3",     bg: "bg-cream-2" },
  skipped_no_channel:   { label: "Sin canal",       cls: "text-ink-3",     bg: "bg-cream-2" },
  dry_run:              { label: "DRY RUN",         cls: "text-orange",    bg: "bg-orange/5" },
  converted:            { label: "Convertido ✓",    cls: "text-secondary", bg: "bg-secondary/15" },
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail size={11} strokeWidth={2.5} />,
  whatsapp: <MessageCircle size={11} strokeWidth={2.5} />,
}

export default async function FiresPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const sinceHours = Number(params.hours ?? 168) || 168

  let fires: RemarketingFire[] = []
  let errorMsg: string | null = null
  try {
    const r = await listRemarketingFires({
      rule_key: params.rule_key,
      status: params.status as RemarketingFire["status"] | undefined,
      since_hours: sinceHours,
      limit: 200,
    })
    fires = r.fires
  } catch (e) {
    errorMsg = e instanceof MedusaError
      ? `Backend ${e.status}: ${e.message}`
      : (e instanceof Error ? e.message : "error")
  }

  // Counts por status
  const counts = new Map<string, number>()
  for (const f of fires) counts.set(f.status, (counts.get(f.status) ?? 0) + 1)

  // Top rule_keys
  const ruleKeys = new Map<string, number>()
  for (const f of fires) ruleKeys.set(f.rule_key, (ruleKeys.get(f.rule_key) ?? 0) + 1)

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="→" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Envíos" }]} />

      <PageHeader
        title="ENVÍOS"
        stamp={<>{fires.length} EN {sinceHours}H</>}
        stampTone="orange"
        description={`Log completo de remarketing fires · todos los matches del engine, incluyendo skips`}
      />

      <MarketingNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-primary" strokeWidth={2.5} />
            <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="stamp-card p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mr-2">Filtros:</span>
          <FilterChip label={`Todos (${fires.length})`} active={!params.status} href={buildHref(params, { status: undefined })} />
          {Object.entries(STATUS_META).map(([s, m]) => {
            const n = counts.get(s) ?? 0
            if (n === 0 && params.status !== s) return null
            return <FilterChip key={s} label={`${m.label} (${n})`} active={params.status === s} href={buildHref(params, { status: s })} />
          })}
          <span className="flex-1" />
          <select defaultValue={params.hours ?? "168"} className="px-2 py-1 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
            style={{ border: "1.5px solid var(--border)" }}>
            <option value="24">24h</option>
            <option value="72">3 días</option>
            <option value="168">7 días</option>
            <option value="720">30 días</option>
          </select>
        </div>
        {params.rule_key && (
          <div className="mt-2 text-[10px] font-mono text-ink-3">
            Filtrando por rule: <code className="text-orange">{params.rule_key}</code>
            <Link href={buildHref(params, { rule_key: undefined })} className="ml-2 text-primary hover:underline">× quitar</Link>
          </div>
        )}
      </div>

      {/* List */}
      {fires.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <Mail size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin envíos en este filtro</p>
          <p className="text-[12px] text-ink-3 mt-1">Si todo está vacío, el cron puede no estar corriendo o no hay candidatos en la ventana</p>
        </div>
      ) : (
        <div className="stamp-card overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-dark text-cream text-[10px] uppercase tracking-[0.12em]">
                <th className="px-3 py-2 text-left font-display font-bold">Fecha</th>
                <th className="px-3 py-2 text-left font-display font-bold">Status</th>
                <th className="px-3 py-2 text-left font-display font-bold">Regla</th>
                <th className="px-3 py-2 text-left font-display font-bold">Destino</th>
                <th className="px-3 py-2 text-left font-display font-bold">Signal</th>
                <th className="px-3 py-2 text-left font-display font-bold">Canal</th>
                <th className="px-3 py-2 text-left font-display font-bold">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {fires.map((f) => {
                const sm = STATUS_META[f.status] ?? { label: f.status, cls: "text-ink-3", bg: "bg-cream-2" }
                return (
                  <tr key={f.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-[10px] text-ink-3 num">
                      {new Date(f.fired_at).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      <div className="text-[9px] opacity-60">{fmtRelative(f.fired_at)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider rounded-md ${sm.bg} ${sm.cls}`}>
                        {sm.label}
                      </span>
                      {f.error_message && (
                        <div className="text-[9px] text-primary font-mono mt-0.5 truncate max-w-[200px]">{f.error_message}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={buildHref(params, { rule_key: f.rule_key })} className="font-display font-bold text-ink hover:text-orange">
                        {f.rule_key}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {f.email && <div className="text-[11px] font-mono text-ink-2 truncate max-w-[180px]">{f.email}</div>}
                      {f.phone && <div className="text-[10px] font-mono text-ink-3">{f.phone}</div>}
                      {f.customer_id && (
                        <Link href={`/marketing/user360?email=${encodeURIComponent(f.email ?? "")}`}
                          className="text-[9px] text-orange hover:underline flex items-center gap-0.5">
                          User 360 <ExternalLink size={9} />
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] font-mono text-ink-3">
                      <div className="truncate max-w-[160px]">{f.signal_id}</div>
                      <div className="text-[9px] opacity-60 uppercase">{f.signal_severity}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-[10px] font-mono text-ink-3">
                        {CHANNEL_ICON[f.channel]} {f.channel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-ink-2 truncate max-w-[280px]">
                      {f.subject && <div className="font-display font-bold truncate">{f.subject}</div>}
                      {f.body && <div className="text-ink-3 truncate font-mono">{f.body}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function buildHref(current: SearchParams, override: Partial<SearchParams>): string {
  const sp = new URLSearchParams()
  const merged = { ...current, ...override }
  if (merged.rule_key) sp.set("rule_key", merged.rule_key)
  if (merged.status) sp.set("status", merged.status)
  if (merged.hours) sp.set("hours", merged.hours)
  const s = sp.toString()
  return s ? `/marketing/fires?${s}` : "/marketing/fires"
}

function FilterChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link href={href}
      className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded-md whitespace-nowrap ${
        active ? "bg-dark text-cream" : "text-ink-3 hover:bg-cream-2"
      }`}
      style={!active ? { border: "1.5px solid var(--border)" } : undefined}>
      {label}
    </Link>
  )
}
