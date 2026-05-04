"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { useState, useEffect } from "react"
import { Tools } from "@medusajs/icons"

const API = "https://api.enrola.shop"

type DevTabId = "jobs" | "flags" | "errors" | "llm" | "services" | "deploy"

const TABS: Array<{ id: DevTabId; label: string; emoji: string; available: boolean }> = [
  { id: "jobs", label: "Cron Jobs", emoji: "📋", available: true },
  { id: "flags", label: "Feature Flags", emoji: "🎛", available: true },
  { id: "errors", label: "Errors", emoji: "🐛", available: true },
  { id: "llm", label: "LLM Observability", emoji: "🤖", available: true },
  { id: "services", label: "Services Health", emoji: "🔧", available: true },
  { id: "deploy", label: "Deploy", emoji: "🚀", available: true },
]

export default function DevPage() {
  const [tab, setTab] = useState<DevTabId>("jobs")

  return (
    <Container>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Tools />
        <Heading level="h1">DEV</Heading>
        <Badge color="grey">Ops dashboard</Badge>
      </div>
      <Text size="small" className="text-ui-fg-muted" style={{ marginBottom: 20 }}>
        Herramientas operativas: cron jobs, feature flags, errores, LLM costs, salud de servicios.
      </Text>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-ui-border-base, #2e2e32)", marginBottom: 24, overflowX: "auto" }}>
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => t.available && setTab(t.id)}
              disabled={!t.available}
              style={{
                padding: "10px 14px",
                background: "transparent", border: "none",
                borderBottom: active ? "2px solid var(--color-ui-fg-interactive, #ff7a00)" : "2px solid transparent",
                color: active ? "var(--color-ui-fg-base, #fff)" : t.available ? "var(--color-ui-fg-muted, #a0a0a0)" : "#555",
                cursor: t.available ? "pointer" : "not-allowed", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 6, fontSize: 13,
              }}
              title={!t.available ? "Próximamente" : undefined}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
              {!t.available && <span style={{ fontSize: 10, color: "#666" }}>(próx.)</span>}
            </button>
          )
        })}
      </div>

      {tab === "jobs" && <JobsTab />}
      {tab === "flags" && <FlagsTab />}
      {tab === "errors" && <ErrorsTab />}
      {tab === "llm" && <LlmTab />}
      {tab === "services" && <ServicesTab />}
      {tab === "deploy" && <DeployTab />}
    </Container>
  )
}

