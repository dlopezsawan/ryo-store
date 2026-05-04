import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import {
  listPromotions,
  listReferrals,
  listRemarketingRules,
  MedusaError,
  type AdminPromotion,
  type ReferralRecord,
  type RemarketingRule,
} from "@/lib/medusa"
import { PromotionsManager } from "./PromotionsManager"
import { MarketingNav } from "./MarketingNav"

export default async function MarketingPage() {
  const [promosR, awardedR, rejectedR, rulesR] = await Promise.allSettled([
    listPromotions({ limit: 50 }),
    listReferrals({ status: "awarded", limit: 50 }),
    listReferrals({ status: "rejected", limit: 20 }),
    listRemarketingRules(),
  ])

  const promotions: AdminPromotion[] = promosR.status === "fulfilled" ? promosR.value.promotions : []
  const awarded: ReferralRecord[] = awardedR.status === "fulfilled" ? awardedR.value.referrals : []
  const rejected: ReferralRecord[] = rejectedR.status === "fulfilled" ? rejectedR.value.referrals : []
  const rules: RemarketingRule[] = rulesR.status === "fulfilled" ? rulesR.value.rules : []

  const sessionExpired = [promosR, awardedR, rejectedR, rulesR].some(
    (r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401
  )

  // Aggregaciones
  const activePromos = promotions.filter((p) => p.status === "active").length
  const referralsByCode = new Map<string, { count: number; points: number }>()
  for (const r of awarded) {
    const e = referralsByCode.get(r.code) ?? { count: 0, points: 0 }
    e.count += 1
    e.points += r.referrer_points + r.referee_points
    referralsByCode.set(r.code, e)
  }
  const topCodes = Array.from(referralsByCode.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  const totalReferralPoints = awarded.reduce((s, r) => s + r.referrer_points + r.referee_points, 0)
  const activeRules = rules.filter((r) => r.is_active).length

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />

      <PageHeader
        title="MARKETING"
        stamp={<span>{activePromos} PROMOS · {activeRules} REGLAS</span>}
        stampTone="orange"
        description={
          <>
            {promotions.length} promociones · {awarded.length} referidos exitosos
            {totalReferralPoints > 0 && <> · <span className="text-ink font-bold num">{totalReferralPoints.toLocaleString("es-VE")} ★</span> distribuidos</>}
          </>
        }
      />

      <MarketingNav />

      {sessionExpired && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">Sesión expirada. Recarga la página.</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Promociones activas"  value={String(activePromos)} sub={`de ${promotions.length} totales`} />
        <Kpi label="Referidos exitosos"   value={String(awarded.length)} sub={rejected.length > 0 ? `${rejected.length} rechazados` : "100% exitosos"} tone="secondary" />
        <Kpi label="Reglas remarketing"   value={String(activeRules)}  sub={`de ${rules.length} configuradas`} tone="orange" />
        <Kpi label="Códigos generados"    value={String(referralsByCode.size)} sub="con al menos 1 conversión" />
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Promos */}
        <div className="col-span-7 stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <div>
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Promociones</h3>
              <p className="text-[10px] text-cream/60 font-mono">códigos manuales + automáticos</p>
            </div>
            <span className="text-[10px] text-cream/60 font-mono">{promotions.length} totales</span>
          </div>
          <div className="p-3">
            <PromotionsManager
              rows={promotions.map((p) => {
                const ruleSummary = p.rules && p.rules.length > 0
                  ? p.rules
                      .map((r) => {
                        const vals = (r.values ?? [])
                          .map((v) => (typeof v === "string" ? v : v.value))
                          .join(",")
                        return `${r.attribute} ${r.operator} ${vals}`
                      })
                      .join(" · ")
                  : "sin reglas"
                return {
                  id: p.id,
                  code: p.code,
                  status: p.status,
                  is_automatic: p.is_automatic,
                  type: p.application_method?.type ?? "percentage",
                  value: p.application_method?.value ?? 0,
                  ruleSummary,
                }
              })}
            />
          </div>
        </div>

        {/* Right: referrals + remarketing */}
        <div className="col-span-5 space-y-5">
          {/* Referrals */}
          <div className="stamp-card p-5 bg-orange/5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display font-black text-[15px] uppercase tracking-tight">Referidos</h3>
                <p className="text-[11px] text-ink-3 font-medium mt-0.5">200 pts a cada uno · primera compra</p>
              </div>
              <span className="vintage-stamp text-orange" style={{ background: "rgb(var(--surface))" }}>{awarded.length} EXITOSOS</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <ReferralStat value={String(referralsByCode.size)}                          label="Códigos generados" border="var(--border)" />
              <ReferralStat value={String(awarded.length)}                                label="Conversiones"      border="#FF3B27" valueTone="text-orange" />
              <ReferralStat value={totalReferralPoints.toLocaleString("es-VE")}            label="Pts otorgados"     border="#4D5431" valueTone="text-secondary" />
            </div>
            {topCodes.length > 0 && (
              <>
                <div className="dotted-div my-3" />
                <div className="space-y-1.5 text-[11px]">
                  {topCodes.map(([code, stats], i) => (
                    <div key={code} className="flex items-center justify-between">
                      <span className="font-mono">
                        {code}
                        <span className="text-ink-3"> · {stats.count} conv.</span>
                      </span>
                      <span className={`font-display font-black num ${i === 0 ? "text-orange" : "text-ink"}`}>
                        {stats.points.toLocaleString("es-VE")} ★
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Remarketing */}
          <div className="stamp-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-black text-[15px] uppercase tracking-tight">Remarketing</h3>
              <span className="pill text-secondary">
                <span className="pill-dot" />{activeRules} de {rules.length}
              </span>
            </div>
            {rules.length === 0 ? (
              <p className="text-[11px] text-ink-3">Sin reglas de remarketing configuradas.</p>
            ) : (
              <div className="space-y-2 text-[11px]">
                {rules.slice(0, 5).map((r) => {
                  const channelColor = r.channel === "email" ? "#4D5431" : r.channel === "whatsapp" ? "#FF3B27" : "#BB3B2E"
                  return (
                    <div key={r.id} className="p-2.5" style={{ borderLeft: `3px solid ${channelColor}` }}>
                      <div className="font-display font-bold text-ink truncate">{r.name}</div>
                      <div className="text-ink-3 mt-0.5 font-mono text-[10px]">
                        {r.channel.toUpperCase()}
                        {typeof r.fired_count === "number" && (
                          <> · {r.fired_count} enviados</>
                        )}
                        {typeof r.converted_count === "number" && r.fired_count && r.fired_count > 0 && (
                          <> · {r.converted_count} conv ({((r.converted_count / r.fired_count) * 100).toFixed(0)}%)</>
                        )}
                        {!r.is_active && <span className="text-primary"> · pausada</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "orange" | "secondary" }) {
  const bg = tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const labelCls = tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const valueCls = tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : ""
  return (
    <div className={`stamp-card p-4 ${bg}`}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelCls}`}>{label}</div>
      <div className={`stat-display text-[28px] mt-2 num ${valueCls}`}>{value}</div>
      <div className="text-[10px] text-ink-3 font-mono mt-1">{sub}</div>
    </div>
  )
}

function ReferralStat({ value, label, border, valueTone }: { value: string; label: string; border: string; valueTone?: string }) {
  return (
    <div className="p-3 bg-cream" style={{ border: `1.5px solid ${border}` }}>
      <div className={`stat-display text-[22px] num ${valueTone ?? ""}`}>{value}</div>
      <div className="text-[9px] text-ink-3 font-display font-bold uppercase tracking-wider mt-1">{label}</div>
    </div>
  )
}
