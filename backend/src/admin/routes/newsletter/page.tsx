"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { useState, useEffect } from "react"

type Subscriber = {
  id: number
  email: string
  name: string
  status: string
  created_at: string
}

type List = {
  id: number
  name: string
  type: string
  subscriber_count: number
}

type Campaign = {
  id: number
  name: string
  status: string
  subject: string
  created_at: string
  send_at: string
}

type NewsletterData = {
  total_subscribers: number
  enabled_subscribers: number
  total_lists: number
  total_campaigns: number
  recent_subscribers: Subscriber[]
  lists: List[]
  recent_campaigns: Campaign[]
  listmonk_url: string
}

const CAMPAIGN_BADGE: Record<string, "orange" | "green" | "red" | "purple" | "blue" | "grey"> = {
  draft: "grey",
  scheduled: "orange",
  running: "blue",
  finished: "green",
  cancelled: "red",
  paused: "orange",
}

const STATUS_BADGE: Record<string, "green" | "red" | "orange" | "grey"> = {
  enabled: "green",
  disabled: "grey",
  blocklisted: "red",
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Container className="flex-1 min-w-[140px] p-5 flex flex-col gap-1">
      <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase tracking-wider">
        {label}
      </Text>
      <p className="text-3xl font-bold text-ui-fg-base leading-none mt-1">{value}</p>
      {sub && <Text size="xsmall" className="text-ui-fg-subtle mt-1">{sub}</Text>}
    </Container>
  )
}

function NewsletterPage() {
  const [data, setData] = useState<NewsletterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/admin/newsletter", { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header */}
      <Container className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Newsletter</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            Suscriptores y campañas via Listmonk
          </Text>
        </div>
        <a
          href={data?.listmonk_url ?? "https://newsletter.enrola.shop/admin"}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            background: "#BB3B2E",
            color: "#fff",
            textDecoration: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ↗ Abrir Listmonk
        </a>
      </Container>

      {error && (
        <Container className="px-6 py-3" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
          <Text className="text-red-600">
            Error al conectar con Listmonk: {error}. ¿Está el servicio corriendo?
          </Text>
        </Container>
      )}

      {/* KPIs */}
      <div className="flex gap-4 flex-wrap">
        <KPICard
          label="Suscriptores"
          value={loading ? "…" : data?.total_subscribers ?? 0}
          sub="total registrados"
        />
        <KPICard
          label="Activos"
          value={loading ? "…" : data?.enabled_subscribers ?? 0}
          sub="habilitados"
        />
        <KPICard
          label="Listas"
          value={loading ? "…" : data?.total_lists ?? 0}
          sub="de distribución"
        />
        <KPICard
          label="Campañas"
          value={loading ? "…" : data?.total_campaigns ?? 0}
          sub="total enviadas"
        />
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        {/* Lists */}
        <Container className="flex-1 min-w-[260px] px-6 py-5 flex flex-col gap-4">
          <Heading level="h2">Listas</Heading>
          {loading ? (
            <Text className="text-ui-fg-muted">Cargando…</Text>
          ) : !data?.lists.length ? (
            <Text className="text-ui-fg-muted">Sin listas creadas</Text>
          ) : (
            <div className="flex flex-col gap-2">
              {data.lists.map(list => (
                <div
                  key={list.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 6,
                    background: "var(--bg-subtle, #f9fafb)",
                    border: "1px solid var(--border-base, #e5e7eb)",
                  }}
                >
                  <div>
                    <Text size="small" weight="plus">{list.name}</Text>
                    <Text size="xsmall" className="text-ui-fg-muted capitalize">{list.type}</Text>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Text size="small" weight="plus">{list.subscriber_count.toLocaleString()}</Text>
                    <Text size="xsmall" className="text-ui-fg-muted">suscriptores</Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>

        {/* Recent Campaigns */}
        <Container className="flex-1 min-w-[300px] px-6 py-5 flex flex-col gap-4">
          <Heading level="h2">Últimas campañas</Heading>
          {loading ? (
            <Text className="text-ui-fg-muted">Cargando…</Text>
          ) : !data?.recent_campaigns.length ? (
            <Text className="text-ui-fg-muted">Sin campañas aún</Text>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "6px 0", color: "#9ca3af", fontWeight: 500 }}>Campaña</th>
                  <th style={{ textAlign: "right", padding: "6px 0", color: "#9ca3af", fontWeight: 500 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_campaigns.map(c => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 0" }}>
                      <span style={{ color: "#374151", display: "block" }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        {new Date(c.created_at).toLocaleDateString("es-VE")}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", padding: "8px 0" }}>
                      <Badge color={CAMPAIGN_BADGE[c.status] ?? "grey"} size="2xsmall">
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Container>
      </div>

      {/* Recent Subscribers */}
      <Container className="px-6 py-5 flex flex-col gap-4">
        <Heading level="h2">Últimos suscriptores</Heading>
        {loading ? (
          <Text className="text-ui-fg-muted">Cargando…</Text>
        ) : !data?.recent_subscribers.length ? (
          <Text className="text-ui-fg-muted">Sin suscriptores aún</Text>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "6px 8px 6px 0", color: "#9ca3af", fontWeight: 500 }}>Email</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#9ca3af", fontWeight: 500 }}>Nombre</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#9ca3af", fontWeight: 500 }}>Estado</th>
                <th style={{ textAlign: "right", padding: "6px 0", color: "#9ca3af", fontWeight: 500 }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_subscribers.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 8px 8px 0", color: "#374151" }}>{s.email}</td>
                  <td style={{ padding: "8px", color: "#6b7280" }}>{s.name || "—"}</td>
                  <td style={{ textAlign: "right", padding: "8px" }}>
                    <Badge color={STATUS_BADGE[s.status] ?? "grey"} size="2xsmall">
                      {s.status}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right", padding: "8px 0", color: "#9ca3af", fontSize: 11 }}>
                    {new Date(s.created_at).toLocaleDateString("es-VE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Newsletter",
})

export default NewsletterPage
