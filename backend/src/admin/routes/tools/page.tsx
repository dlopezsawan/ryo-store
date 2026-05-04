"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { BuildingTax } from "@medusajs/icons"

// IDs hardcoded here — if you ever change them, update the env vars too.
const POSTHOG_PROJECT_ID = "393363"
const POSTHOG_BASE = "https://us.posthog.com"
const CLARITY_ID = "wfp9s5wh5i"
const CLARITY_BASE = `https://clarity.microsoft.com/projects/view/${CLARITY_ID}`
const UMAMI_BASE = "https://analytics.enrola.shop"
const UMAMI_WEBSITE_ID = "6789c969-a433-43a9-afe2-587304a89634"
const GSC_URL = "https://search.google.com/search-console?resource_id=sc-domain%3Aenrola.shop"
const GA4_PROPERTY_ID = "534031397"

type LinkDef = {
  emoji: string
  label: string
  href: string
  description?: string
  badge?: string
}

type Section = {
  id: string
  title: string
  emoji: string
  subtitle: string
  theme: "posthog" | "clarity" | "umami" | "google" | "misc"
  links: LinkDef[]
}

const SECTIONS: Section[] = [
  // ─── PostHog (product analytics + flags + experiments + errors + LLM) ─────
  {
    id: "posthog",
    emoji: "🧪",
    title: "PostHog",
    theme: "posthog",
    subtitle: "Product analytics, feature flags, experiments, error tracking, LLM observability",
    links: [
      { emoji: "🏠", label: "Project home", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}` },
      { emoji: "📊", label: "Dashboards", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/dashboard`, description: "Dashboards custom + plantillas" },
      { emoji: "🔍", label: "Insights / Trends", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/insights`, description: "Crear trends, funnels, retention, paths" },
      { emoji: "🔀", label: "Funnels nuevo", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/insights/new?insight=FUNNELS`, description: "Analizar drop-off entre eventos" },
      { emoji: "📈", label: "Retention", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/insights/new?insight=RETENTION`, description: "¿Quién vuelve semana 2, 3, 4?" },
      { emoji: "👥", label: "Persons", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/persons`, description: "Explorar usuarios identificados + sus events" },
      { emoji: "🧑‍🤝‍🧑", label: "Cohorts", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/cohorts`, description: "Crear segmentos reutilizables" },
      { emoji: "🎬", label: "Session Replay", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/replay`, description: "Grabaciones de sesiones (deshabilitado — Clarity lo hace)", badge: "off" },
      { emoji: "🎛", label: "Feature Flags", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/feature_flags`, description: "Crear/editar flags (toggle desde DEV tab)" },
      { emoji: "🧪", label: "Experiments", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/experiments`, description: "Setup A/B tests con variantes" },
      { emoji: "📝", label: "Surveys", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/surveys`, description: "NPS, CSAT, in-app polls" },
      { emoji: "🐛", label: "Error Tracking", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/error_tracking`, description: "Issues + stack traces + affected users" },
      { emoji: "🤖", label: "LLM Observability", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/llm`, description: "Costos + tokens + top prompts del bot" },
      { emoji: "📋", label: "Activity feed", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/activity/explore`, description: "Todos los eventos en tiempo real" },
      { emoji: "🗂", label: "Data management", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/data-management/events`, description: "Event definitions, properties, taxonomy" },
      { emoji: "⚙", label: "Project settings", href: `${POSTHOG_BASE}/project/${POSTHOG_PROJECT_ID}/settings/project`, description: "Tokens, tracked domains, data retention" },
    ],
  },
  // ─── Clarity (heatmaps + session replay) ──────────────────────────────────
  {
    id: "clarity",
    emoji: "🎥",
    title: "Microsoft Clarity",
    theme: "clarity",
    subtitle: "Heatmaps + session recordings + frustration signals (rage clicks, dead clicks)",
    links: [
      { emoji: "🏠", label: "Dashboard", href: `${CLARITY_BASE}/dashboard`, description: "Summary diario" },
      { emoji: "🎬", label: "Recordings", href: `${CLARITY_BASE}/impressions`, description: "Session replays con filtros" },
      { emoji: "🔥", label: "Heatmaps", href: `${CLARITY_BASE}/heatmap`, description: "Click, scroll, area maps por URL" },
      { emoji: "🎯", label: "Smart Events", href: `${CLARITY_BASE}/events`, description: "Events custom definidos" },
      { emoji: "😡", label: "Rage clicks", href: `${CLARITY_BASE}/impressions?Filter=RageClick`, description: "Sesiones con clicks de frustración" },
      { emoji: "💀", label: "Dead clicks", href: `${CLARITY_BASE}/impressions?Filter=DeadClick`, description: "Clicks en elementos no-interactivos" },
      { emoji: "⚡", label: "Quick backs", href: `${CLARITY_BASE}/impressions?Filter=QuickBack`, description: "Usuarios que volvieron atrás rápido" },
      { emoji: "🤖", label: "Copilot AI", href: `${CLARITY_BASE}/copilot`, description: "Resumen IA de patrones de comportamiento" },
      { emoji: "⚙", label: "Settings", href: `${CLARITY_BASE}/settings/overview` },
    ],
  },
  // ─── Umami (self-hosted analytics) ────────────────────────────────────────
  {
    id: "umami",
    emoji: "🏠",
    title: "Umami",
    theme: "umami",
    subtitle: "Self-hosted analytics en analytics.enrola.shop — privacy-first, sin cookies",
    links: [
      { emoji: "📊", label: "Dashboard principal", href: `${UMAMI_BASE}/websites/${UMAMI_WEBSITE_ID}` },
      { emoji: "⚡", label: "Realtime", href: `${UMAMI_BASE}/websites/${UMAMI_WEBSITE_ID}/realtime`, description: "Visitantes activos ahora mismo" },
      { emoji: "📈", label: "Reports", href: `${UMAMI_BASE}/reports`, description: "Funnels, retention, goals, insights" },
      { emoji: "🎯", label: "Goals", href: `${UMAMI_BASE}/reports/create`, description: "Definir metas (ej. checkout completed)" },
      { emoji: "🔀", label: "Funnel builder", href: `${UMAMI_BASE}/reports/create` },
      { emoji: "📋", label: "Events", href: `${UMAMI_BASE}/websites/${UMAMI_WEBSITE_ID}/events` },
      { emoji: "⚙", label: "Website settings", href: `${UMAMI_BASE}/settings/websites/${UMAMI_WEBSITE_ID}` },
    ],
  },
  // ─── Google Search Console ────────────────────────────────────────────────
  {
    id: "gsc",
    emoji: "🔍",
    title: "Google Search Console",
    theme: "google",
    subtitle: "Performance orgánico en Google — impresiones, clics, CTR, queries, posiciones",
    links: [
      { emoji: "📊", label: "Performance", href: GSC_URL, description: "Queries + páginas + países + devices" },
      { emoji: "🗺", label: "Sitemaps", href: `${GSC_URL}&hl=es#sitemaps`, description: "Submit + status del sitemap.xml" },
      { emoji: "🔗", label: "Indexing / Pages", href: `${GSC_URL}&hl=es#coverage`, description: "URLs indexadas vs excluidas" },
      { emoji: "🔎", label: "URL Inspection", href: `${GSC_URL}&hl=es`, description: "Inspeccionar URL específica + request reindex" },
      { emoji: "⚡", label: "Core Web Vitals", href: `${GSC_URL}&hl=es#speed`, description: "CWV report (campo vs Chrome)" },
      { emoji: "📱", label: "Mobile Usability", href: `${GSC_URL}&hl=es#mobile_usability` },
      { emoji: "🔒", label: "Security issues", href: `${GSC_URL}&hl=es#security_issues` },
      { emoji: "🔗", label: "Links / Backlinks", href: `${GSC_URL}&hl=es#links` },
      { emoji: "🏷", label: "Enhancements", href: `${GSC_URL}&hl=es`, description: "Structured data validation" },
    ],
  },
  // ─── Google Analytics 4 ───────────────────────────────────────────────────
  {
    id: "ga4",
    emoji: "📊",
    title: "Google Analytics 4",
    theme: "google",
    subtitle: "Tráfico + conversiones + atribución multi-touch + revenue",
    links: [
      { emoji: "🏠", label: "Home", href: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/reports/intelligenthome` },
      { emoji: "⚡", label: "Realtime", href: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/reports/realtime`, description: "Usuarios ahora" },
      { emoji: "📈", label: "Acquisition", href: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/reports/defaultid/_u..reportId=acquisitions-overview`, description: "Canales / source / medium" },
      { emoji: "🎯", label: "Engagement", href: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/reports/defaultid/_u..reportId=engagement-overview` },
      { emoji: "💰", label: "Monetization", href: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/reports/defaultid/_u..reportId=monetization-overview` },
      { emoji: "👥", label: "Audiences", href: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/audiences`, description: "Crear segmentos de usuario" },
      { emoji: "🔀", label: "Explorations", href: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/explorer`, description: "Funnel, path, cohort analysis" },
      { emoji: "🏷", label: "Events", href: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/admin/events`, description: "Event definitions + conversions" },
      { emoji: "⚙", label: "Property settings", href: `https://analytics.google.com/analytics/web/#/a${GA4_PROPERTY_ID}/admin/property` },
    ],
  },
  // ─── Herramientas de calidad (third-party gratis) ─────────────────────────
  {
    id: "misc",
    emoji: "🔧",
    title: "Herramientas puntuales",
    theme: "misc",
    subtitle: "Third-party gratis para checks rápidos",
    links: [
      { emoji: "🏎", label: "PageSpeed Insights", href: "https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fenrola.shop&hl=es", description: "Core Web Vitals lab + field" },
      { emoji: "🔍", label: "Rich Results Test", href: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fenrola.shop", description: "Validar structured data" },
      { emoji: "📱", label: "Mobile-Friendly Test", href: "https://search.google.com/test/mobile-friendly?url=https%3A%2F%2Fenrola.shop" },
      { emoji: "📄", label: "Schema.org Validator", href: "https://validator.schema.org/#url=https%3A%2F%2Fenrola.shop" },
      { emoji: "🤖", label: "robots.txt Tester", href: "https://www.google.com/webmasters/tools/robots-testing-tool" },
      { emoji: "🗺", label: "XML Sitemap preview", href: "https://enrola.shop/sitemap.xml" },
      { emoji: "🌐", label: "DNS Checker", href: "https://dnschecker.org/#A/enrola.shop", description: "Propagación global de DNS" },
      { emoji: "🔒", label: "SSL Labs", href: "https://www.ssllabs.com/ssltest/analyze.html?d=enrola.shop", description: "Calificación TLS" },
      { emoji: "🌍", label: "HTTP headers inspector", href: "https://securityheaders.com/?q=https%3A%2F%2Fenrola.shop" },
      { emoji: "📊", label: "Google Trends", href: "https://trends.google.com/trends/explore?geo=VE&q=rolling%20paper,grinder,papel%20fumar", description: "Tendencias VE para nuestros términos" },
    ],
  },
]

const THEME_COLORS: Record<Section["theme"], { border: string; accent: string }> = {
  posthog:  { border: "rgba(16, 185, 129, 0.35)", accent: "#10b981" },
  clarity:  { border: "rgba(59, 130, 246, 0.35)", accent: "#3b82f6" },
  umami:    { border: "rgba(255, 122, 0, 0.35)", accent: "#ff7a00" },
  google:   { border: "rgba(168, 85, 247, 0.35)", accent: "#a855f7" },
  misc:     { border: "rgba(148, 163, 184, 0.35)", accent: "#94a3b8" },
}

export default function ToolsPage() {
  return (
    <Container>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <BuildingTax />
        <Heading level="h1">🔗 External Tools</Heading>
        <Badge color="grey">Quick-access bookmarks</Badge>
      </div>
      <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 20 }}>
        Todas las herramientas que usamos fuera del admin de Medusa en un solo lugar.
        Deep-links con los IDs del proyecto pre-cargados — un click y estás donde necesitas.
      </Text>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {SECTIONS.map((s) => {
          const theme = THEME_COLORS[s.theme]
          return (
            <div
              key={s.id}
              style={{
                background: "var(--color-ui-bg-subtle)",
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <Heading level="h3" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{s.emoji}</span>{" "}
                  <span style={{ color: theme.accent }}>{s.title}</span>{" "}
                  <Badge color="grey">{s.links.length}</Badge>
                </Heading>
                <Text size="small" className="text-ui-fg-muted">{s.subtitle}</Text>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 8,
                }}
              >
                {s.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      padding: "10px 12px",
                      background: "var(--color-ui-bg-base)",
                      border: "1px solid var(--color-ui-border-base, #2e2e32)",
                      borderRadius: 8,
                      color: "inherit",
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                    }}
                    title={l.description}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.accent
                      e.currentTarget.style.transform = "translateY(-1px)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-ui-border-base, #2e2e32)"
                      e.currentTarget.style.transform = "translateY(0)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: l.description ? 2 : 0 }}>
                      <span style={{ fontSize: 16 }}>{l.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{l.label}</span>
                      {l.badge && <Badge color="grey" style={{ marginLeft: "auto" }}>{l.badge}</Badge>}
                      <span style={{ marginLeft: l.badge ? 0 : "auto", fontSize: 10, color: "#888" }}>↗</span>
                    </div>
                    {l.description && (
                      <Text size="xsmall" className="text-ui-fg-muted" style={{ lineHeight: 1.3 }}>
                        {l.description}
                      </Text>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "🔗 Tools",
  icon: BuildingTax,
})
