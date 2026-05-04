import { Send, Mail, MessageCircle, Phone, Pause, Activity, FlaskConical } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { listRemarketingRules, MedusaError, type RemarketingRule } from "@/lib/medusa"

const CHANNEL_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }> = {
  email:    { label: "EMAIL",    color: "#FF3B27", icon: Mail },
  whatsapp: { label: "WHATSAPP", color: "#25D366", icon: MessageCircle },
  telegram: { label: "TELEGRAM", color: "#0088cc", icon: Send },
  sms:      { label: "SMS",      color: "#9C9285", icon: Phone },
}

export default async function CampaignsPage() {
  const r = await listRemarketingRules().catch((e) => {
    if (e instanceof MedusaError) return { rules: [] as RemarketingRule[], count: 0, _error: e.message }
    throw e
  })
  const rules: RemarketingRule[] = r.rules
  const error = "_error" in r ? r._error : null

  // Métricas globales
  const active = rules.filter((rule) => rule.is_active).length
  const totalFired = rules.reduce((s, r) => s + (r.fired_count ?? 0), 0)
  const totalConverted = rules.reduce((s, r) => s + (r.converted_count ?? 0), 0)
  const overallConvRate = totalFired > 0 ? (totalConverted / totalFired) * 100 : 0

  // Group by channel
  const byChannel = new Map<string, RemarketingRule[]>()
  for (const rule of rules) {
    const arr = byChannel.get(rule.channel) ?? []
    arr.push(rule)
    byChannel.set(rule.channel, arr)
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Campañas" }]} />

      <PageHeader
        title="CAMPAÑAS"
        stamp={<>{active} ACTIVAS · {overallConvRate.toFixed(1)}% CONVERSIÓN</>}
        stampTone={overallConvRate > 5 ? "secondary" : overallConvRate > 1 ? "orange" : "primary"}
        description={`${rules.length} reglas configuradas · ${totalFired.toLocaleString("es-VE")} envíos · ${totalConverted.toLocaleString("es-VE")} conversiones`}
      />

      <MarketingNav />

      {error && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{error}</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Reglas activas"   value={`${active}/${rules.length}`} sub="ejecutándose" tone="secondary" />
        <Kpi label="Envíos totales"   value={totalFired.toLocaleString("es-VE")} sub="acumulado histórico" />
        <Kpi label="Conversiones"     value={totalConverted.toLocaleString("es-VE")} sub="completadas exitosamente" tone="orange" />
        <Kpi label="Conv. promedio"   value={`${overallConvRate.toFixed(1)}%`} sub="enviados → convertidos" tone={overallConvRate > 5 ? "secondary" : "primary"} />
      </div>

      {/* Reglas por canal */}
      {rules.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <Send size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin reglas de remarketing</p>
          <p className="text-[12px] text-ink-3 mt-1">Las reglas se configuran via plugin del backend (Medusa).</p>
        </div>
      ) : (
        Array.from(byChannel.entries()).map(([channel, channelRules]) => {
          const meta = CHANNEL_META[channel] ?? CHANNEL_META.email
          const Icon = meta.icon
          return (
            <div key={channel} className="stamp-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 text-cream" style={{ background: meta.color }}>
                <div className="flex items-center gap-2">
                  <Icon size={14} strokeWidth={2.5} />
                  <h3 className="font-display font-black text-[14px] uppercase tracking-wider">{meta.label}</h3>
                  <span className="text-[10px] font-mono opacity-80">· {channelRules.length} reglas</span>
                </div>
                <span className="text-[10px] font-mono opacity-80">
                  {channelRules.reduce((s, r) => s + (r.fired_count ?? 0), 0).toLocaleString("es-VE")} envíos · {channelRules.reduce((s, r) => s + (r.converted_count ?? 0), 0).toLocaleString("es-VE")} conv.
                </span>
              </div>
              <ul className="divide-y divide-warm-200/50">
                {channelRules.map((rule) => <CampaignRow key={rule.id} rule={rule} channelColor={meta.color} />)}
              </ul>
            </div>
          )
        })
      )}

      {/* Hint sobre A/B testing y multi-step */}
      <div className="stamp-card p-4 bg-cream-2/30">
        <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2">A/B testing & multi-step</h4>
        <ul className="text-[11px] text-ink-2 space-y-1 font-mono">
          <li>· Cada regla puede tener variantes A/B en su <code>metadata.variants</code> (subject + body)</li>
          <li>· El backend rota equitativamente y registra cuál convirtió. Ver detalle individual abajo.</li>
          <li>· Para crear/editar reglas usa el endpoint <code>POST /admin/remarketing/rules</code> (panel display-only)</li>
          <li>· Triggers soportados: <code>cart_abandoned</code>, <code>order_completed</code>, <code>inactive_7d</code>, <code>inactive_30d</code>, etc.</li>
        </ul>
      </div>
    </div>
  )
}

