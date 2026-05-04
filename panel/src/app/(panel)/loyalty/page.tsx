import Link from "next/link"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { CreateReward } from "./CreateReward"
import { MarketingNav } from "../marketing/MarketingNav"
import { computeRfm, TIER_META, TIER_THRESHOLDS, tierFromMonetary, type LoyaltyTier } from "../marketing/_lib"
import {
  listLoyaltyRewards,
  listReferrals,
  listOrders,
  listCustomers,
  MedusaError,
  type LoyaltyReward,
  type ReferralRecord,
} from "@/lib/medusa"
import { fmtEur, fmtRelative } from "@/lib/utils"

export default async function LoyaltyPage() {
  const [rewardsR, awardedR, ordersR, customersR] = await Promise.allSettled([
    listLoyaltyRewards(),
    listReferrals({ status: "awarded", limit: 30 }),
    listOrders({ limit: 1000 }),
    listCustomers({ limit: 1000 }),
  ])

  const rewards: LoyaltyReward[] = rewardsR.status === "fulfilled" ? rewardsR.value.rewards : []
  const awarded: ReferralRecord[] = awardedR.status === "fulfilled" ? awardedR.value.referrals : []
  const orders = ordersR.status === "fulfilled" ? ordersR.value.orders : []
  const customers = customersR.status === "fulfilled" ? customersR.value.customers : []

  const sessionExpired = [rewardsR, awardedR, ordersR, customersR].some(
    (r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401
  )

  // RFM-derived tier distribution + leaderboard
  const rfm = computeRfm(customers, orders)
  const byTier = new Map<LoyaltyTier, number>()
  for (const r of rfm) {
    const tier = tierFromMonetary(r.monetary)
    byTier.set(tier, (byTier.get(tier) ?? 0) + 1)
  }
  const leaderboard = rfm.slice().sort((a, b) => b.monetary - a.monetary).slice(0, 10)

  // Aggregaciones
  const activeRewards = rewards.filter((r) => r.is_active).length
  const pausedRewards = rewards.length - activeRewards
  const pointsAwardedReferrals = awarded.reduce(
    (s, r) => s + (r.referrer_points ?? 0) + (r.referee_points ?? 0),
    0
  )

  // Top miembro por puntos otorgados como referrer (proxy)
  const referrerStats = new Map<string, { points: number; conv: number }>()
  for (const r of awarded) {
    const existing = referrerStats.get(r.referrer_customer_id) ?? { points: 0, conv: 0 }
    existing.points += r.referrer_points ?? 0
    existing.conv += 1
    referrerStats.set(r.referrer_customer_id, existing)
  }
  const topReferrer = Array.from(referrerStats.entries()).sort((a, b) => b[1].points - a[1].points)[0]

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="★" />

      <PageHeader
        title="LOYALTY"
        stamp={<span>{rewards.length} RECOMPENSAS · {awarded.length} REFERIDOS</span>}
        stampTone="orange"
        description={`10 pts × €1 pagado · ${pointsAwardedReferrals.toLocaleString("es-VE")} pts otorgados por referidos`}
        actions={<CreateReward />}
      />

      <MarketingNav />

      {sessionExpired && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">Sesión expirada. Recarga la página.</p>
        </div>
      )}

      {/* Tier distribution + leaderboard */}
      {rfm.length > 0 && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-7 stamp-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Distribución por tier</h3>
              <span className="text-[10px] text-cream/60 font-mono">{rfm.length} miembros</span>
            </div>
            <ul className="divide-y divide-warm-200/50">
              {(["diamond", "platinum", "gold", "silver", "bronze"] as LoyaltyTier[]).map((tier) => {
                const count = byTier.get(tier) ?? 0
                const meta = TIER_META[tier]
                const pct = rfm.length > 0 ? (count / rfm.length) * 100 : 0
                return (
                  <li key={tier} className="p-3 flex items-center gap-3">
                    <div className={`w-12 h-12 flex items-center justify-center font-display font-black text-[10px] flex-shrink-0 ${meta.bg}`}
                      style={{ border: `2px solid ${meta.color}`, color: tier === "diamond" ? "#fff" : meta.color }}>
                      {meta.label.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display font-black text-[14px] uppercase tracking-tight" style={{ color: meta.color }}>{meta.label}</span>
                        <span className="text-[10px] text-ink-3 font-mono">≥ {fmtEur(TIER_THRESHOLDS[tier])}</span>
                      </div>
                      <p className="text-[11px] text-ink-3">{meta.benefit}</p>
                      <div className="w-full h-1.5 bg-cream-2 rounded-md overflow-hidden mt-1.5">
                        <div className="h-full transition-all" style={{ width: `${Math.max(pct, 1)}%`, background: meta.color }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display font-black text-[18px] num">{count}</div>
                      <div className="text-[9px] text-ink-3 font-mono">{pct.toFixed(0)}%</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="col-span-5 stamp-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-orange text-dark">
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">🏆 LEADERBOARD</h3>
              <span className="text-[10px] font-mono">top 10 spenders</span>
            </div>
            <ol className="divide-y divide-warm-200/50">
              {leaderboard.map((r, i) => {
                const tier = tierFromMonetary(r.monetary)
                const meta = TIER_META[tier]
                return (
                  <li key={r.customerId} className="p-3 flex items-center gap-3">
                    <span className={`w-7 h-7 flex items-center justify-center font-display font-black text-[12px] flex-shrink-0 rounded-full ${
                      i === 0 ? "bg-orange text-dark" : i < 3 ? "bg-secondary/20 text-secondary" : "bg-cream-2 text-ink-3"
                    }`}>
                      {i + 1}
                    </span>
                    <Link href={`/customers/${r.customerId}`} className="flex-1 min-w-0 hover:text-orange">
                      <div className="font-display font-bold text-ink text-[12px] truncate">{r.name}</div>
                      <div className="text-[10px] text-ink-3 font-mono truncate">{r.email}</div>
                    </Link>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display font-black num text-[13px]">{fmtEur(r.monetary)}</div>
                      <span className="text-[8px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white"
                        style={{ background: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5">
        <Kpi icon="🎁" label="Recompensas activas" value={String(activeRewards)} sub={pausedRewards > 0 ? `${pausedRewards} pausadas` : "todas activas"} tone="secondary" />
        <Kpi icon="★"  label="Pts otorgados (refs)" value={pointsAwardedReferrals.toLocaleString("es-VE")} sub={`a ${awarded.length} relaciones`} tone="orange" />
        <Kpi icon="👥" label="Referidos exitosos"   value={String(awarded.length)} sub="primera compra completada" />
        <Kpi
          icon="⚡"
          label="Top referidor"
          customValue={topReferrer ? (
            <>
              <div className="font-display font-black text-[14px] mt-1 truncate">{topReferrer[0].slice(0, 20)}{topReferrer[0].length > 20 ? "…" : ""}</div>
              <div className="text-[10px] text-ink-3 font-mono mt-1 num">{topReferrer[1].points.toLocaleString("es-VE")} ★ · {topReferrer[1].conv} conv.</div>
            </>
          ) : (
            <div className="font-display font-bold text-[12px] text-ink-3 mt-1">Sin datos aún</div>
          )}
        />
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Rewards catalog */}
        <div className="col-span-7 stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Catálogo de Recompensas</h3>
            <span className="text-[10px] font-mono text-cream/60">
              {activeRewards} activas{pausedRewards > 0 && ` · ${pausedRewards} pausadas`}
            </span>
          </div>
          {rewards.length === 0 ? (
            <div className="p-10 text-center text-ink-3 text-[13px]">
              Sin recompensas configuradas todavía.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-0">
              {rewards.map((r, i) => {
                const status =
                  !r.is_active                       ? { label: "Pausada",     cls: "text-ink-3" }
                  : (r.stock != null && r.stock <= 0) ? { label: "Sin stock",   cls: "text-primary" }
                  : (r.stock != null && r.stock < 10) ? { label: "Stock bajo",  cls: "text-orange" }
                  :                                     { label: "Activa",      cls: "text-secondary" }
                return (
                  <div
                    key={r.id}
                    className={`p-4 row-hover flex items-center gap-3 ${!r.is_active ? "opacity-60" : ""}`}
                    style={{
                      borderBottom: i < rewards.length - (rewards.length % 2 === 0 ? 2 : 1) ? "1px solid var(--border-soft)" : undefined,
                      borderRight: i % 2 === 0 ? "1px solid var(--border-soft)" : undefined,
                    }}
                  >
                    <div className="w-14 h-14 bg-cream-2 flex-shrink-0 overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
                      {r.image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-ink text-[13px] truncate">{r.name}</div>
                      <div className="text-[10px] text-ink-3 font-mono">
                        {r.stock == null ? "stock ilimitado" : `stock: ${r.stock} uds`}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`font-display font-black text-[14px] num ${r.is_active ? "text-orange" : "text-ink-3"}`}>
                          {r.points_required.toLocaleString("es-VE")} ★
                        </span>
                        <span className={`pill ${status.cls}`}><span className="pill-dot" />{status.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent referrals as ledger proxy */}
        <div className="col-span-5 stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Referidos Recientes</h3>
            <span className="text-[10px] text-cream/60 font-mono">{awarded.length}</span>
          </div>
          {awarded.length === 0 ? (
            <div className="p-10 text-center text-ink-3 text-[13px]">
              Sin referidos exitosos todavía. Tu primera conversión aparecerá aquí.
            </div>
          ) : (
            <div className="divide-y divide-warm-200/50 text-[12px]">
              {awarded.slice(0, 12).map((r) => (
                <div key={r.id} className="p-3 flex items-center gap-2.5 row-hover">
                  <div
                    className="w-7 h-7 bg-orange text-dark flex items-center justify-center font-display font-black text-[11px]"
                    style={{ border: "1.5px solid #FF3B27" }}
                  >
                    ★
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink truncate">
                      <span className="font-mono text-orange">{r.code}</span>
                      {r.referee_email && <span className="text-ink-3"> → {r.referee_email}</span>}
                    </div>
                    <div className="text-[10px] text-ink-3 font-mono">
                      {r.referrer_points + r.referee_points} pts · {r.awarded_at ? fmtRelative(r.awarded_at) : fmtRelative(r.created_at)}
                    </div>
                  </div>
                  <span className="font-display font-black text-orange num">
                    +{(r.referrer_points + r.referee_points).toLocaleString("es-VE")} ★
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  icon, label, value, sub, tone, customValue,
}: {
  icon: string
  label: string
  value?: string
  sub?: string
  tone?: "orange" | "secondary"
  customValue?: React.ReactNode
}) {
  const bg = tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const labelCls = tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const valueCls = tone === "secondary" ? "text-secondary" : ""
  return (
    <div className={`stamp-card p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[14px]">{icon}</span>
        <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelCls}`}>{label}</div>
      </div>
      {customValue ?? <div className={`stat-display text-[26px] mt-1 num ${valueCls}`}>{value}</div>}
      {sub && !customValue && <div className="text-[10px] text-ink-3 font-mono mt-1">{sub}</div>}
    </div>
  )
}
