"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui"
import { useState, useEffect } from "react"
import { ChartBar } from "@medusajs/icons"

type Period = "today" | "week" | "month" | "all"

type FunnelStep = {
  event: string
  label: string
  unique_phones: number
  total_events: number
  dropoff_pct: number | null
  conversion_from_top_pct: number
}

type FunnelData = {
  period: Period
  window_label: string
  steps: FunnelStep[]
  conversion: {
    greeting_to_submitted_pct: number
    greeting_to_completed_pct: number
    submitted_to_completed_pct: number
  }
  timing: {
    sec_greeting_to_first_item?: number
    sec_first_item_to_address?: number
    sec_address_to_proof?: number
    sec_proof_to_submitted?: number
    sec_full_journey?: number
  }
  hourly: Array<{ hour: number; count: number }>
  combo_distribution: Array<{ discount_pct: number; count: number }>
  abandoners: Array<{ phone: string; last_event_at: string }>
  objections: { detected: number; recovered: number; recovery_rate_pct: number }
  recovery: { sent: number; responded: number; response_rate_pct: number }
}

function formatSec(s?: number): string {
  if (!s || s <= 0) return "—"
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m ${s % 60}s`
  return `${Math.round(s / 3600)}h ${Math.round((s % 3600) / 60)}m`
}

const FunnelPage = () => {
  const [period, setPeriod] = useState<Period>("week")
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = async (p: Period) => {
    setLoading(true)
    try {
      const res = await fetch(`/admin/funnel?period=${p}`, { credentials: "include" })
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(period)
    const t = setInterval(() => fetchData(period), 30000)
    return () => clearInterval(t)
  }, [period])

  const maxStep = data?.steps?.[0]?.unique_phones || 1

  return (
    <Container>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Heading level="h1">📊 Funnel WhatsApp Bot</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Conversión por paso del flujo de Dana — refresh automático cada 30s
          </Text>
        </div>
        <div className="flex gap-2">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "primary" : "secondary"}
              size="small"
              onClick={() => setPeriod(p)}
            >
              {p === "today" ? "24h" : p === "week" ? "7d" : p === "month" ? "30d" : "Todo"}
            </Button>
          ))}
        </div>
      </div>

      {loading && !data && <Text>Cargando…</Text>}

      {data && (
        <>
          {/* Conversion summary */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <Container>
              <Text size="small" className="text-ui-fg-subtle">Saludo → Pedido</Text>
              <Heading level="h2" className="mt-1">{data.conversion.greeting_to_submitted_pct}%</Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                {data.steps.find(s => s.event === "order_submitted")?.unique_phones || 0} de{" "}
                {data.steps.find(s => s.event === "greeting_sent")?.unique_phones || 0}
              </Text>
            </Container>
            <Container>
              <Text size="small" className="text-ui-fg-subtle">Pedido → Completado</Text>
              <Heading level="h2" className="mt-1">{data.conversion.submitted_to_completed_pct}%</Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">% pagos verificados</Text>
            </Container>
            <Container>
              <Text size="small" className="text-ui-fg-subtle">Journey completo</Text>
              <Heading level="h2" className="mt-1">{formatSec(data.timing.sec_full_journey)}</Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">tiempo medio saludo → pedido</Text>
            </Container>
          </div>

          {/* Funnel bars */}
          <Container className="mb-6">
            <Heading level="h2" className="mb-4">Embudo paso a paso</Heading>
            <div className="space-y-2">
              {data.steps.map((step, i) => {
                const widthPct = maxStep > 0 ? (step.unique_phones / maxStep) * 100 : 0
                return (
                  <div key={step.event} className="flex items-center gap-3">
                    <div className="w-48 text-right">
                      <Text size="small">{step.label}</Text>
                    </div>
                    <div className="flex-1 relative h-8 bg-ui-bg-subtle rounded">
                      <div
                        className="absolute inset-y-0 left-0 bg-ui-bg-interactive rounded flex items-center px-2"
                        style={{ width: `${Math.max(widthPct, 1)}%` }}
                      >
                        <Text size="small" className="text-ui-fg-on-color font-mono">
                          {step.unique_phones}
                        </Text>
                      </div>
                    </div>
                    <div className="w-16 text-right">
                      <Badge size="small" color={step.conversion_from_top_pct > 50 ? "green" : step.conversion_from_top_pct > 20 ? "orange" : "red"}>
                        {step.conversion_from_top_pct}%
                      </Badge>
                    </div>
                    <div className="w-20 text-right">
                      {step.dropoff_pct !== null ? (
                        <Text size="xsmall" className={step.dropoff_pct > 50 ? "text-ui-fg-error" : "text-ui-fg-subtle"}>
                          ↓ {step.dropoff_pct}%
                        </Text>
                      ) : (
                        <Text size="xsmall" className="text-ui-fg-subtle">—</Text>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Container>

          {/* Timing per step */}
          <Container className="mb-6">
            <Heading level="h2" className="mb-3">Tiempo medio por etapa</Heading>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Saludo → Carrito</Text>
                <Text size="large">{formatSec(data.timing.sec_greeting_to_first_item)}</Text>
              </div>
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Carrito → Dirección</Text>
                <Text size="large">{formatSec(data.timing.sec_first_item_to_address)}</Text>
              </div>
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Dirección → Comprobante</Text>
                <Text size="large">{formatSec(data.timing.sec_address_to_proof)}</Text>
              </div>
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Comprobante → Pedido</Text>
                <Text size="large">{formatSec(data.timing.sec_proof_to_submitted)}</Text>
              </div>
            </div>
          </Container>

          {/* Combo distribution */}
          <Container className="mb-6">
            <Heading level="h2" className="mb-3">Distribución de descuento combo en pedidos cerrados</Heading>
            {data.combo_distribution.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">Sin pedidos en el período</Text>
            ) : (
              <div className="space-y-1">
                {data.combo_distribution.map((c) => (
                  <div key={c.discount_pct} className="flex justify-between">
                    <Text size="small">
                      {c.discount_pct === 0 ? "Sin combo" :
                       c.discount_pct === 30 ? "🏭 Mayorista 30%" :
                       `${c.discount_pct === 10 ? "✨" : c.discount_pct === 15 ? "⚡" : "💫"} Combo ${c.discount_pct}%`}
                    </Text>
                    <Text size="small" className="font-mono">{c.count}</Text>
                  </div>
                ))}
              </div>
            )}
          </Container>

          {/* Hourly distribution */}
          <Container className="mb-6">
            <Heading level="h2" className="mb-3">Saludos por hora del día (Caracas)</Heading>
            {data.hourly.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">Sin datos</Text>
            ) : (
              <div className="flex items-end gap-1 h-24">
                {Array.from({ length: 24 }).map((_, h) => {
                  const point = data.hourly.find((x) => x.hour === h)
                  const c = point?.count || 0
                  const max = Math.max(...data.hourly.map((x) => x.count), 1)
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center justify-end">
                      <div
                        className="w-full bg-ui-bg-interactive rounded-t"
                        style={{ height: `${(c / max) * 100}%`, minHeight: c > 0 ? 2 : 0 }}
                      />
                      <Text size="xsmall" className="text-ui-fg-subtle mt-1">{h}</Text>
                    </div>
                  )
                })}
              </div>
            )}
          </Container>

          {/* Recovery + Objection metrics */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <Container>
              <Heading level="h2" className="mb-2">🛟 Recovery (F1.1)</Heading>
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">Enviados</Text>
                  <Text size="large">{data.recovery.sent}</Text>
                </div>
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">Respondieron</Text>
                  <Text size="large">{data.recovery.responded}</Text>
                </div>
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">Tasa</Text>
                  <Text size="large">{data.recovery.response_rate_pct}%</Text>
                </div>
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle mt-2">
                Meta: ≥10%
              </Text>
            </Container>
            <Container>
              <Heading level="h2" className="mb-2">💬 Objeciones (F3.2)</Heading>
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">Detectadas</Text>
                  <Text size="large">{data.objections.detected}</Text>
                </div>
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">Recuperadas</Text>
                  <Text size="large">{data.objections.recovered}</Text>
                </div>
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">Tasa</Text>
                  <Text size="large">{data.objections.recovery_rate_pct}%</Text>
                </div>
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle mt-2">
                Meta: ≥30%
              </Text>
            </Container>
          </div>

          {/* Abandoners */}
          <Container>
            <Heading level="h2" className="mb-3">
              Abandonos en pago ({data.abandoners.length})
            </Heading>
            <Text size="xsmall" className="text-ui-fg-subtle mb-3">
              Vieron Pago Móvil pero no enviaron comprobante. Recovery (Batch 4) los contactará automáticamente.
            </Text>
            {data.abandoners.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">Sin abandonos en el período 🌸</Text>
            ) : (
              <div className="space-y-1">
                {data.abandoners.map((a) => (
                  <div key={a.phone} className="flex justify-between border-b border-ui-border-base py-1">
                    <Text size="small" className="font-mono">{a.phone}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {new Date(a.last_event_at).toLocaleString("es-VE")}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Container>
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Funnel Bot",
  icon: ChartBar,
})

export default FunnelPage