// ─── Deploy / runtime info ───────────────────────────────────────────────────
function DeployTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`${API}/admin/dev/deploy`, { credentials: "include" })
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading && !data) return <Text>Cargando runtime info…</Text>
  if (!data) return <Text>Error.</Text>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text size="small" className="text-ui-fg-muted">
          Info del proceso Medusa + recursos del contenedor + DB. Para ver stats de Docker container se requiere socket mount (no expuesto por seguridad).
        </Text>
        <button onClick={load} style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", cursor: "pointer", fontSize: 12 }}>↻ Refresh</button>
      </div>

      {/* Top: process + build */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel title="🖥 Proceso Medusa">
          <Row k="Node" v={data.process.node_version} />
          <Row k="Platform" v={`${data.process.platform} / ${data.process.arch}`} />
          <Row k="PID" v={String(data.process.pid)} />
          <Row k="Uptime" v={data.process.uptime_human} />
        </Panel>
        <Panel title="🚀 Build">
          <Row k="NODE_ENV" v={data.build.node_env} />
          <Row k="Git SHA" v={data.build.git_sha || <span style={{ color: "#888" }}>no inyectado</span>} />
          <Row k="Image tag" v={data.build.image_tag || <span style={{ color: "#888" }}>no inyectado</span>} />
          <Row k="Build date" v={data.build.build_date || <span style={{ color: "#888" }}>no inyectado</span>} />
        </Panel>
      </div>

      {/* Memory + system */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel title="💾 Memoria del proceso">
          <Row k="RSS" v={data.memory.rss} />
          <Row k="Heap used" v={data.memory.heap_used} />
          <Row k="Heap total" v={data.memory.heap_total} />
          <Row k="External" v={data.memory.external} />
        </Panel>
        <Panel title="🖥 Sistema del host">
          <Row k="Hostname" v={data.system.hostname} />
          <Row k="CPUs" v={String(data.system.cpus)} />
          <Row k="Total memory" v={data.system.total_memory} />
          <Row k="Free memory" v={data.system.free_memory} />
          <Row k="Load avg" v={data.system.load_avg.join(" · ")} />
        </Panel>
      </div>

      {/* DB */}
      <Panel title="🗄 Base de datos">
        <Row k="Conexión" v={<Badge color={data.db.connected ? "green" : "red"}>{data.db.connected ? "OK" : "DOWN"}</Badge>} />
        <Row k="Latencia" v={`${data.db.latency_ms}ms`} />
        <Row k="Tamaño total" v={data.db.size} />
      </Panel>

      {/* Top tables */}
      <div>
        <Heading level="h3" style={{ marginBottom: 6 }}>📊 Tablas más grandes</Heading>
        <MiniTableDev
          headers={["Tabla", "Filas", "Tamaño"]}
          rows={data.top_tables.map((t: any) => [
            <code style={{ fontSize: 12 }}>{t.table}</code>,
            fmtNumDev(t.rows),
            t.size,
          ])}
        />
      </div>

      {/* Dep versions */}
      {Object.keys(data.key_deps || {}).length > 0 && (
        <Panel title="📦 Dependencias clave">
          {Object.entries(data.key_deps).map(([k, v]) => (
            <Row key={k} k={k} v={<code style={{ fontSize: 11 }}>{String(v)}</code>} />
          ))}
        </Panel>
      )}

      <Text size="xsmall" className="text-ui-fg-muted" style={{ textAlign: "right" }}>
        Check {new Date(data.checked_at).toLocaleTimeString()}
      </Text>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 10, padding: 14 }}>
      <Text size="small" style={{ fontWeight: 600, marginBottom: 8 }}>{title}</Text>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, gap: 10 }}>
      <span style={{ color: "#888" }}>{k}</span>
      <span style={{ fontFamily: "monospace", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{v}</span>
    </div>
  )
}