function CampaignRow({ rule, channelColor }: { rule: RemarketingRule; channelColor: string }) {
  const fired = rule.fired_count ?? 0
  const converted = rule.converted_count ?? 0
  const convRate = fired > 0 ? (converted / fired) * 100 : 0

  // Detectar si tiene variantes A/B en metadata (sin backend support real, asumimos shape)
  const meta = (rule as { metadata?: Record<string, unknown> }).metadata ?? {}
  const variants = meta.variants as Array<{ name: string; fired?: number; converted?: number }> | undefined
  const hasABTest = Array.isArray(variants) && variants.length >= 2

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-display font-bold text-[13px] text-ink">{rule.name}</span>
            <span className="text-[9px] font-mono text-ink-3">· {rule.rule_key}</span>
            {!rule.is_active && (
              <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider bg-primary/15 text-primary rounded-md flex items-center gap-1">
                <Pause size={9} /> PAUSADA
              </span>
            )}
            {rule.is_active && (
              <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider bg-secondary/15 text-secondary rounded-md flex items-center gap-1">
                <Activity size={9} /> ACTIVA
              </span>
            )}
            {hasABTest && (
              <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider bg-orange/15 text-orange rounded-md flex items-center gap-1">
                <FlaskConical size={9} /> A/B
              </span>
            )}
          </div>
          {rule.description && <p className="text-[11px] text-ink-3 mt-1">{rule.description}</p>}
          {rule.cooldown_hours != null && (
            <p className="text-[10px] text-ink-3 font-mono mt-1">Cooldown: {rule.cooldown_hours}h por usuario</p>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <Stat label="Envíos"    value={fired.toLocaleString("es-VE")} />
          <Stat label="Conv."     value={converted.toLocaleString("es-VE")} tone="secondary" />
          <Stat label="Tasa"      value={`${convRate.toFixed(1)}%`}
            tone={convRate >= 5 ? "secondary" : convRate >= 1 ? "orange" : "primary"} big />
        </div>
      </div>
      {hasABTest && (
        <div className="mt-3 pt-3 grid grid-cols-2 gap-2" style={{ borderTop: "1.5px dashed var(--border)" }}>
          {variants!.map((v, i) => {
            const vRate = v.fired && v.fired > 0 ? ((v.converted ?? 0) / v.fired) * 100 : 0
            const isWinner = variants!.length > 1 && vRate === Math.max(...variants!.map((vv) => vv.fired && vv.fired > 0 ? ((vv.converted ?? 0) / vv.fired) * 100 : 0))
            return (
              <div key={i} className={`p-2 rounded-md ${isWinner ? "bg-secondary/10" : "bg-cream-2/40"}`} style={{ border: `1.5px solid ${isWinner ? "#4D5431" : "var(--border)"}` }}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display font-bold text-[11px]" style={{ color: isWinner ? "#4D5431" : channelColor }}>
                    Variante {String.fromCharCode(65 + i)} {isWinner && "· 🏆"}
                  </span>
                  <span className="text-[10px] font-mono num">{vRate.toFixed(1)}%</span>
                </div>
                <p className="text-[10px] text-ink-3 font-mono truncate mt-0.5">{v.name}</p>
                <p className="text-[9px] text-ink-3 font-mono mt-0.5">{(v.fired ?? 0).toLocaleString("es-VE")} envíos · {(v.converted ?? 0).toLocaleString("es-VE")} conv.</p>
              </div>
            )
          })}
        </div>
      )}
    </li>
  )
}

function Stat({ label, value, tone, big }: { label: string; value: string; tone?: "primary" | "secondary" | "orange"; big?: boolean }) {
  const valueCls = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink"
  return (
    <div className="text-right">
      <div className={`font-display font-black num ${big ? "text-[18px]" : "text-[14px]"} ${valueCls}`}>{value}</div>
      <div className="text-[8px] font-display font-bold uppercase tracking-wider text-ink-3">{label}</div>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "primary" | "secondary" | "orange" }) {
  const bg = tone === "primary" ? "bg-primary/5" : tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : ""
  return (
    <div className={`stamp-card p-4 ${bg}`}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`stat-display text-[24px] mt-2 num ${valueTone}`}>{value}</div>
      <div className="text-[10px] mt-1 text-ink-3 font-mono">{sub}</div>
    </div>
  )
}
