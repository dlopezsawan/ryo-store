"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Select } from "@medusajs/ui"
import { useState, useEffect, useMemo } from "react"
import { ChartBar, MagnifyingGlass, DocumentText, Trophy, Bolt, BellAlert } from "@medusajs/icons"

const API = "https://api.enrola.shop"

// ─── Enrola sidebar branding (runs once per session) ──────────────────────────
// Replaces the single-letter avatar in the sidebar with the Enrola logo.
const ENROLA_LOGO_URL =
  "data:image/svg+xml,%3Csvg viewBox='0 0 4500 4500' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform='matrix(1,0,0,1,-105,-5062.5)'%3E%3Cg transform='matrix(4.166667,0,0,4.166667,105,5062.5)'%3E%3Cg%3E%3Cg transform='matrix(1.994959,0,0,1.994959,-537.277835,-537.277893)'%3E%3Cg transform='matrix(1,0,0,1,613.7805,397.0129)'%3E%3Cpath d='M0,285.937C1.478,283.652 3.251,281.422 5.817,280.41C7.009,279.94 8.299,279.765 9.57,279.563C37.241,275.16 67.066,255.577 74.909,228.556C81.434,206.077 75.135,179.305 65.729,158.52C62.483,151.345 61.773,143.642 59.11,136.152C53.701,120.938 43.795,105.23 47.479,88.555C49.976,77.248 58.653,67.598 59.619,56.075C60.788,42.139 51.49,32.203 40.547,24.635C31.206,18.175 21.342,12.242 10.52,8.49C-0.303,4.738-12.202,3.261-23.397,5.807C-38.059,9.141-50.76,19.623-56.416,33.056C-62.072,46.489-60.534,62.519-52.417,74.729C-51.874,75.545-51.293,76.357-50.514,76.971C-48.269,78.739-44.829,78.426-42.358,76.963C-39.679,75.376-38.225,72.636-35.67,70.952C-33.354,69.425-30.295,68.856-27.767,67.751C-26.257,67.091-24.697,66.176-23.055,66.449C-21.443,66.718-20.258,68.133-19.914,69.631C-19.569,71.128-19.914,72.687-20.39,74.153C-22.046,79.252-25.342,84.218-24.498,89.488C-23.218,97.47-11.733,101.08-4.29,101.844C-1.219,102.16 1.947,101.898 4.92,102.649C10.296,104.006 13.932,108.333 17.004,112.468C28.882,128.457 38.204,145.675 45.306,163.679C50.399,176.588 53.703,189.543 52.019,203.456C49.824,221.597 39.106,238.83 23.839,250.633C17.599,255.457 10.748,258.028 3.443,260.886C-1.558,262.843-9.48,265.52-12.282,270.164C-13.47,272.132-13.905,274.546-15.541,276.19C-17.435,278.093-20.496,278.466-23.198,278.031C-25.899,277.596-28.432,276.489-31.091,275.853C-47.3,271.974-55.408,287.251-69.736,287.082C-92.092,286.817-111.98,282.839-132.898,275.495C-138.578,273.501-144.679,271.796-150.118,269.283C-159.705,264.853-169.592,258.182-179.178,253.752C-186.506,250.366-192.341,246.299-198.551,241.329C-237.399,210.232-254.521,173.922-249.714,125.005C-246.355,90.817-237.763,56.536-220.838,25.894C-177.004,-53.463-63.168,-61.557 23.165,-10.268C109.497,41.02 118.416,130.934 108.192,179.205C97.969,227.477 95.807,306.136 0.388,330.272C-40.055,340.502-84.628,347.624-126.77,338.347C-167.338,329.418-204.024,305.618-235.146,281.708C-258.914,263.447-297.221,248.625-323.402,274.46C-332.87,283.804-330.197,289.915-328.52,302.69C-326.305,319.561-317.347,336.034-304.561,348.04C-292.856,359.03-269.192,368.482-281.031,343.012C-285.307,333.812-299.705,314.848-292.392,304.748C-280.213,287.926-196.569,363.17-182.049,370.843C-143.514,391.203-96.097,390.565-53.186,392.419C-19.215,393.887 16.215,390.882 45.767,373.754C99.015,342.892 162.466,303.493 179.227,182.312C185.161,139.416 184.38,100.029 168.465,59.102C153.952,21.781 131.182,-11.204 102.811,-41.329C84.758,-60.498 59.374,-78.627 33.928,-87.921C6.276,-98.021-29.216,-107.95-58.871,-106.658C-137.356,-103.24-210.995,-101.908-269.587,-23.727C-298.327,14.62-310.942,60.898-309.586,107.856C-308.614,141.556-303.969,191.509-281.434,218.735C-269.571,233.068-252.985,247.87-237.068,257.974C-220.766,268.323-202.248,274.9-185.546,284.604C-145.175,308.06-92.223,321.566-46.56,303.265C-41.032,301.049-35.081,299.816-29.096,299.646C-20.79,299.41-11.522,300.603-5.425,293.894C-3.411,291.677-1.956,289.053-0.377,286.531C-0.254,286.333-0.128,286.135 0,285.937' style='fill:rgb(255,59,39);fill-rule:nonzero;'/%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E"

function activateEnrolaBranding() {
  const w = window as unknown as Record<string, unknown>
  if (w.__enrolaSidebarActive) return
  w.__enrolaSidebarActive = true

  const STYLE_ID = "enrola-sidebar-css"
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = `
      .enrola-sidebar-avatar {
        font-size: 0 !important;
        color: transparent !important;
        background-image: url("${ENROLA_LOGO_URL}") !important;
        background-size: 70% 70% !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        overflow: hidden !important;
      }
      .enrola-sidebar-avatar > * { visibility: hidden !important; }
    `
    document.head.appendChild(style)
  }

  function apply() {
    const all = document.querySelectorAll<HTMLElement>("div, button, span, a")
    for (const node of all) {
      if (node.classList.contains("enrola-sidebar-avatar")) continue
      if (node.childElementCount > 1) continue
      const text = (node.textContent || "").trim()
      if (text.length !== 1 || !/^[A-Za-z0-9]$/.test(text)) continue
      const ow = node.offsetWidth
      const oh = node.offsetHeight
      if (ow < 16 || ow > 56 || oh < 16 || oh > 56) continue
      if (Math.abs(ow - oh) > 8) continue
      const bg = window.getComputedStyle(node).backgroundColor
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue
      node.classList.add("enrola-sidebar-avatar")
    }
  }
  apply()
  const obs = new MutationObserver(() => requestAnimationFrame(apply))
  obs.observe(document.body, { childList: true, subtree: true })
  // Observer runs for the whole session — no cleanup.
}

type TabId = "overview" | "keywords" | "pages" | "venezuela" | "opportunities" | "technical"

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: ChartBar },
  { id: "keywords", label: "Keywords", icon: MagnifyingGlass },
  { id: "pages", label: "Páginas", icon: DocumentText },
  { id: "venezuela", label: "🇻🇪 Venezuela", icon: ChartBar },
  { id: "opportunities", label: "Oportunidades", icon: Trophy },
  { id: "technical", label: "Salud Técnica", icon: Bolt },
]

type Competitor = { id: string; name: string; domain?: string | null; instagram?: string | null; threat: string }
type Keyword = { id: string; keyword: string; country: string; source: string }
type QueryRow = { query: string; impressions: number; clicks: number; ctr: number; position: number | null }
type PageRow = { page: string; impressions: number; clicks: number; ctr: number; position: number | null; unique_queries: number }
type SeriesPoint = { date: string; impressions: number; clicks: number; ctr: number; position: number | null }

// GSC returns country codes as ISO 3166-1 alpha-3 (lowercased)
const CC_LABELS: Record<string, string> = {
  ven: "🇻🇪 Venezuela", usa: "🇺🇸 EEUU", col: "🇨🇴 Colombia", mex: "🇲🇽 México",
  esp: "🇪🇸 España", arg: "🇦🇷 Argentina", chl: "🇨🇱 Chile", per: "🇵🇪 Perú",
  ecu: "🇪🇨 Ecuador", pan: "🇵🇦 Panamá", bra: "🇧🇷 Brasil", dom: "🇩🇴 R. Dominicana",
  uru: "🇺🇾 Uruguay", gtm: "🇬🇹 Guatemala", hnd: "🇭🇳 Honduras", slv: "🇸🇻 El Salvador",
  cri: "🇨🇷 Costa Rica", nic: "🇳🇮 Nicaragua", pry: "🇵🇾 Paraguay", bol: "🇧🇴 Bolivia",
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—"
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k"
  return String(Math.round(n))
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null) return "—"
  return (n * 100).toFixed(digits) + "%"
}

function fmtPos(n: number | null | undefined): string {
  if (n == null) return "—"
  return n.toFixed(1)
}

function fmtDelta(pct: number | null, invert = false): { text: string; color: string } {
  if (pct == null) return { text: "—", color: "#888" }
  const up = invert ? pct < 0 : pct > 0
  const sign = pct > 0 ? "+" : ""
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    color: up ? "#10b981" : pct === 0 ? "#888" : "#ef4444",
  }
}