// ─── LLM Observability tab ───────────────────────────────────────────────────
function LlmTab() {
  const [data, setData] = useState<any>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/admin/dev/posthog/llm?days=${days}`, { credentials: "include" })
      .then((r) => r.json()).then(setData).finally(() => setLoading(false))
  }, [days])

  if (loading) return <Text>Cargando LLM data…</Text>
  if (!data?.configured) return <EmptyTab msg="PostHog admin no configurado." />

  const s = data.summary || {}
  const hasData = s.calls > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text size="small" className="text-ui-fg-muted">
          Eventos <code>$ai_generation</code> del bot WhatsApp (DeepSeek) + cualquier otro LLM instrumentado.
        </Text>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{ padding: "6px 10px", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", fontSize: 12 }}>
            <option value="1">24h</option>
            <option value="7">7d</option>
            <option value="30">30d</option>
            <option value="90">90d</option>
          </select>
          <a href={data.posthog_url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
            LLM en PostHog ↗
          </a>
        </div>
      </div>

      {!hasData ? (
        <EmptyTab msg="Sin eventos LLM aún. Haz que el bot WhatsApp conteste algo, o espera lag de ingestión en PostHog." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Kpi label="Llamadas" value={String(s.calls)} />
            <Kpi label="Costo total" value={`$${s.total_cost_usd.toFixed(4)}`} color="#10b981" />
            <Kpi label="Tokens totales" value={fmtNumDev(s.total_tokens)} />
            <Kpi label="Latencia media" value={`${s.avg_latency_s.toFixed(2)}s`} />
            <Kpi label="Errores" value={String(s.errors)} color={s.errors > 0 ? "#ef4444" : undefined} />
          </div>

          {data.by_model.length > 0 && (
            <div>
              <Heading level="h3" style={{ marginBottom: 6 }}>Por modelo</Heading>
              <MiniTableDev
                headers={["Modelo", "Calls", "Tokens in", "Tokens out", "Costo"]}
                rows={data.by_model.map((r: any) => [
                  <code style={{ fontSize: 12 }}>{r.model}</code>,
                  r.calls,
                  fmtNumDev(r.input_tokens),
                  fmtNumDev(r.output_tokens),
                  `$${r.cost_usd.toFixed(4)}`,
                ])}
              />
            </div>
          )}

          {data.top_conversations.length > 0 && (
            <div>
              <Heading level="h3" style={{ marginBottom: 6 }}>Top conversaciones caras</Heading>
              <MiniTableDev
                headers={["Distinct ID", "Calls", "Tokens", "Costo", "Purpose"]}
                rows={data.top_conversations.map((r: any) => [
                  <code style={{ fontSize: 11 }}>{r.distinct_id}</code>,
                  r.calls,
                  fmtNumDev(r.total_tokens),
                  `$${r.cost_usd.toFixed(4)}`,
                  <span style={{ fontSize: 11, color: "#888" }}>{r.purpose || "—"}</span>,
                ])}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Services Health tab ─────────────────────────────────────────────────────
function ServicesTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`${API}/admin/dev/health`, { credentials: "include" })
      .then((r) => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    const i = setInterval(load, 60000)
    return () => clearInterval(i)
  }, [])

  if (loading && !data) return <Text>Pingando servicios…</Text>
  if (!data) return <Text>Error.</Text>

  const renderCheck = (c: any) => (
    <div key={c.name} style={{
      background: "var(--color-ui-bg-base)",
      border: `1px solid ${c.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.4)"}`,
      padding: 12, borderRadius: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <strong style={{ fontSize: 13 }}>{c.label}</strong>
        <Badge color={c.ok ? "green" : "red"}>{c.ok ? "UP" : "DOWN"}</Badge>
      </div>
      <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>
        <code>{c.name}</code> · {c.status != null ? `HTTP ${c.status}` : "—"} · {c.latency_ms}ms
      </div>
      {c.error && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>{c.error}</div>}
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Badge color={data.summary.down === 0 ? "green" : "red"}>
            {data.summary.up}/{data.summary.total} UP
          </Badge>{" "}
          <Text size="xsmall" className="text-ui-fg-muted" style={{ display: "inline" }}>
            Último check: {new Date(data.checked_at).toLocaleTimeString()} · refresh cada 60s
          </Text>
        </div>
        <button onClick={load} style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", cursor: "pointer", fontSize: 12 }}>↻ Refresh</button>
      </div>

      <div>
        <Heading level="h3" style={{ marginBottom: 8 }}>🏠 Internos</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {(data.checks.internal || []).map(renderCheck)}
        </div>
      </div>

      <div>
        <Heading level="h3" style={{ marginBottom: 8 }}>☁️ Externos</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {(data.checks.external || []).map(renderCheck)}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", padding: 12, borderRadius: 10 }}>
      <Text size="xsmall" className="text-ui-fg-muted" style={{ display: "block", marginBottom: 4 }}>{label}</Text>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "inherit" }}>{value}</div>
    </div>
  )
}

function MiniTableDev({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "var(--color-ui-bg-subtle)" }}>
          <tr>{headers.map((h, i) => <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: 8, fontWeight: 600 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--color-ui-border-base, #2e2e32)", background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {row.map((cell, j) => <td key={j} style={{ padding: 8, textAlign: j === 0 ? "left" : "right" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function fmtNumDev(n: number | null | undefined): string {
  if (n == null) return "—"
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k"
  return String(Math.round(n))
}

// ─── Feature Flags tab ────────────────────────────────────────────────────────
type FeatureFlag = {
  id: number
  key: string
  name?: string
  active: boolean
  created_at: string
  created_by?: { email?: string } | null
  filters?: { groups?: Array<{ rollout_percentage?: number | null }> }
}

function FlagsTab() {
  const [data, setData] = useState<{ configured: boolean; count?: number; flags?: FeatureFlag[]; posthog_url?: string; message?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`${API}/admin/dev/posthog/flags`, { credentials: "include" })
      .then((r) => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function toggle(id: number, active: boolean) {
    setBusyId(id)
    await fetch(`${API}/admin/dev/posthog/flags`, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, active }),
    })
    setBusyId(null)
    load()
  }

  async function setRollout(id: number, rollout: number) {
    setBusyId(id)
    await fetch(`${API}/admin/dev/posthog/flags`, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, rollout }),
    })
    setBusyId(null)
    load()
  }

  if (loading) return <Text>Cargando feature flags…</Text>
  if (!data?.configured) return <EmptyTab msg={data?.message || "PostHog admin no configurado."} />

  const flags = data.flags || []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text size="small" className="text-ui-fg-muted">
          {flags.length} flag{flags.length !== 1 ? "s" : ""} · {flags.filter((f) => f.active).length} activas
        </Text>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", cursor: "pointer", fontSize: 12 }}>↻ Refresh</button>
          <a href={data.posthog_url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
            + Nueva en PostHog ↗
          </a>
        </div>
      </div>

      {flags.length === 0 ? (
        <EmptyTab msg="Aún no has creado flags. Crea una en PostHog y aparecerá aquí." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {flags.map((f) => {
            const rollout = f.filters?.groups?.[0]?.rollout_percentage ?? 100
            return (
              <div key={f.id} style={{ background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <code style={{ fontSize: 13, fontWeight: 600 }}>{f.key}</code>
                      <Badge color={f.active ? "green" : "grey"}>{f.active ? "ON" : "OFF"}</Badge>
                      <Badge color="blue">{rollout}%</Badge>
                    </div>
                    {f.name && f.name !== f.key && (
                      <Text size="small" className="text-ui-fg-muted">{f.name}</Text>
                    )}
                    <Text size="xsmall" className="text-ui-fg-muted" style={{ marginTop: 4 }}>
                      creada {new Date(f.created_at).toLocaleDateString()}
                      {f.created_by?.email && ` por ${f.created_by.email}`}
                    </Text>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <select
                      value={rollout}
                      onChange={(e) => setRollout(f.id, parseInt(e.target.value, 10))}
                      disabled={busyId === f.id || !f.active}
                      style={{ padding: "6px 10px", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", fontSize: 12 }}
                    >
                      {[0, 1, 5, 10, 25, 50, 75, 100].map((pct) => (
                        <option key={pct} value={pct}>{pct}%</option>
                      ))}
                    </select>
                    <button
                      onClick={() => toggle(f.id, !f.active)}
                      disabled={busyId === f.id}
                      style={{
                        padding: "6px 12px",
                        background: f.active ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                        border: `1px solid ${f.active ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
                        borderRadius: 6, cursor: "pointer", color: "inherit", fontSize: 12, fontWeight: 600,
                      }}
                    >{busyId === f.id ? "…" : (f.active ? "Turn OFF" : "Turn ON")}</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Errors tab ──────────────────────────────────────────────────────────────
type ErrorIssue = { type?: string; message?: string; url?: string; count: number; last_seen: string; distinct_id?: string }

function ErrorsTab() {
  const [data, setData] = useState<{ configured: boolean; errors?: ErrorIssue[]; posthog_url?: string; days?: number } | null>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/admin/dev/posthog/errors?days=${days}`, { credentials: "include" })
      .then((r) => r.json()).then(setData).finally(() => setLoading(false))
  }, [days])

  if (loading) return <Text>Cargando errores…</Text>
  if (!data?.configured) return <EmptyTab msg="PostHog admin no configurado." />

  const errors = data.errors || []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text size="small" className="text-ui-fg-muted">
          Capturados vía <code>$exception</code> del posthog-js autocapture. Los stack traces completos están en PostHog.
        </Text>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{ padding: "6px 10px", background: "var(--color-ui-bg-base)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", fontSize: 12 }}>
            <option value="1">24h</option>
            <option value="7">7d</option>
            <option value="30">30d</option>
          </select>
          <a href={data.posthog_url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", background: "var(--color-ui-fg-interactive, #ff7a00)", color: "#fff", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
            Abrir en PostHog ↗
          </a>
        </div>
      </div>

      {errors.length === 0 ? (
        <EmptyTab msg="Sin errores capturados en este periodo. ✅" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {errors.map((e, i) => (
            <div key={i} style={{ background: "var(--color-ui-bg-base)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <Badge color="red">{e.type || "Error"}</Badge>
                    <Badge color="grey">{e.count} evento{e.count !== 1 ? "s" : ""}</Badge>
                    <Text size="xsmall" className="text-ui-fg-muted">{new Date(e.last_seen).toLocaleString()}</Text>
                  </div>
                  {e.message && (
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ef4444", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis" }}>{e.message.slice(0, 200)}</div>
                  )}
                  {e.url && (
                    <Text size="xsmall" className="text-ui-fg-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.url}
                    </Text>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyTab({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", background: "var(--color-ui-bg-subtle)", border: "1px dashed var(--color-ui-border-base, #2e2e32)", borderRadius: 12 }}>
      <Text size="small" className="text-ui-fg-muted">{msg}</Text>
    </div>
  )
}

// ─── Jobs tab ────────────────────────────────────────────────────────────────
type JobRow = {
  name: string
  schedule: string | null
  description: string
  category: string
  gated_by: string | null
  in_registry: boolean
  last_run: { started_at: string; finished_at: string | null; status: string; duration_ms: number | null; error_message: string | null } | null
  last_success_at: string | null
  last_error: { started_at: string; error_message: string | null } | null
  stats_7d: { success: number; error: number; skipped: number; total: number; avg_duration_ms: number | null }
  next_run_utc: string | null
  health: "healthy" | "warn" | "error" | "never_ran"
}

function JobsTab() {
  const [data, setData] = useState<{ total: number; summary: any; jobs: JobRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const load = () => {
    setLoading(true)
    fetch(`${API}/admin/dev/jobs`, { credentials: "include" })
      .then((r) => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return <Text>Cargando jobs…</Text>
  if (!data) return <Text>Error cargando.</Text>

  const jobs = data.jobs.filter((j) => {
    if (filter !== "all" && j.health !== filter) return false
    if (categoryFilter !== "all" && j.category !== categoryFilter) return false
    return true
  })

  const categories = Array.from(new Set(data.jobs.map((j) => j.category)))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <SummaryCard label="Total" value={data.total} color="grey" active={filter === "all"} onClick={() => setFilter("all")} />
        <SummaryCard label="✅ Healthy" value={data.summary.healthy} color="green" active={filter === "healthy"} onClick={() => setFilter("healthy")} />
        <SummaryCard label="⚠️ Warn" value={data.summary.warn} color="orange" active={filter === "warn"} onClick={() => setFilter("warn")} />
        <SummaryCard label="❌ Error" value={data.summary.error} color="red" active={filter === "error"} onClick={() => setFilter("error")} />
        <SummaryCard label="⚫ Never ran" value={data.summary.never_ran} color="grey" active={filter === "never_ran"} onClick={() => setFilter("never_ran")} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Text size="small" className="text-ui-fg-muted">Categoría:</Text>
        <button onClick={() => setCategoryFilter("all")} style={catBtnStyle(categoryFilter === "all")}>todas</button>
        {categories.map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c)} style={catBtnStyle(categoryFilter === c)}>{c}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={load} style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 6, color: "inherit", cursor: "pointer", fontSize: 12 }}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "var(--color-ui-bg-subtle)" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10, width: 30 }}></th>
              <th style={{ textAlign: "left", padding: 10 }}>Job</th>
              <th style={{ textAlign: "left", padding: 10, width: 110 }}>Schedule</th>
              <th style={{ textAlign: "left", padding: 10, width: 160 }}>Last run</th>
              <th style={{ textAlign: "left", padding: 10, width: 160 }}>Next (UTC)</th>
              <th style={{ textAlign: "right", padding: 10, width: 130 }}>7d stats</th>
              <th style={{ textAlign: "right", padding: 10, width: 90 }}>Avg dur.</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j, i) => (
              <tr key={j.name} style={{ borderTop: "1px solid var(--color-ui-border-base, #2e2e32)", background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                <td style={{ padding: 10, textAlign: "center" }}>{healthEmoji(j.health)}</td>
                <td style={{ padding: 10 }}>
                  <div style={{ fontWeight: 600, fontFamily: "monospace" }}>{j.name}</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                    {j.description}
                    {j.gated_by && <> · <code>{j.gated_by}</code></>}
                    {!j.in_registry && <> · <span style={{ color: "#ef4444" }}>huérfano</span></>}
                  </div>
                  {j.last_error && j.health === "error" && (
                    <div style={{ marginTop: 4, fontSize: 10, color: "#ef4444", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}
                      title={j.last_error.error_message || ""}>
                      ↳ {j.last_error.error_message?.slice(0, 120)}
                    </div>
                  )}
                </td>
                <td style={{ padding: 10, fontFamily: "monospace", fontSize: 11, color: "#aaa" }}>{j.schedule || "—"}</td>
                <td style={{ padding: 10 }}>
                  {j.last_run ? (
                    <>
                      <div style={{ fontSize: 11 }}>{timeAgo(j.last_run.started_at)}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>
                        <Badge color={statusColor(j.last_run.status)}>{j.last_run.status}</Badge>{" "}
                        {j.last_run.duration_ms != null ? `${j.last_run.duration_ms}ms` : ""}
                      </div>
                    </>
                  ) : <span style={{ color: "#888" }}>never</span>}
                </td>
                <td style={{ padding: 10, fontSize: 11, color: "#aaa" }}>
                  {j.next_run_utc ? new Date(j.next_run_utc).toISOString().slice(5, 16).replace("T", " ") : "—"}
                </td>
                <td style={{ padding: 10, textAlign: "right", fontSize: 11 }}>
                  <span style={{ color: "#10b981" }}>{j.stats_7d.success}✓</span>{" "}
                  <span style={{ color: "#ef4444" }}>{j.stats_7d.error}✗</span>{" "}
                  <span style={{ color: "#888" }}>{j.stats_7d.skipped}⏸</span>
                </td>
                <td style={{ padding: 10, textAlign: "right", fontSize: 11, color: "#aaa" }}>
                  {j.stats_7d.avg_duration_ms != null ? `${j.stats_7d.avg_duration_ms}ms` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 12 }}>Sin jobs que coincidan con el filtro.</div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, active, onClick }: { label: string; value: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "var(--color-ui-bg-base)",
      border: `1px solid ${active ? "var(--color-ui-fg-interactive, #ff7a00)" : "var(--color-ui-border-base, #2e2e32)"}`,
      padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left", color: "inherit",
    }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </button>
  )
}

function catBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    background: active ? "var(--color-ui-fg-interactive, #ff7a00)" : "transparent",
    color: active ? "#fff" : "inherit",
    border: "1px solid var(--color-ui-border-base, #2e2e32)",
    borderRadius: 4, cursor: "pointer", fontSize: 11, textTransform: "lowercase",
  }
}

function healthEmoji(h: string): string {
  switch (h) {
    case "healthy": return "✅"
    case "warn": return "⚠️"
    case "error": return "❌"
    case "never_ran": return "⚫"
    default: return "•"
  }
}

function statusColor(s: string): "green" | "red" | "orange" | "grey" | "blue" {
  if (s === "success") return "green"
  if (s === "error") return "red"
  if (s === "skipped") return "grey"
  if (s === "running") return "blue"
  return "grey"
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `hace ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

function PlaceholderTab() {
  return (
    <div style={{ padding: 40, textAlign: "center", background: "var(--color-ui-bg-subtle)", border: "1px dashed var(--color-ui-border-base, #2e2e32)", borderRadius: 12 }}>
      <Heading level="h3" style={{ marginBottom: 8 }}>Próximamente</Heading>
      <Text size="small" className="text-ui-fg-muted">Este módulo se activa en los siguientes batches del plan PostHog.</Text>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "🔧 DEV",
  icon: Tools,
})