export default function SeoAnalyticsPage() {
  const [tab, setTab] = useState<TabId>("overview")
  const [country, setCountry] = useState<string>("all")
  const [days, setDays] = useState<number>(28)
  const [headerConfig, setHeaderConfig] = useState<any>(null)

  // Activate Enrola branding on sidebar avatar (survives whole session via observer)
  useEffect(() => { activateEnrolaBranding() }, [])

  // Fetch config once for link-out grid
  useEffect(() => {
    fetch(`${API}/admin/seo/overview?days=28`, { credentials: "include" })
      .then(r => r.json()).then(d => setHeaderConfig(d?.config || null)).catch(() => {})
  }, [])

  return (
    <Container>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ChartBar />
          <Heading level="h1">SEO Analytics</Heading>
          <Badge color="green">v1 · live</Badge>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <LinkOutGrid
            config={headerConfig}
            umamiUrl="https://analytics.enrola.shop"
            clarityId="wfp9s5wh5i"
            posthogProjectId="393363"
          />
          <ExportMenu />
        </div>
      </div>
      <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 20 }}>
        GSC + GA4 + CrUX + Umami + PostHog + Medusa unificados. Sync diario. Ver{" "}
        <a href="/docs/SEO-ANALYTICS.md" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>manual</a>.
      </Text>

      {/* Global filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <Text size="xsmall" className="text-ui-fg-muted" style={{ marginBottom: 4 }}>País</Text>
          <Select value={country} onValueChange={setCountry}>
            <Select.Trigger style={{ width: 180 }}><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="all">Todos</Select.Item>
              <Select.Item value="ven">🇻🇪 Venezuela</Select.Item>
              <Select.Item value="col">🇨🇴 Colombia</Select.Item>
              <Select.Item value="mex">🇲🇽 México</Select.Item>
              <Select.Item value="usa">🇺🇸 EEUU</Select.Item>
              <Select.Item value="esp">🇪🇸 España</Select.Item>
              <Select.Item value="arg">🇦🇷 Argentina</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-muted" style={{ marginBottom: 4 }}>Periodo</Text>
          <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v, 10))}>
            <Select.Trigger style={{ width: 140 }}><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="7">Últimos 7d</Select.Item>
              <Select.Item value="28">Últimos 28d</Select.Item>
              <Select.Item value="90">Últimos 90d</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-ui-border-base, #2e2e32)", marginBottom: 24, overflowX: "auto" }}>
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              background: "transparent", border: "none",
              borderBottom: active ? "2px solid var(--color-ui-fg-interactive, #ff7a00)" : "2px solid transparent",
              color: active ? "var(--color-ui-fg-base, #fff)" : "var(--color-ui-fg-muted, #a0a0a0)",
              cursor: "pointer", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
            }}>
              <Icon />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {tab === "overview" && <OverviewTab country={country} days={days} />}
      {tab === "keywords" && <KeywordsTab />}
      {tab === "pages" && <PagesTab country={country} days={days} />}
      {tab === "venezuela" && <VenezuelaTab />}
      {tab === "opportunities" && <OpportunitiesTab />}
      {tab === "technical" && <TechnicalTab />}
    </Container>
  )
}

// ─── Overview · 5-layer funnel (unified) ────────────────────────────────────
function OverviewTab({ country, days }: { country: string; days: number }) {
  const [gsc, setGsc] = useState<any>(null)
  const [queries, setQueries] = useState<QueryRow[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [attribution, setAttribution] = useState<any>(null)
  const [umami, setUmami] = useState<any>(null)
  const [posthog, setPosthog] = useState<any>(null)
  const [technical, setTechnical] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/admin/seo/overview?country=${country}&days=${days}`, { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch(`${API}/admin/seo/queries?country=${country}&days=${days}&limit=10&sort=clicks`, { credentials: "include" }).then(r => r.json()).catch(() => ({ queries: [] })),
      fetch(`${API}/admin/seo/competitors`, { credentials: "include" }).then(r => r.json()).catch(() => ({ competitors: [] })),
      fetch(`${API}/admin/seo/attribution?days=${days}`, { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch(`${API}/admin/seo/umami?days=${days}`, { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch(`${API}/admin/dev/posthog/overview`, { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch(`${API}/admin/seo/technical`, { credentials: "include" }).then(r => r.json()).catch(() => null),
    ]).then(([g, q, c, a, u, ph, t]) => {
      setGsc(g); setQueries(q.queries || []); setCompetitors(c.competitors || []); setAttribution(a); setUmami(u); setPosthog(ph); setTechnical(t)
    }).finally(() => setLoading(false))
  }, [country, days])

  const s = gsc?.summary
  const series = (gsc?.series || []) as SeriesPoint[]
  const topCountries = (gsc?.top_countries || []) as { country: string; impressions: number; clicks: number }[]
  const hasGscData = s && s.impressions > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Onboarding + Config (existing) */}
      <OnboardingChecklist config={gsc?.config} hasData={hasGscData} />
      <ConfigBar config={gsc?.config} />

      {loading && <Text>Cargando data de todas las fuentes…</Text>}

      {!loading && (
        <>
          {/* ─── LAYER 1: AWARENESS (GSC) ───────────────────────────────── */}
          <FunnelLayer
            emoji="📢" title="Awareness" subtitle={`Tráfico orgánico de Google · últimos ${days}d`}
            source="GSC"
          >
            {!hasGscData ? (
              <SmallEmpty msg="GSC aún sin datos. Google puede tardar días/semanas en indexar un sitio nuevo." />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
                  <KpiCard label={`Impresiones ${days}d`} value={fmtNum(s.impressions)} delta={fmtDelta(s.delta_impressions_pct)} />
                  <KpiCard label={`Clics ${days}d`} value={fmtNum(s.clicks)} delta={fmtDelta(s.delta_clicks_pct)} />
                  <KpiCard label="CTR" value={fmtPct(s.ctr)} delta={fmtDelta(s.delta_ctr_pct)} />
                  <KpiCard label="Pos. media" value={fmtPos(s.position)} delta={fmtDelta(s.delta_position_pct, true)} />
                </div>
                <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 8 }}>Clics diarios</Text>
                  <Sparkline series={series} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                  <div>
                    <Text size="small" style={{ fontWeight: 600, marginBottom: 6 }}>Top 10 queries</Text>
                    {queries.length > 0 ? (
                      <QueriesTable rows={queries.slice(0, 10)} />
                    ) : (
                      <SmallEmpty msg="GSC anonimiza queries cuando el volumen es bajo." />
                    )}
                  </div>
                  <div>
                    <Text size="small" style={{ fontWeight: 600, marginBottom: 6 }}>Tráfico por país</Text>
                    <CountriesList rows={topCountries} />
                  </div>
                </div>
                <SeeMoreLink label="Ver Keywords + Páginas completos" />
              </>
            )}
          </FunnelLayer>

          {/* ─── LAYER 2: ENGAGEMENT (Umami) ────────────────────────────── */}
          <FunnelLayer
            emoji="👁" title="Engagement" subtitle="Comportamiento en el sitio · self-hosted"
            source="Umami"
            rightSlot={
              umami?.configured && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 14 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
                  <strong style={{ fontSize: 12 }}>{umami?.active_visitors || 0} activos ahora</strong>
                </div>
              )
            }
          >
            {!umami?.configured || !umami?.stats?.pageviews ? (
              <SmallEmpty msg="Umami sin datos aún. Visita el sitio y vuelve." />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
                  <KpiCard label="Pageviews" value={fmtNum(umami.stats.pageviews.value)} />
                  <KpiCard label="Visitantes" value={fmtNum(umami.stats.visitors.value)} />
                  <KpiCard label="Sesiones" value={fmtNum(umami.stats.visits.value)} />
                  <KpiCard label="Bounce" value={`${umami.stats.visits.value > 0 ? Math.round((umami.stats.bounces.value / umami.stats.visits.value) * 100) : 0}%`} />
                  <KpiCard label="Dur. media" value={`${Math.round(umami.stats.visits.value > 0 ? umami.stats.totaltime.value / umami.stats.visits.value : 0)}s`} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <Text size="small" style={{ fontWeight: 600, marginBottom: 6 }}>Top páginas</Text>
                    <HorizontalBarList items={(umami.top_pages || []).slice(0, 6)} formatLabel={(x: string) => x || "/"} />
                  </div>
                  <div>
                    <Text size="small" style={{ fontWeight: 600, marginBottom: 6 }}>Top referrers</Text>
                    <HorizontalBarList items={(umami.top_referrers || []).slice(0, 6)} formatLabel={(x: string) => x || "(directo)"} />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <a href="https://analytics.enrola.shop" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--color-ui-fg-interactive, #ff7a00)", textDecoration: "none" }}>
                    Abrir Umami completo ↗
                  </a>
                  {" · "}
                  <a href="https://clarity.microsoft.com/projects/view/wfp9s5wh5i/dashboard" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--color-ui-fg-interactive, #ff7a00)", textDecoration: "none" }}>
                    Ver heatmaps en Clarity ↗
                  </a>
                </div>
              </>
            )}
          </FunnelLayer>

          {/* ─── LAYER 3: CONVERSION (PostHog) ──────────────────────────── */}
          <FunnelLayer
            emoji="🎯" title="Conversion" subtitle="Eventos de negocio · identificados"
            source="PostHog"
          >
            {!posthog?.configured ? (
              <SmallEmpty msg="PostHog no configurado." />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
                  <KpiCard label="Eventos 7d" value={fmtNum(posthog.summary.total_events_7d)} />
                  <KpiCard label="Usuarios únicos 7d" value={fmtNum(posthog.summary.unique_users_7d)} />
                  <KpiCard label="Personas totales" value={fmtNum(posthog.summary.persons_total)} />
                  <KpiCard label="Flags activas" value={`${posthog.summary.flags_active}/${posthog.summary.flags_count}`} />
                  <KpiCard label="Experimentos" value={fmtNum(posthog.summary.experiments_count)} />
                </div>
                {posthog.top_events && posthog.top_events.length > 0 ? (
                  <div>
                    <Text size="small" style={{ fontWeight: 600, marginBottom: 6 }}>Top eventos (7d)</Text>
                    <HorizontalBarList
                      items={posthog.top_events.map((e: any) => ({ x: e.event, y: e.count }))}
                      formatLabel={(x: string) => x}
                    />
                  </div>
                ) : (
                  <SmallEmpty msg="Sin eventos aún (lag de ingestión de ClickHouse en proyectos nuevos). Persons sí se crean en tiempo real." />
                )}
                <div style={{ marginTop: 10 }}>
                  <a href={`https://us.posthog.com/project/393363/insights`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--color-ui-fg-interactive, #ff7a00)", textDecoration: "none" }}>
                    Crear funnels en PostHog ↗
                  </a>
                  {" · "}
                  <a href={`https://us.posthog.com/project/393363/surveys`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--color-ui-fg-interactive, #ff7a00)", textDecoration: "none" }}>
                    Configurar NPS ↗
                  </a>
                </div>
              </>
            )}
          </FunnelLayer>

          {/* ─── LAYER 4: REVENUE (GA4 + Medusa) ──────────────────────── */}
          <FunnelLayer
            emoji="💰" title="Revenue" subtitle="Atribución + orders reales + snapshots mensuales"
            source="GA4 + Medusa"
          >
            {attribution && <AttributionBlock data={attribution} days={days} />}
            <div style={{ marginTop: 14 }}>
              <MonthlySnapshots />
            </div>
          </FunnelLayer>

          {/* ─── LAYER 5: HEALTH ──────────────────────────────────────── */}
          <FunnelLayer
            emoji="🩺" title="Health" subtitle="Performance + alertas + errores"
            source="CrUX + PostHog + internal"
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <HealthBadge label="CWV Phone" data={technical?.cwv?.by_device?.PHONE} />
              <HealthBadge label="CWV Desktop" data={technical?.cwv?.by_device?.DESKTOP} />
              <AlertBadge label="Alertas sin atender" counts={technical?.alerts_unacked || {}} />
              <SitemapBadge sitemap={technical?.sitemap} />
              <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", padding: 12, borderRadius: 10 }}>
                <Text size="xsmall" className="text-ui-fg-muted">Errores JS últimos 7d</Text>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {posthog?.configured ? "—" : <span style={{ color: "#888", fontSize: 12 }}>no config</span>}
                </div>
                <Text size="xsmall" className="text-ui-fg-muted">(PostHog $exception)</Text>
              </div>
            </div>
            <SeeMoreLink label="Ver detalle en Salud Técnica →" />
          </FunnelLayer>

          {/* ─── Competitors ─────────────────────────────────────────────── */}
          <div style={{ paddingTop: 10, borderTop: "1px solid var(--color-ui-border-base, #2e2e32)" }}>
            <Heading level="h3" style={{ marginBottom: 12 }}>Competidores monitoreados ({competitors.length})</Heading>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {competitors.map((c) => (
                <div key={c.id} style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", padding: 10, borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>{c.name}</strong>
                    <Badge color={c.threat === "high" ? "red" : c.threat === "medium" ? "orange" : c.threat === "watch" ? "blue" : "grey"}>{c.threat}</Badge>
                  </div>
                  <Text size="xsmall" className="text-ui-fg-muted">{c.domain || c.instagram || "—"}</Text>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Funnel layer wrapper ────────────────────────────────────────────────────
function FunnelLayer({ emoji, title, subtitle, source, rightSlot, children }: {
  emoji: string; title: string; subtitle: string; source: string
  rightSlot?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ background: "var(--color-ui-bg-subtle)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div>
          <Heading level="h3" style={{ marginBottom: 2 }}>
            <span style={{ fontSize: 18 }}>{emoji}</span> {title}
          </Heading>
          <Text size="xsmall" className="text-ui-fg-muted">
            {subtitle} · fuente: <code style={{ fontSize: 11 }}>{source}</code>
          </Text>
        </div>
        {rightSlot}
      </div>
      {children}
    </div>
  )
}

function SeeMoreLink({ label }: { label: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <Text size="xsmall" className="text-ui-fg-muted">{label}</Text>
    </div>
  )
}

// ─── Pages tab ─────────────────────────────────────────────────────────────────
function PagesTab({ country, days }: { country: string; days: number }) {
  const [rows, setRows] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<string>("clicks")

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/admin/seo/pages?country=${country}&days=${days}&sort=${sort}&limit=100`, { credentials: "include" })
      .then(r => r.json()).then(d => setRows(d.pages || [])).finally(() => setLoading(false))
  }, [country, days, sort])

  if (loading) return <Text>Cargando…</Text>
  if (rows.length === 0) return <EmptyState message="Sin datos. Activa SEO_SYNC_ENABLED y corre el backfill." />

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Heading level="h3">Páginas ({rows.length})</Heading>
        <Select value={sort} onValueChange={setSort}>
          <Select.Trigger style={{ width: 180 }}><Select.Value /></Select.Trigger>
          <Select.Content>
            <Select.Item value="clicks">Clics</Select.Item>
            <Select.Item value="impressions">Impresiones</Select.Item>
            <Select.Item value="position">Posición</Select.Item>
            <Select.Item value="ctr">CTR</Select.Item>
          </Select.Content>
        </Select>
      </div>
      <div style={{ border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--color-ui-bg-subtle)" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>URL</th>
              <th style={{ textAlign: "right", padding: 10, width: 90 }}>Impr.</th>
              <th style={{ textAlign: "right", padding: 10, width: 80 }}>Clics</th>
              <th style={{ textAlign: "right", padding: 10, width: 80 }}>CTR</th>
              <th style={{ textAlign: "right", padding: 10, width: 80 }}>Pos.</th>
              <th style={{ textAlign: "right", padding: 10, width: 60 }}>Q</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.page} style={{ borderTop: "1px solid var(--color-ui-border-base, #2e2e32)", background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                <td style={{ padding: 10, maxWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 12 }} title={r.page}>
                  <a href={r.page} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{r.page.replace(/^https?:\/\/[^/]+/, "") || "/"}</a>
                </td>
                <td style={{ textAlign: "right", padding: 10 }}>{fmtNum(r.impressions)}</td>
                <td style={{ textAlign: "right", padding: 10, fontWeight: 600 }}>{fmtNum(r.clicks)}</td>
                <td style={{ textAlign: "right", padding: 10 }}>{fmtPct(r.ctr, 1)}</td>
                <td style={{ textAlign: "right", padding: 10 }}>{fmtPos(r.position)}</td>
                <td style={{ textAlign: "right", padding: 10, color: "#888" }}>{r.unique_queries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Keywords (3 sub-tabs) ─────────────────────────────────────────────────────
type KwSubTab = "research" | "tracker" | "suggestions"

function KeywordsTab() {
  const [sub, setSub] = useState<KwSubTab>("tracker")

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--color-ui-border-base, #2e2e32)" }}>
        {[
          { id: "tracker" as const, label: "Tracker" },
          { id: "research" as const, label: "Research" },
          { id: "suggestions" as const, label: "Sugerencias VE" },
        ].map((t) => {
          const active = sub === t.id
          return (
            <button key={t.id} onClick={() => setSub(t.id)} style={{
              padding: "8px 14px", background: "transparent", border: "none",
              borderBottom: active ? "2px solid var(--color-ui-fg-interactive, #ff7a00)" : "2px solid transparent",
              color: active ? "var(--color-ui-fg-base, #fff)" : "var(--color-ui-fg-muted, #a0a0a0)",
              cursor: "pointer", fontWeight: active ? 600 : 400, fontSize: 13,
            }}>{t.label}</button>
          )
        })}
      </div>
      {sub === "tracker" && <KwTrackerSubTab />}
      {sub === "research" && <KwResearchSubTab />}
      {sub === "suggestions" && <KwSuggestionsSubTab />}
    </div>
  )
}

type TrackedKw = {
  id: string
  keyword: string
  country: string
  device: string
  source: string
  notes?: string | null
  impressions?: number
  clicks?: number
  position?: number | null
  action?: { tag: string; label: string; color: string }
}

function KwTrackerSubTab() {
  const [rows, setRows] = useState<TrackedKw[]>([])
  const [loading, setLoading] = useState(true)
  const [newKw, setNewKw] = useState("")
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const d = await fetch(`${API}/admin/seo/keywords`, { credentials: "include" }).then(r => r.json())
      setRows(d.keywords || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function add() {
    const k = newKw.trim().toLowerCase()
    if (!k) return
    setAdding(true); setMsg(null)
    try {
      const res = await fetch(`${API}/admin/seo/keywords`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: k, country: "ve", device: "mobile", source: "manual" }),
      })
      if (res.ok) {
        setNewKw(""); setMsg("✅ Añadida al tracker"); load()
      } else if (res.status === 409) {
        setMsg("⚠️ Ya está en el tracker")
      } else {
        const e = await res.json().catch(() => ({}))
        setMsg(`❌ ${e.error || "error"}`)
      }
    } finally { setAdding(false); setTimeout(() => setMsg(null), 3000) }
  }

  async function remove(id: string) {
    if (!confirm("¿Quitar del tracker?")) return
    await fetch(`${API}/admin/seo/keywords/${id}`, { method: "DELETE", credentials: "include" })
    load()
  }

  return (
    <div>
      {/* Add new */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <input
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add() }}
          placeholder="Nueva keyword a trackear…"
          style={{ flex: 1, padding: "8px 12px", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", fontFamily: "monospace" }}
        />
        <button
          onClick={add} disabled={adding || !newKw.trim()}
          style={{ padding: "8px 16px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
        >{adding ? "…" : "Añadir"}</button>
        {msg && <span style={{ fontSize: 12 }}>{msg}</span>}
      </div>

      <Heading level="h3" style={{ marginBottom: 8 }}>Tracker ({rows.length})</Heading>
      {loading ? <Text>Cargando…</Text> : rows.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">Sin keywords. Añade una arriba o ve a "Sugerencias VE".</Text>
      ) : (
        <div style={{ border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--color-ui-bg-subtle)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 10 }}>Keyword</th>
                <th style={{ textAlign: "left", padding: 10, width: 220 }}>Estado / acción</th>
                <th style={{ textAlign: "right", padding: 10, width: 70 }}>Pos.</th>
                <th style={{ textAlign: "right", padding: 10, width: 80 }}>Impr.28d</th>
                <th style={{ textAlign: "right", padding: 10, width: 70 }}>Clics</th>
                <th style={{ textAlign: "right", padding: 10, width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--color-ui-border-base, #2e2e32)", background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: 10, fontFamily: "monospace" }}>
                    {r.keyword}
                    <Badge color="grey" style={{ marginLeft: 8, fontSize: 9 }}>{r.source}</Badge>
                  </td>
                  <td style={{ padding: 10 }}>
                    {r.action && <Badge color={r.action.color as any}>{r.action.label}</Badge>}
                  </td>
                  <td style={{ textAlign: "right", padding: 10 }}>{fmtPos(r.position)}</td>
                  <td style={{ textAlign: "right", padding: 10 }}>{fmtNum(r.impressions)}</td>
                  <td style={{ textAlign: "right", padding: 10, fontWeight: 600 }}>{fmtNum(r.clicks)}</td>
                  <td style={{ textAlign: "right", padding: 10 }}>
                    <button onClick={() => remove(r.id)} style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer" }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KwResearchSubTab() {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function search() {
    const kw = q.trim().toLowerCase()
    if (!kw) return
    setLoading(true); setData(null)
    try {
      const d = await fetch(`${API}/admin/seo/keywords/research?q=${encodeURIComponent(kw)}&country=VE`, { credentials: "include" }).then(r => r.json())
      setData(d)
    } finally { setLoading(false) }
  }

  async function addToTracker(keyword: string) {
    const res = await fetch(`${API}/admin/seo/keywords`, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyword, country: "ve", device: "mobile", source: "research" }),
    })
    if (res.ok) setMsg(`✅ "${keyword}" añadida al tracker`)
    else if (res.status === 409) setMsg(`⚠️ "${keyword}" ya está en el tracker`)
    else setMsg("❌ error")
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search() }}
          placeholder="Buscar keyword (ej: rolling paper venezuela)"
          style={{ flex: 1, padding: "10px 14px", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, color: "inherit", fontFamily: "monospace", fontSize: 14 }}
        />
        <button
          onClick={search} disabled={loading || !q.trim()}
          style={{ padding: "10px 20px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
        >{loading ? "…" : "Investigar"}</button>
      </div>
      {msg && <div style={{ marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      {!data && !loading && (
        <Text size="small" className="text-ui-fg-muted">
          Ingresa una keyword para ver: sugerencias relacionadas (Google Autocomplete), si ya rankeamos para ella en GSC, y la clasificación de intent.
        </Text>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Main keyword info */}
          <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <Heading level="h3" style={{ marginBottom: 4 }}>{data.keyword}</Heading>
                <div style={{ display: "flex", gap: 6 }}>
                  <Badge color="blue">{data.intent}</Badge>
                  {data.local_ve && <Badge color="green">🇻🇪 Local VE</Badge>}
                  {data.cached_at && <span style={{ fontSize: 11, color: "#888" }}>cache · {new Date(data.cached_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <button onClick={() => addToTracker(data.keyword)}
                style={{ padding: "8px 14px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 }}
              >+ Trackear</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
              <Stat label="¿Ya rankeamos?" value={data.already_ranking.yes ? "Sí" : "No"} color={data.already_ranking.yes ? "#10b981" : "#888"} />
              <Stat label="Impresiones 28d" value={fmtNum(data.already_ranking.impressions_28d)} />
              <Stat label="Clics 28d" value={fmtNum(data.already_ranking.clicks_28d)} />
              <Stat label="Posición media" value={fmtPos(data.already_ranking.avg_position)} />
            </div>
            {data.already_ranking.best_url && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>
                URL con más clics: <a href={data.already_ranking.best_url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{data.already_ranking.best_url.replace(/^https?:\/\/[^/]+/, "")}</a>
              </div>
            )}
          </div>

          {/* Related */}
          <div>
            <Heading level="h3" style={{ marginBottom: 8 }}>Relacionadas ({data.related.length})</Heading>
            <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>
              Sugerencias de Google Autocomplete (VE, español). Ordenadas por popularidad relativa.
            </Text>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
              {data.related.map((r: any, i: number) => (
                <div key={r.query} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>{r.query}</span>
                  <button onClick={() => addToTracker(r.query)}
                    style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "inherit" }}
                  >+</button>
                </div>
              ))}
              {data.related.length === 0 && <Text size="small" className="text-ui-fg-muted">Sin sugerencias relacionadas.</Text>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KwSuggestionsSubTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/admin/seo/keywords/suggestions`, { credentials: "include" })
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  async function addToTracker(keyword: string) {
    const res = await fetch(`${API}/admin/seo/keywords`, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyword, country: "ve", device: "mobile", source: "suggestion_ve" }),
    })
    if (res.ok) setMsg(`✅ "${keyword}" añadida`)
    else if (res.status === 409) setMsg(`⚠️ ya estaba`)
    else setMsg("❌ error")
    setTimeout(() => setMsg(null), 2500)
  }

  if (loading) return <Text>Cargando sugerencias…</Text>
  if (!data) return <Text>Error cargando.</Text>

  const groups: Array<{ key: string; title: string; emoji: string; items: any[]; desc: string }> = [
    { key: "striking_distance", title: "Striking distance", emoji: "🔥", items: data.by_category.striking_distance || [], desc: "Pos 11-20 con impresiones — un empujón y entran al top 10." },
    { key: "local_intent", title: "Local Venezuela", emoji: "🇻🇪", items: data.by_category.local_intent || [], desc: "Queries con intent local — el tráfico que más convierte." },
    { key: "brand_gap", title: "Marcas ausentes", emoji: "🎯", items: data.by_category.brand_gap || [], desc: "Del análisis competitivo 2026-04-21: marcas premium sin cobertura en VE." },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {msg && <div style={{ padding: 10, background: "rgba(255, 122, 0, 0.1)", borderRadius: 6, fontSize: 13 }}>{msg}</div>}

      {data.total === 0 && (
        <EmptyState message="Aún no hay sugerencias dinámicas. A medida que GSC acumule datos, aparecerán queries en striking distance. Las sugerencias de marcas (brand gap) ya están abajo." />
      )}

      {groups.map((g) => g.items.length > 0 && (
        <div key={g.key}>
          <div style={{ marginBottom: 4 }}>
            <Heading level="h3">{g.emoji} {g.title} <Badge color="grey" style={{ marginLeft: 6 }}>{g.items.length}</Badge></Heading>
          </div>
          <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 12 }}>{g.desc}</Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((s: any, i: number) => (
              <div key={s.keyword + i} style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <code style={{ fontSize: 14, fontWeight: 600 }}>{s.keyword}</code>
                      <Badge color={s.priority === "high" ? "red" : s.priority === "medium" ? "orange" : "grey"}>{s.priority}</Badge>
                      {s.position != null && <span style={{ fontSize: 11, color: "#888" }}>pos {Number(s.position).toFixed(1)}</span>}
                      {s.impressions_28d != null && <span style={{ fontSize: 11, color: "#888" }}>{s.impressions_28d} impr/28d</span>}
                    </div>
                    <Text size="small" style={{ marginBottom: 6 }}>{s.reason}</Text>
                    <Text size="small" className="text-ui-fg-muted"><strong>Acción:</strong> {s.action}</Text>
                  </div>
                  <button onClick={() => addToTracker(s.keyword)}
                    style={{ padding: "6px 12px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, flexShrink: 0 }}
                  >+ Trackear</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <Text size="xsmall" className="text-ui-fg-muted" style={{ display: "block", marginBottom: 2 }}>{label}</Text>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "inherit" }}>{value}</div>
    </div>
  )
}

// ─── Site Analytics (Umami) ───────────────────────────────────────────────────
function UmamiTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(28)
  const [active, setActive] = useState<number>(0)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/admin/seo/umami?days=${days}`, { credentials: "include" })
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [days])

  // Poll active visitors every 30s
  useEffect(() => {
    async function tick() {
      try {
        const r = await fetch(`${API}/admin/seo/umami/active`, { credentials: "include" }).then(r => r.json())
        setActive(r.visitors || 0)
      } catch {}
    }
    tick()
    const i = setInterval(tick, 30000)
    return () => clearInterval(i)
  }, [])

  if (loading) return <Text>Cargando…</Text>
  if (!data) return <Text>Error cargando.</Text>
  if (!data.configured) {
    return <EmptyState message={data.message || "Umami no configurado."} />
  }

  const s = data.stats || {}
  const pv = s.pageviews || { value: 0, prev: 0 }
  const v = s.visitors || { value: 0, prev: 0 }
  const vs = s.visits || { value: 0, prev: 0 }
  const b = s.bounces || { value: 0, prev: 0 }
  const tt = s.totaltime || { value: 0, prev: 0 }
  const bounceRate = vs.value > 0 ? (b.value / vs.value) * 100 : 0
  const avgSec = vs.value > 0 ? tt.value / vs.value : 0
  const avgMin = Math.floor(avgSec / 60)
  const avgS = Math.round(avgSec % 60)

  function delta(curr: number, prev: number): { txt: string; color: string } | null {
    if (!prev) return null
    const pct = ((curr - prev) / prev) * 100
    return { txt: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, color: pct >= 0 ? "#10b981" : "#ef4444" }
  }

  const series = (data.series?.pageviews || []) as Array<{ x: string; y: number }>
  const maxY = Math.max(1, ...series.map((p) => p.y))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header with live pulse + link to Umami */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 20 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} />
            <strong style={{ fontSize: 14 }}>{active} activos ahora</strong>
          </div>
          <Text size="small" className="text-ui-fg-muted">Datos self-hosted (Umami). Privacy-friendly, sin cookies.</Text>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{ padding: "6px 10px", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", fontSize: 12 }}>
            <option value="1">Últimas 24h</option>
            <option value="7">Últimos 7d</option>
            <option value="28">Últimos 28d</option>
            <option value="90">Últimos 90d</option>
          </select>
          <a href={data.umami_url} target="_blank" rel="noopener noreferrer"
            style={{ padding: "6px 12px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
            Abrir Umami ↗
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <KpiCard label={`Pageviews ${days}d`} value={fmtNum(pv.value)} delta={delta(pv.value, pv.prev) ? { text: delta(pv.value, pv.prev)!.txt + " vs anterior", color: delta(pv.value, pv.prev)!.color } : undefined} />
        <KpiCard label="Visitantes únicos" value={fmtNum(v.value)} delta={delta(v.value, v.prev) ? { text: delta(v.value, v.prev)!.txt, color: delta(v.value, v.prev)!.color } : undefined} />
        <KpiCard label="Sesiones" value={fmtNum(vs.value)} delta={delta(vs.value, vs.prev) ? { text: delta(vs.value, vs.prev)!.txt, color: delta(vs.value, vs.prev)!.color } : undefined} />
        <KpiCard label="Bounce rate" value={`${bounceRate.toFixed(0)}%`} />
        <KpiCard label="Duración media" value={`${avgMin}m ${avgS}s`} />
      </div>

      {/* Sparkline */}
      {series.length > 0 && (
        <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 12, padding: 16 }}>
          <Heading level="h3" style={{ marginBottom: 12 }}>Pageviews · últimos {days}d</Heading>
          <svg viewBox={`0 0 800 120`} preserveAspectRatio="none" style={{ width: "100%", height: 120 }}>
            <polyline
              fill="none"
              stroke="#ff7a00"
              strokeWidth="2"
              points={series.map((p, i) => {
                const x = 20 + (i / Math.max(1, series.length - 1)) * 760
                const y = 100 - (p.y / maxY) * 80
                return `${x.toFixed(1)},${y.toFixed(1)}`
              }).join(" ")}
            />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", marginTop: 4 }}>
            <span>{series[0]?.x?.slice(0, 10)}</span>
            <span>máx: {maxY}</span>
            <span>{series[series.length - 1]?.x?.slice(0, 10)}</span>
          </div>
        </div>
      )}

      {/* 2-column grid: top pages + top referrers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <Heading level="h3" style={{ marginBottom: 8 }}>Top páginas</Heading>
          <HorizontalBarList items={data.top_pages} formatLabel={(x: string) => x || "/"} />
        </div>
        <div>
          <Heading level="h3" style={{ marginBottom: 8 }}>Top referrers</Heading>
          <HorizontalBarList items={data.top_referrers} formatLabel={(x: string) => x || "(directo)"} />
        </div>
      </div>

      {/* 3-column: country, device, browser */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div>
          <Heading level="h3" style={{ marginBottom: 8 }}>Países</Heading>
          <HorizontalBarList items={data.top_countries?.slice(0, 8)} formatLabel={(x: string) => x?.toUpperCase() || "—"} />
        </div>
        <div>
          <Heading level="h3" style={{ marginBottom: 8 }}>Dispositivos</Heading>
          <HorizontalBarList items={data.top_devices?.slice(0, 8)} formatLabel={(x: string) => x || "—"} />
        </div>
        <div>
          <Heading level="h3" style={{ marginBottom: 8 }}>Navegadores</Heading>
          <HorizontalBarList items={data.top_browsers?.slice(0, 8)} formatLabel={(x: string) => x || "—"} />
        </div>
      </div>
    </div>
  )
}

function HorizontalBarList({ items, formatLabel }: { items: any[]; formatLabel: (x: string) => string }) {
  if (!items || items.length === 0) return <Text size="small" className="text-ui-fg-muted">Sin datos todavía.</Text>
  const max = Math.max(1, ...items.map((i: any) => Number(i.y || 0)))
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item: any, i: number) => {
        const val = Number(item.y || 0)
        const pct = (val / max) * 100
        return (
          <div key={item.x + i} style={{ position: "relative", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 4, padding: "6px 10px", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`, background: "rgba(255, 122, 0, 0.12)" }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", fontSize: 11, overflow: "hidden", gap: 8 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }} title={formatLabel(item.x)}>
                {formatLabel(item.x)}
              </span>
              <strong style={{ flexShrink: 0 }}>{fmtNum(val)}</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Venezuela (Batch 7) ──────────────────────────────────────────────────────
function VenezuelaTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(28)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/admin/seo/venezuela?days=${days}`, { credentials: "include" })
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [days])

  if (loading) return <Text>Cargando…</Text>
  if (!data) return <Text>Error cargando.</Text>

  const ve = data.ve || {}
  const row = data.rest_of_world || {}
  const totalImp = (ve.impressions || 0) + (row.impressions || 0)
  const vePct = totalImp > 0 ? (ve.impressions / totalImp) * 100 : 0
  const maxWeekday = Math.max(1, ...data.weekday_pattern.map((d: any) => d.impressions))

  function serpCheckUrl(query: string, site?: string): string {
    const q = site ? `site:${site} ${query}` : query
    return `https://www.google.com/search?q=${encodeURIComponent(q)}&gl=ve&hl=es`
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Intro + period selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text size="small" className="text-ui-fg-muted">
          Vista focalizada en Venezuela — el mercado principal. Datos filtrados a <code>country = ven</code>.
        </Text>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}
          style={{ padding: "6px 10px", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", fontSize: 12 }}>
          <option value="7">Últimos 7d</option>
          <option value="28">Últimos 28d</option>
          <option value="90">Últimos 90d</option>
        </select>
      </div>

      {/* VE vs rest of world */}
      <div>
        <Heading level="h3" style={{ marginBottom: 8 }}>🇻🇪 Performance Venezuela vs. resto</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "var(--color-ui-bg-base)", border: "2px solid rgba(255, 122, 0, 0.35)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <Text size="small" style={{ fontWeight: 600 }}>🇻🇪 Venezuela</Text>
              <Badge color="orange">{vePct.toFixed(0)}% del tráfico</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <Stat label="Impr." value={fmtNum(ve.impressions)} />
              <Stat label="Clics" value={fmtNum(ve.clicks)} />
              <Stat label="CTR" value={fmtPct(ve.ctr, 1)} />
              <Stat label="Pos." value={fmtPos(ve.position)} />
            </div>
          </div>
          <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 10, padding: 14 }}>
            <div style={{ marginBottom: 10 }}>
              <Text size="small" style={{ fontWeight: 600 }}>🌎 Resto del mundo</Text>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              <Stat label="Impr." value={fmtNum(row.impressions)} />
              <Stat label="Clics" value={fmtNum(row.clicks)} />
              <Stat label="CTR" value={fmtPct(row.ctr, 1)} />
            </div>
            {row.ctr > 0 && ve.ctr > 0 && (
              <Text size="xsmall" className="text-ui-fg-muted" style={{ marginTop: 8 }}>
                CTR VE es {((ve.ctr / row.ctr - 1) * 100).toFixed(0)}% {ve.ctr > row.ctr ? "mejor" : "peor"} que el resto.
              </Text>
            )}
          </div>
        </div>
      </div>

      {/* CTR mismatch */}
      {(data.ctr_mismatch_vs_global || []).length > 0 && (
        <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: 14 }}>
          <Heading level="h3" style={{ marginBottom: 4 }}>⚠️ Queries con CTR VE bajo vs global</Heading>
          <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>
            En estas queries el CTR en Venezuela es significativamente más bajo que en el resto del mundo. Señal de que meta title/description no está optimizada para la audiencia local (falta mención de €/Bs, envío Caracas, etc.).
          </Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.ctr_mismatch_vs_global.map((m: any) => (
              <div key={m.query} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--color-ui-bg-base)", borderRadius: 6, fontSize: 12 }}>
                <code>{m.query}</code>
                <span>VE: <strong>{fmtPct(m.ve_ctr, 1)}</strong> vs global: {fmtPct(m.global_ctr, 1)} · {m.ve_impressions} impr</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekday seasonality */}
      <div>
        <Heading level="h3" style={{ marginBottom: 4 }}>📅 Estacionalidad semanal VE</Heading>
        <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>
          Impresiones orgánicas por día de la semana (últimos {days}d). Identifica días con más demanda para priorizar publicaciones/promos.
        </Text>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {data.weekday_pattern.map((d: any) => (
            <div key={d.dow} style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, padding: "10px 6px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${(d.impressions / maxWeekday) * 100}%`, background: "rgba(255, 122, 0, 0.15)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtNum(d.impressions)}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{fmtNum(d.clicks)} clics</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top VE queries */}
      <div>
        <Heading level="h3" style={{ marginBottom: 4 }}>🔝 Top queries en VE</Heading>
        {data.top_queries_ve.length === 0 ? (
          <SmallEmpty msg="GSC todavía no tiene suficiente volumen de queries específicas VE (anonimizadas). Verás datos aquí cuando crezca el tráfico." />
        ) : (
          <MiniTable
            headers={["Query", "Impr.", "Clics", "CTR", "Pos."]}
            rows={data.top_queries_ve.map((q: any) => [
              <code style={{ fontSize: 12 }}>{q.query}</code>,
              fmtNum(q.impressions),
              <strong>{fmtNum(q.clicks)}</strong>,
              fmtPct(q.ctr, 1),
              fmtPos(q.position),
            ])}
          />
        )}
      </div>

      {/* Geo queries */}
      <div>
        <Heading level="h3" style={{ marginBottom: 4 }}>📍 Geo / local intent ({data.geo_queries.length})</Heading>
        <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>
          Queries con intent local detectadas por regex (venezuela, caracas, bolivares, "cerca de mí", etc.). Máxima prioridad — este tráfico convierte más.
        </Text>
        {data.geo_queries.length === 0 ? (
          <SmallEmpty msg="Sin geo queries detectadas todavía. Crear contenido con menciones locales ayuda a atraerlas." />
        ) : (
          <MiniTable
            headers={["Query", "Impr.", "Clics", "Pos."]}
            rows={data.geo_queries.map((q: any) => [
              <code style={{ fontSize: 12 }}>{q.query}</code>,
              fmtNum(q.impressions),
              <strong>{fmtNum(q.clicks)}</strong>,
              fmtPos(q.position),
            ])}
          />
        )}
      </div>

      {/* Tracked keywords performance */}
      {data.tracked_keywords_ve.length > 0 && (
        <div>
          <Heading level="h3" style={{ marginBottom: 4 }}>🎯 Tus keywords trackeadas (performance VE)</Heading>
          <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>
            Cómo están performando tus keywords starter/manuales específicamente con tráfico venezolano.
          </Text>
          <MiniTable
            headers={["Keyword", "Source", "Impr.", "Clics", "Pos."]}
            rows={data.tracked_keywords_ve.map((k: any) => [
              <code style={{ fontSize: 12 }}>{k.keyword}</code>,
              <span style={{ fontSize: 10, color: "#888" }}>{k.source}</span>,
              fmtNum(k.impressions),
              fmtNum(k.clicks),
              k.position != null ? fmtPos(k.position) : <span style={{ color: "#888" }}>sin data</span>,
            ])}
          />
        </div>
      )}

      {/* Competitor SERP check */}
      <div>
        <Heading level="h3" style={{ marginBottom: 4 }}>🥊 Check SERP vs competidores</Heading>
        <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>
          Abre Google VE (gl=ve, hl=es) para ver los SERPs reales. Cada botón "site:" verifica si un competidor tiene contenido específico para una keyword (detección barata de gaps).
        </Text>
        <div style={{ border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "var(--color-ui-bg-subtle)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>Competidor</th>
                <th style={{ textAlign: "left", padding: 8, width: 120 }}>Amenaza</th>
                <th style={{ textAlign: "left", padding: 8 }}>Dominio</th>
                <th style={{ textAlign: "right", padding: 8, width: 240 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.competitors.map((c: any, i: number) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--color-ui-border-base, #2e2e32)", background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: 8 }}><Badge color={c.threat === "high" ? "red" : c.threat === "medium" ? "orange" : c.threat === "watch" ? "blue" : "grey"}>{c.threat}</Badge></td>
                  <td style={{ padding: 8, fontFamily: "monospace", color: "#888" }}>{c.domain}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, padding: "4px 8px", background: "transparent", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 4, color: "inherit", textDecoration: "none", marginRight: 4 }}
                    >web</a>
                    <a href={serpCheckUrl("", c.domain) + "+rolling+paper"} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, padding: "4px 8px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", borderRadius: 4, textDecoration: "none" }}
                      title={`Busca site:${c.domain} rolling paper en Google VE`}
                    >check SERP</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Opportunities (Batch 4) ───────────────────────────────────────────────────
function OpportunitiesTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/admin/seo/opportunities`, { credentials: "include" })
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <Text>Cargando señales…</Text>
  if (!data) return <Text>Error cargando.</Text>

  const emerging = data.emerging_queries || []
  const entered = data.pages_entered_top10 || []
  const lost = data.pages_lost_top10 || []
  const brand = data.brand_split || { brand: null, non_brand: null }
  const cannibal = data.cannibalization || []
  const striking = data.striking_distance || []

  const anyData = emerging.length + entered.length + lost.length + cannibal.length + striking.length > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {!anyData && (brand.brand == null && brand.non_brand == null) && (
        <EmptyState message="Sin datos suficientes todavía. Los detectores necesitan al menos 7-14 días de datos de GSC para encontrar señales significativas." />
      )}

      {/* Brand vs Non-Brand */}
      {(brand.brand || brand.non_brand) && (
        <div>
          <Heading level="h3" style={{ marginBottom: 4 }}>🏷️ Brand vs. Non-Brand (últimos 28d)</Heading>
          <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 12 }}>
            Queries que mencionan la marca ("enrola") vs. tráfico genérico. Un split saludable apunta a {">"}40% non-brand (señal de contenido atrayendo demanda nueva).
          </Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <BrandCard label="🌱 Non-brand" data={brand.non_brand} good={(brand.non_brand?.pct_of_impressions || 0) >= 40} />
            <BrandCard label="🏷️ Brand" data={brand.brand} good={true} />
          </div>
        </div>
      )}

      {/* Emerging queries */}
      <OpportunitySection
        emoji="✨" title="Queries emergentes" count={emerging.length}
        desc="Nuevas últimos 7d (sin actividad en los 14d previos). Señal temprana de contenido que empieza a resonar."
      >
        {emerging.length === 0 ? <SmallEmpty msg="Sin queries emergentes." /> : (
          <MiniTable
            headers={["Query", "Impr.", "Clics", "Pos.", "Visto"]}
            rows={emerging.map((e: any) => [
              <code style={{ fontSize: 12 }}>{e.query}</code>,
              fmtNum(e.impressions),
              <strong>{fmtNum(e.clicks)}</strong>,
              fmtPos(e.avg_position),
              <span style={{ color: "#888", fontSize: 11 }}>{String(e.first_seen).slice(5, 10)}</span>,
            ])}
          />
        )}
      </OpportunitySection>

      {/* Pages entered top 10 */}
      <OpportunitySection
        emoji="🚀" title="Páginas que entraron al top 10" count={entered.length}
        desc="Cruzaron el umbral pos ≤10 esta semana. Momento crítico — internal linking + backlinks ahora multiplican clics."
      >
        {entered.length === 0 ? <SmallEmpty msg="Sin entradas al top 10." /> : (
          <MiniTable
            headers={["URL", "Pos. anterior", "Pos. ahora", "Impr.", "Clics"]}
            rows={entered.map((e: any) => [
              <code style={{ fontSize: 11 }} title={e.page}>{shortUrl(e.page)}</code>,
              <span style={{ color: "#888" }}>{e.position_prev != null ? fmtPos(e.position_prev) : "nuevo"}</span>,
              <strong style={{ color: "#10b981" }}>{fmtPos(e.position_now)}</strong>,
              fmtNum(e.impressions),
              <strong>{fmtNum(e.clicks)}</strong>,
            ])}
          />
        )}
      </OpportunitySection>

      {/* Pages lost from top 10 */}
      <OpportunitySection
        emoji="⚠️" title="Páginas que cayeron del top 10" count={lost.length}
        desc="Venían rankeando en top 10 y perdieron posición esta semana. Investigar: contenido desactualizado, nuevos competidores, o cambios de algoritmo."
      >
        {lost.length === 0 ? <SmallEmpty msg="Sin caídas del top 10." /> : (
          <MiniTable
            headers={["URL", "Pos. anterior", "Pos. ahora", "Clics antes", "Clics ahora"]}
            rows={lost.map((e: any) => [
              <code style={{ fontSize: 11 }} title={e.page}>{shortUrl(e.page)}</code>,
              <strong>{fmtPos(e.position_prev)}</strong>,
              <span style={{ color: "#ef4444" }}>{e.position_now != null ? fmtPos(e.position_now) : "fuera"}</span>,
              fmtNum(e.clicks_prev),
              fmtNum(e.clicks_now),
            ])}
          />
        )}
      </OpportunitySection>

      {/* Striking distance */}
      <OpportunitySection
        emoji="🔥" title="Striking distance" count={striking.length}
        desc="Queries en pos 11-20 con volumen — candidatos a subir al top 10 con un empujón (CTR, internal links, reforzar contenido)."
      >
        {striking.length === 0 ? <SmallEmpty msg="Sin queries en striking distance." /> : (
          <MiniTable
            headers={["Query", "URL", "Pos.", "Impr.", "Clics"]}
            rows={striking.map((s: any) => [
              <code style={{ fontSize: 12 }}>{s.query}</code>,
              <code style={{ fontSize: 11, color: "#888" }} title={s.top_url}>{shortUrl(s.top_url)}</code>,
              <strong style={{ color: "#f59e0b" }}>{fmtPos(s.avg_position)}</strong>,
              fmtNum(s.impressions),
              fmtNum(s.clicks),
            ])}
          />
        )}
      </OpportunitySection>

      {/* Cannibalization */}
      <OpportunitySection
        emoji="🥊" title="Canibalización de keywords" count={cannibal.length}
        desc="Queries donde 2+ URLs nuestras compiten. Google puede repartir el tráfico o penalizar ambas. Decidir una URL ganadora + redirects o canonical."
      >
        {cannibal.length === 0 ? <SmallEmpty msg="Sin canibalización detectada. ✅" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cannibal.map((c: any, i: number) => (
              <div key={c.query + i} style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <code style={{ fontSize: 13, fontWeight: 600 }}>{c.query}</code>
                  <Badge color="orange">{c.url_count} URLs · {fmtNum(c.impressions)} impr.</Badge>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {c.urls.map((u: any) => (
                    <div key={u.page} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa" }}>
                      <code title={u.page}>{shortUrl(u.page)}</code>
                      <span>pos {fmtPos(u.position)} · {fmtNum(u.impressions)} impr · {fmtNum(u.clicks)} clics</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </OpportunitySection>
    </div>
  )
}

function OpportunitySection({ emoji, title, count, desc, children }: { emoji: string; title: string; count: number; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <Heading level="h3" style={{ marginBottom: 4 }}>
        {emoji} {title} <Badge color="grey" style={{ marginLeft: 6 }}>{count}</Badge>
      </Heading>
      <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>{desc}</Text>
      {children}
    </div>
  )
}

function MiniTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "var(--color-ui-bg-subtle)" }}>
          <tr>{headers.map((h, i) => (
            <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: 8, fontWeight: 600 }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--color-ui-border-base, #2e2e32)", background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: 8, textAlign: j === 0 ? "left" : "right" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SmallEmpty({ msg }: { msg: string }) {
  return <Text size="small" className="text-ui-fg-muted" style={{ padding: "12px 0" }}>{msg}</Text>
}

function BrandCard({ label, data, good }: { label: string; data: any; good: boolean }) {
  const pct = data?.pct_of_impressions || 0
  return (
    <div style={{ background: "var(--color-ui-bg-base)", border: `1px solid ${good ? "rgba(16, 185, 129, 0.4)" : "var(--color-ui-border-base, #2e2e32)"}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <Text size="small" style={{ fontWeight: 600 }}>{label}</Text>
        <span style={{ fontSize: 22, fontWeight: 700, color: good ? "#10b981" : "inherit" }}>{pct.toFixed(0)}%</span>
      </div>
      {data ? (
        <div style={{ fontSize: 12, color: "#888" }}>
          {fmtNum(data.impressions)} impresiones · {fmtNum(data.clicks)} clics · {data.unique_queries} queries únicas
        </div>
      ) : <Text size="small" className="text-ui-fg-muted">Sin datos.</Text>}
    </div>
  )
}

function shortUrl(url: string | null | undefined): string {
  if (!url) return "—"
  return url.replace(/^https?:\/\/[^/]+/, "") || "/"
}

// ─── Technical (Batch 6) ──────────────────────────────────────────────────────
function TechnicalTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    fetch(`${API}/admin/seo/technical`, { credentials: "include" })
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return <Text>Cargando…</Text>
  if (!data) return <Text>Error cargando.</Text>

  const { cwv, sitemap, alerts_unacked } = data
  const badgeForStatus = (s: string) =>
    s === "good" ? "green" : s === "needs_improvement" ? "orange" : s === "poor" ? "red" : "grey"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <HealthBadge label="CWV Phone" data={cwv.by_device?.PHONE} />
        <HealthBadge label="CWV Desktop" data={cwv.by_device?.DESKTOP} />
        <AlertBadge label="Alertas sin atender" counts={alerts_unacked} />
        <SitemapBadge sitemap={sitemap} />
      </div>

      {/* Alerts feed (merged from former Alerts tab) */}
      <AlertsFeed />

      {/* Core Web Vitals rows */}
      <div>
        <Heading level="h3" style={{ marginBottom: 4 }}>⚡ Core Web Vitals (CrUX · campo)</Heading>
        <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>
          Datos reales de usuarios Chrome. Thresholds: LCP ≤2.5s · INP ≤200ms · CLS ≤0.1. Umbral {"needs_improvement"}: ≤4s · ≤500ms · ≤0.25.
        </Text>
        {!cwv.has_data ? (
          <EmptyState message="CrUX todavía no tiene datos para este dominio (necesita volumen mínimo de usuarios Chrome). Se vuelve a intentar diariamente." />
        ) : (
          <div style={{ border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "var(--color-ui-bg-subtle)" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>URL</th>
                  <th style={{ textAlign: "left", padding: 8, width: 80 }}>Device</th>
                  <th style={{ textAlign: "right", padding: 8, width: 100 }}>LCP (ms)</th>
                  <th style={{ textAlign: "right", padding: 8, width: 100 }}>INP (ms)</th>
                  <th style={{ textAlign: "right", padding: 8, width: 80 }}>CLS</th>
                  <th style={{ textAlign: "right", padding: 8, width: 100 }}>TTFB (ms)</th>
                </tr>
              </thead>
              <tbody>
                {cwv.rows.map((r: any, i: number) => (
                  <tr key={r.url + r.device} style={{ borderTop: "1px solid var(--color-ui-border-base, #2e2e32)", background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                    <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }} title={r.url}>{shortUrl(r.url)}</td>
                    <td style={{ padding: 8 }}>{r.device}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>
                      {r.lcp != null ? r.lcp.toFixed(0) : "—"} <Badge color={badgeForStatus(r.lcp_status) as any}>{r.lcp_status.slice(0, 4)}</Badge>
                    </td>
                    <td style={{ textAlign: "right", padding: 8 }}>
                      {r.inp != null ? r.inp.toFixed(0) : "—"} <Badge color={badgeForStatus(r.inp_status) as any}>{r.inp_status.slice(0, 4)}</Badge>
                    </td>
                    <td style={{ textAlign: "right", padding: 8 }}>
                      {r.cls != null ? r.cls.toFixed(3) : "—"} <Badge color={badgeForStatus(r.cls_status) as any}>{r.cls_status.slice(0, 4)}</Badge>
                    </td>
                    <td style={{ textAlign: "right", padding: 8, color: "#888" }}>{r.ttfb != null ? r.ttfb.toFixed(0) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sitemap */}
      <div>
        <Heading level="h3" style={{ marginBottom: 4 }}>🗺️ Sitemap</Heading>
        {!sitemap ? (
          <Text size="small" className="text-ui-fg-muted">Sin snapshots todavía. El job `seo-sitemap-check` corre diariamente.</Text>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Stat label="URLs totales" value={fmtNum(sitemap.urls_total)} />
            <Stat label="URLs con lastmod" value={`${fmtNum(sitemap.urls_with_lastmod)}/${fmtNum(sitemap.urls_total)}`} />
            <Stat label="Lastmod más antiguo" value={sitemap.oldest_lastmod ? new Date(sitemap.oldest_lastmod).toLocaleDateString() : "—"} />
            <Stat label="Última revisión" value={sitemap.checked_at ? new Date(sitemap.checked_at).toLocaleDateString() : "—"} />
          </div>
        )}
      </div>
    </div>
  )
}

function HealthBadge({ label, data }: { label: string; data: any }) {
  if (!data || data.total === 0) return (
    <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", padding: 12, borderRadius: 10 }}>
      <Text size="xsmall" className="text-ui-fg-muted">{label}</Text>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#888" }}>sin datos</div>
    </div>
  )
  const worstPct = data.poor > 0 ? "red" : data.ni > 0 ? "orange" : "green"
  return (
    <div style={{ background: "var(--color-ui-bg-base)", border: `1px solid ${worstPct === "green" ? "rgba(16,185,129,0.4)" : worstPct === "orange" ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)"}`, padding: 12, borderRadius: 10 }}>
      <Text size="xsmall" className="text-ui-fg-muted">{label}</Text>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
        <span style={{ color: "#10b981" }}>{data.good}</span> · <span style={{ color: "#f59e0b" }}>{data.ni}</span> · <span style={{ color: "#ef4444" }}>{data.poor}</span>
      </div>
      <Text size="xsmall" className="text-ui-fg-muted">good · necesita mejora · pobre</Text>
    </div>
  )
}

function AlertBadge({ label, counts }: { label: string; counts: any }) {
  const total = (counts?.critical || 0) + (counts?.high || 0) + (counts?.medium || 0) + (counts?.low || 0)
  const color = counts?.critical ? "red" : counts?.high ? "orange" : counts?.medium ? "blue" : "grey"
  return (
    <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", padding: 12, borderRadius: 10 }}>
      <Text size="xsmall" className="text-ui-fg-muted">{label}</Text>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2, color: total > 0 ? "inherit" : "#888" }}>{total}</div>
      {total > 0 && <Badge color={color as any}>{counts.critical || 0} crítica · {counts.high || 0} alta</Badge>}
    </div>
  )
}

function SitemapBadge({ sitemap }: { sitemap: any }) {
  if (!sitemap) return <HealthBadge label="Sitemap" data={null} />
  const oldestDays = sitemap.oldest_lastmod ? (Date.now() - new Date(sitemap.oldest_lastmod).getTime()) / (1000 * 60 * 60 * 24) : null
  const warn = oldestDays != null && oldestDays > 7
  return (
    <div style={{ background: "var(--color-ui-bg-base)", border: `1px solid ${warn ? "rgba(245,158,11,0.4)" : "var(--color-ui-border-base, #2e2e32)"}`, padding: 12, borderRadius: 10 }}>
      <Text size="xsmall" className="text-ui-fg-muted">Sitemap</Text>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{sitemap.urls_total} URLs</div>
      <Text size="xsmall" className="text-ui-fg-muted">
        {oldestDays != null ? `lastmod más antiguo: ${oldestDays.toFixed(0)}d` : "sin lastmod"}
      </Text>
    </div>
  )
}

// ─── Alerts (Batch 6) ─────────────────────────────────────────────────────────
function AlertsFeed() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`${API}/admin/seo/alerts?status=${showAll ? "all" : "unacked"}`, { credentials: "include" })
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [showAll])

  async function ack(id: string) {
    await fetch(`${API}/admin/seo/alerts`, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    })
    load()
  }

  if (loading) return <Text>Cargando…</Text>

  const alerts = data?.alerts || []
  const summary = data?.summary || { critical: 0, high: 0, medium: 0, low: 0 }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Heading level="h3">🔔 Alertas ({alerts.length})</Heading>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Mostrar resueltas
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Badge color="red">Crítica: {summary.critical}</Badge>
        <Badge color="orange">Alta: {summary.high}</Badge>
        <Badge color="blue">Media: {summary.medium}</Badge>
        <Badge color="grey">Baja: {summary.low}</Badge>
      </div>

      {alerts.length === 0 ? (
        <EmptyState message={showAll ? "Sin alertas (todo limpio ✅)." : "Sin alertas sin atender. ✅"} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((a: any) => (
            <div key={a.id} style={{
              background: "var(--color-ui-bg-base)",
              border: `1px solid ${a.severity === "critical" ? "rgba(239,68,68,0.5)" : a.severity === "high" ? "rgba(245,158,11,0.4)" : "var(--color-ui-border-base, #2e2e32)"}`,
              borderRadius: 8, padding: 12,
              opacity: a.acked_at ? 0.5 : 1,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <Badge color={a.severity === "critical" ? "red" : a.severity === "high" ? "orange" : a.severity === "medium" ? "blue" : "grey"}>{a.severity}</Badge>
                    <Badge color="grey">{a.type}</Badge>
                    <span style={{ fontSize: 11, color: "#888" }}>{new Date(a.created_at).toLocaleString()}</span>
                    {a.acked_at && <Badge color="green">✓ atendida</Badge>}
                  </div>
                  <strong style={{ display: "block", marginBottom: 4 }}>{a.title}</strong>
                  <Text size="small" className="text-ui-fg-muted">{a.message}</Text>
                </div>
                {!a.acked_at && (
                  <button onClick={() => ack(a.id)} style={{
                    padding: "6px 12px", background: "transparent",
                    border: "1px solid var(--color-ui-border-base, #2e2e32)",
                    borderRadius: 6, cursor: "pointer", color: "inherit", fontSize: 11,
                  }}>✓ Atender</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlaceholderTab({ title, batch, message }: { title: string; batch: number; message: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", background: "var(--color-ui-bg-subtle)", border: "1px dashed var(--color-ui-border-base, #2e2e32)", borderRadius: 12 }}>
      <Heading level="h3" style={{ marginBottom: 8 }}>{title}</Heading>
      <Badge color="orange" style={{ marginBottom: 12 }}>Batch {batch}</Badge>
      <Text size="small" className="text-ui-fg-muted">{message}</Text>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
// ─── Link-out grid (shortcuts to external dashboards) ───────────────────────
function LinkOutGrid({ config, umamiUrl, clarityId, posthogProjectId }: {
  config: any
  umamiUrl?: string
  clarityId?: string
  posthogProjectId?: string
}) {
  const gscProp = config?.gsc_property ? encodeURIComponent(config.gsc_property) : null
  const ga4Id = config?.ga4_property_id
  const links: Array<{ emoji: string; label: string; href: string; title: string; enabled: boolean }> = [
    { emoji: "🔍", label: "GSC", href: gscProp ? `https://search.google.com/search-console?resource_id=${gscProp}` : "https://search.google.com/search-console", title: "Google Search Console", enabled: !!gscProp },
    { emoji: "📊", label: "GA4", href: ga4Id ? `https://analytics.google.com/analytics/web/#/p${ga4Id}/reports/intelligenthome` : "https://analytics.google.com", title: "Google Analytics 4", enabled: !!ga4Id },
    { emoji: "🏠", label: "Umami", href: umamiUrl || "https://analytics.enrola.shop", title: "Umami self-hosted analytics", enabled: !!umamiUrl },
    { emoji: "🎥", label: "Clarity", href: clarityId ? `https://clarity.microsoft.com/projects/view/${clarityId}/dashboard` : "https://clarity.microsoft.com", title: "Microsoft Clarity (heatmaps + replay)", enabled: !!clarityId },
    { emoji: "🧪", label: "PostHog", href: posthogProjectId ? `https://us.posthog.com/project/${posthogProjectId}` : "https://us.posthog.com", title: "PostHog (flags + experiments + errors)", enabled: !!posthogProjectId },
  ]
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          title={l.title}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 10px",
            background: "transparent",
            border: "1px solid var(--color-ui-border-base, #2e2e32)",
            borderRadius: 6, color: "inherit", textDecoration: "none",
            fontSize: 12, fontWeight: 500,
            opacity: l.enabled ? 1 : 0.5,
          }}
        >
          <span>{l.emoji}</span>
          <span>{l.label}</span>
          <span style={{ fontSize: 10, color: "#888" }}>↗</span>
        </a>
      ))}
    </div>
  )
}

function ExportMenu() {
  const [open, setOpen] = useState(false)
  const exports = [
    { table: "keywords", label: "Keywords trackeadas" },
    { table: "competitors", label: "Competidores" },
    { table: "gsc_daily", label: "GSC daily (90d)" },
    { table: "gsc_totals", label: "GSC totals (90d)" },
    { table: "ga4_daily", label: "GA4 daily (90d)" },
    { table: "ga4_pages", label: "GA4 pages (90d)" },
    { table: "alerts", label: "Alertas" },
    { table: "suggestions_ve", label: "Sugerencias VE" },
  ]
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ padding: "8px 14px", background: "transparent", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, cursor: "pointer", color: "inherit", fontSize: 12 }}>
        ⬇ Export ▾
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, padding: 6, zIndex: 10, minWidth: 240, boxShadow: "0 6px 20px rgba(0,0,0,0.3)" }} onMouseLeave={() => setOpen(false)}>
          {exports.map((e) => (
            <div key={e.table} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 4, fontSize: 12 }}>
              <span>{e.label}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <a href={`${API}/admin/seo/export?table=${e.table}&format=csv`} style={{ padding: "3px 8px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", borderRadius: 4, textDecoration: "none", fontSize: 10, fontWeight: 600 }}>CSV</a>
                <a href={`${API}/admin/seo/export?table=${e.table}&format=json`} style={{ padding: "3px 8px", background: "transparent", border: "1px solid var(--color-ui-border-base, #2e2e32)", color: "inherit", borderRadius: 4, textDecoration: "none", fontSize: 10 }}>JSON</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OnboardingChecklist({ config, hasData }: { config: any; hasData: boolean }) {
  // If we don't have a config response (fetch still loading, auth issue, etc.),
  // don't render — avoids showing a misleading "all unchecked" state when
  // everything is actually configured.
  if (!config) return null
  const items = [
    { label: "Google Search Console conectado", done: !!config.gsc_property },
    { label: "Google Analytics 4 conectado", done: !!config.ga4_property_id },
    { label: "Service Account con acceso", done: !!config.service_account_email },
    { label: "CrUX API key configurada", done: !!config.crux_api_key_set },
    { label: "Sync automático activo", done: config.sync_enabled === true },
    { label: "Primer dato recibido de GSC", done: hasData },
  ]
  const pending = items.filter((i) => !i.done).length
  if (pending === 0) return null
  return (
    <div style={{ background: "rgba(255, 122, 0, 0.08)", border: "1px solid rgba(255, 122, 0, 0.3)", borderRadius: 10, padding: 14 }}>
      <Heading level="h3" style={{ marginBottom: 8 }}>🚀 Setup pendiente ({pending})</Heading>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((i) => (
          <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ fontSize: 16 }}>{i.done ? "✅" : "⬜"}</span>
            <span style={{ color: i.done ? "inherit" : "#888" }}>{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthlySnapshots() {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    fetch(`${API}/admin/seo/snapshots?limit=6`, { credentials: "include" })
      .then(r => r.json()).then(setData).catch(() => {})
  }, [])
  if (!data?.snapshots?.length) return null
  const rows = data.snapshots
  return (
    <div>
      <Heading level="h3" style={{ marginBottom: 4 }}>📆 Comparativa mes a mes</Heading>
      <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 10 }}>
        Snapshots mensuales auto-generados. Útil para evaluar tendencia del trimestre.
      </Text>
      <MiniTable
        headers={["Mes", "Impresiones", "Clics", "Pos. media", "Sesiones org.", "Revenue org."]}
        rows={rows.map((r: any) => [
          <strong>{r.label}</strong>,
          <span>{fmtNum(r.impressions)} {r.delta?.impressions_pct != null && <small style={{ color: r.delta.impressions_pct >= 0 ? "#10b981" : "#ef4444" }}>{r.delta.impressions_pct >= 0 ? "+" : ""}{r.delta.impressions_pct.toFixed(0)}%</small>}</span>,
          <span>{fmtNum(r.clicks)} {r.delta?.clicks_pct != null && <small style={{ color: r.delta.clicks_pct >= 0 ? "#10b981" : "#ef4444" }}>{r.delta.clicks_pct >= 0 ? "+" : ""}{r.delta.clicks_pct.toFixed(0)}%</small>}</span>,
          fmtPos(r.avg_position),
          fmtNum(r.sessions_organic),
          <span>€{Number(r.revenue_organic).toFixed(0)} {r.delta?.revenue_pct != null && <small style={{ color: r.delta.revenue_pct >= 0 ? "#10b981" : "#ef4444" }}>{r.delta.revenue_pct >= 0 ? "+" : ""}{r.delta.revenue_pct.toFixed(0)}%</small>}</span>,
        ])}
      />
    </div>
  )
}

function ConfigBar({ config }: { config: any }) {
  if (!config) return null
  const syncOn = config.sync_enabled === true
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 10, background: "var(--color-ui-bg-subtle)", borderRadius: 8, fontSize: 12 }}>
      <div><span className="text-ui-fg-muted">GSC:</span> <code>{config.gsc_property || "—"}</code></div>
      <div><span className="text-ui-fg-muted">GA4:</span> <code>{config.ga4_property_id || "—"}</code></div>
      <div><span className="text-ui-fg-muted">Sync:</span> {syncOn ? <Badge color="green">Activo</Badge> : <Badge color="orange">Pausado</Badge>}</div>
      <div><span className="text-ui-fg-muted">CrUX:</span> {config.crux_api_key_set ? "✅" : "❌"}</div>
    </div>
  )
}

function KpiCard({ label, value, delta }: { label: string; value: string; delta?: { text: string; color: string } }) {
  return (
    <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", padding: 16, borderRadius: 12 }}>
      <Text size="xsmall" className="text-ui-fg-muted" style={{ display: "block", marginBottom: 6 }}>{label}</Text>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      {delta && <div style={{ marginTop: 4, fontSize: 12, color: delta.color }}>{delta.text} vs. periodo anterior</div>}
    </div>
  )
}

function AttributionBlock({ data, days }: { data: any; days: number }) {
  const s = data.summary || {}
  const totalGa = s.total_revenue_ga4 || 0
  const medusaWeb = (data.medusa_bucket || []).find((b: any) => b.bucket === "web")
  const medusaManual = (data.medusa_bucket || []).filter((b: any) => b.bucket !== "web" && b.bucket !== null)
  const totalMedusaManual = medusaManual.reduce((acc: number, r: any) => acc + Number(r.revenue || 0), 0)

  const hasGa = s.total_sessions > 0

  return (
    <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 12, padding: 16 }}>
      <Heading level="h3" style={{ marginBottom: 8 }}>💰 Atribución y revenue ({days}d)</Heading>
      <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 12 }}>
        Fuente: Google Analytics 4 (canal orgánico, directo, social, referral) + Medusa orders por `metadata.source_channel`.
      </Text>

      {!hasGa && (
        <div style={{ padding: 12, background: "rgba(59, 130, 246, 0.08)", borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          GA4 aún no tiene datos para este periodo. Corre el backfill: <code>npx medusa exec ./src/scripts/seo-ga4-backfill.js</code>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <KpiCard label="Sesiones orgánicas" value={fmtNum(s.organic_sessions)} />
        <KpiCard label="Revenue orgánico (GA4)" value={`€${Number(s.organic_revenue || 0).toFixed(0)}`} />
        <KpiCard label="Transacciones orgánicas" value={fmtNum(s.organic_transactions)} />
        <KpiCard label="Revenue total GA4" value={`€${Number(totalGa).toFixed(0)}`} />
      </div>

      {/* Channel breakdown table */}
      {(data.channel_mix || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text size="small" style={{ fontWeight: 600, marginBottom: 6 }}>Mix de canales</Text>
          <MiniTable
            headers={["Canal", "Sesiones", "Trans.", "Revenue"]}
            rows={data.channel_mix.map((r: any) => [
              r.channel,
              fmtNum(r.sessions),
              fmtNum(r.transactions),
              `€${Number(r.revenue).toFixed(0)}`,
            ])}
          />
        </div>
      )}

      {/* Medusa breakdown */}
      {(data.medusa_bucket || []).length > 0 && (
        <div>
          <Text size="small" style={{ fontWeight: 600, marginBottom: 6 }}>Orders en Medusa por canal</Text>
          <Text size="xsmall" className="text-ui-fg-muted" style={{ display: "block", marginBottom: 6 }}>
            Incluye ventas manuales (Telegram/WhatsApp) marcadas con <code>metadata.source_channel</code> o <code>manual_sale: true</code>.
          </Text>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {data.medusa_bucket.map((b: any) => (
              <div key={b.bucket} style={{ background: "var(--color-ui-bg-subtle)", border: "1px solid var(--color-ui-border-base, #2e2e32)", padding: 10, borderRadius: 6 }}>
                <Text size="xsmall" className="text-ui-fg-muted" style={{ display: "block" }}>{b.bucket}</Text>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{b.orders} orders</div>
                <div style={{ fontSize: 12, color: "#888" }}>€{Number(b.revenue).toFixed(0)}</div>
              </div>
            ))}
          </div>
          {totalMedusaManual > 0 && medusaWeb && (
            <Text size="xsmall" className="text-ui-fg-muted" style={{ marginTop: 8 }}>
              Split: {Math.round((Number(medusaWeb.revenue) / (Number(medusaWeb.revenue) + totalMedusaManual)) * 100)}% web · {Math.round((totalMedusaManual / (Number(medusaWeb.revenue) + totalMedusaManual)) * 100)}% manual
            </Text>
          )}
        </div>
      )}
    </div>
  )
}

function Sparkline({ series }: { series: SeriesPoint[] }) {
  const { paths, maxY } = useMemo(() => {
    if (series.length === 0) return { paths: "", maxY: 0 }
    const w = 800, h = 120, pad = 20
    const maxY = Math.max(1, ...series.map((p) => p.clicks))
    const step = (w - pad * 2) / Math.max(1, series.length - 1)
    const points = series.map((p, i) => {
      const x = pad + i * step
      const y = h - pad - (p.clicks / maxY) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return { paths: points.join(" "), maxY }
  }, [series])

  if (series.length === 0) return <Text size="small" className="text-ui-fg-muted">Sin datos.</Text>

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="0 0 800 120" preserveAspectRatio="none" style={{ width: "100%", height: 120 }}>
        <polyline points={paths} fill="none" stroke="#ff7a00" strokeWidth="2" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", marginTop: 4 }}>
        <span>{series[0]?.date?.slice(5)}</span>
        <span>máx: {maxY}</span>
        <span>{series[series.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

function QueriesTable({ rows }: { rows: QueryRow[] }) {
  if (rows.length === 0) return <Text size="small" className="text-ui-fg-muted">Sin queries.</Text>
  return (
    <div style={{ border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "var(--color-ui-bg-subtle)" }}>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>Query</th>
            <th style={{ textAlign: "right", padding: 8, width: 70 }}>Impr.</th>
            <th style={{ textAlign: "right", padding: 8, width: 60 }}>Clics</th>
            <th style={{ textAlign: "right", padding: 8, width: 60 }}>CTR</th>
            <th style={{ textAlign: "right", padding: 8, width: 60 }}>Pos.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.query} style={{ borderTop: "1px solid var(--color-ui-border-base, #2e2e32)", background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              <td style={{ padding: 8, fontFamily: "monospace" }}>{r.query}</td>
              <td style={{ textAlign: "right", padding: 8 }}>{fmtNum(r.impressions)}</td>
              <td style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>{fmtNum(r.clicks)}</td>
              <td style={{ textAlign: "right", padding: 8 }}>{fmtPct(r.ctr, 1)}</td>
              <td style={{ textAlign: "right", padding: 8 }}>{fmtPos(r.position)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CountriesList({ rows }: { rows: { country: string; impressions: number; clicks: number }[] }) {
  if (rows.length === 0) return <Text size="small" className="text-ui-fg-muted">Sin datos.</Text>
  const total = rows.reduce((s, r) => s + r.impressions, 0)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.slice(0, 8).map((r) => {
        const pct = total > 0 ? (r.impressions / total) * 100 : 0
        return (
          <div key={r.country} style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", padding: 10, borderRadius: 8, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "rgba(255, 122, 0, 0.12)" }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <strong>{(CC_LABELS[r.country.toLowerCase()] || r.country.toUpperCase()).slice(0, 20)}</strong>
              <span>{fmtNum(r.impressions)} <span className="text-ui-fg-muted" style={{ fontSize: 11 }}>· {fmtNum(r.clicks)} clics</span></span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", background: "var(--color-ui-bg-subtle)", border: "1px dashed var(--color-ui-border-base, #2e2e32)", borderRadius: 12 }}>
      <Text size="small" className="text-ui-fg-muted">{message}</Text>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "SEO Analytics",
  icon: ChartBar,
})
