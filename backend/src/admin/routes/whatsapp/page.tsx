import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Container, Heading, Text, Button, Input, Badge, Toaster, toast } from "@medusajs/ui"
import { useEffect, useState, useCallback } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

interface BotConfig {
  enabled: string
  bot_name: string
  human_timeout: string
  bot_timeout: string
  owner_phone: string
  wasender_key: string
  deepseek_key: string
  telegram_bot_token: string
  telegram_chat_id: string
  groq_key: string
  pago_movil_banco: string
  pago_movil_cedula: string
  pago_movil_telefono: string
  google_maps_key: string
}

interface Conversation {
  phone: string
  session_status: string
  customer_name: string | null
  last_message_at: string
  last_message: string | null
  message_count: string
}

interface Message {
  role: string
  content: string
  created_at: string
}

interface Stats {
  total_conversations: number
  total_messages: number
  active_24h: number
  messages_24h: number
}

type Tab = "dashboard" | "conversations" | "config"

const API = "/bot"

const apiFetch = (url: string, options?: RequestInit) =>
  fetch(url, { ...options, credentials: "include" })

// ─── Page ───────────────────────────────────────────────────────────────────

const WhatsAppBotPage = () => {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [config, setConfig] = useState<BotConfig | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [configForm, setConfigForm] = useState<Partial<BotConfig>>({})

  // ── Fetch data ──────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [cfgRes, statsRes, convRes] = await Promise.all([
        apiFetch(`${API}/config`),
        apiFetch(`${API}/stats`),
        apiFetch(`${API}/conversations`),
      ])
      if (cfgRes.ok) {
        const d = await cfgRes.json()
        setConfig(d.config)
        setConfigForm(d.config)
      }
      if (statsRes.ok) setStats(await statsRes.json())
      if (convRes.ok) {
        const d = await convRes.json()
        setConversations(d.conversations || [])
      }
    } catch {
      toast.error("Error cargando datos del bot")
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Load conversation messages ────────────────────────────────────

  const loadConversation = async (phone: string) => {
    setSelectedConvo(phone)
    try {
      const r = await apiFetch(`${API}/conversations?phone=${phone}`)
      if (r.ok) {
        const d = await r.json()
        setMessages(d.messages || [])
      }
    } catch {
      toast.error("Error cargando conversación")
    }
  }

  // ── Save config ───────────────────────────────────────────────────

  const saveConfig = async () => {
    try {
      const r = await apiFetch(`${API}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configForm),
      })
      if (r.ok) {
        const d = await r.json()
        setConfig(d.config)
        setConfigForm(d.config)
        toast.success("Configuración guardada")
      } else {
        const err = await r.text().catch(() => "")
        console.error("Save failed:", r.status, err)
        toast.error("Error: " + (r.status === 401 ? "No autorizado" : "Fallo al guardar"))
      }
    } catch {
      toast.error("Error guardando configuración")
    }
  }

  // ── Toggle bot ────────────────────────────────────────────────────

  const toggleBot = async () => {
    const newVal = config?.enabled === "true" ? "false" : "true"
    try {
      const r = await apiFetch(`${API}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newVal }),
      })
      if (r.ok) {
        const d = await r.json()
        setConfig(d.config)
        toast.success(newVal === "true" ? "Bot activado" : "Bot desactivado")
      }
    } catch {
      toast.error("Error cambiando estado")
    }
  }

  // ── Webhook URL ───────────────────────────────────────────────────

  const webhookUrl = "https://api.enrola.shop/webhooks/whatsapp"

  if (loading) {
    return (
      <Container className="p-8">
        <Heading level="h1">WhatsApp Bot</Heading>
        <Text className="mt-2 text-ui-fg-muted">Cargando...</Text>
      </Container>
    )
  }

  return (
    <Container className="p-8">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h1">WhatsApp Bot</Heading>
          <Text className="text-ui-fg-muted">
            Gestión del chatbot de atención al cliente
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Badge color={config?.enabled === "true" ? "green" : "red"}>
            {config?.enabled === "true" ? "● Activo" : "● Inactivo"}
          </Badge>
          <Button variant="secondary" onClick={toggleBot}>
            {config?.enabled === "true" ? "Desactivar" : "Activar"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-ui-border-base">
        {(["dashboard", "conversations", "config"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-ui-fg-base text-ui-fg-base"
                : "border-transparent text-ui-fg-muted hover:text-ui-fg-subtle"
            }`}
          >
            {t === "dashboard" ? "Dashboard" : t === "conversations" ? "Conversaciones" : "Configuración"}
          </button>
        ))}
      </div>

      {/* ── Dashboard tab ──────────────────────────────────────────── */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Conversaciones" value={stats?.total_conversations ?? 0} />
            <StatCard label="Mensajes total" value={stats?.total_messages ?? 0} />
            <StatCard label="Activas (24h)" value={stats?.active_24h ?? 0} />
            <StatCard label="Mensajes hoy" value={stats?.messages_24h ?? 0} />
          </div>

          {/* Webhook info */}
          <div className="bg-ui-bg-subtle rounded-lg p-4 border border-ui-border-base">
            <Text className="text-sm font-medium mb-1">Webhook URL (configurar en WaSenderAPI)</Text>
            <code className="text-xs bg-ui-bg-base px-2 py-1 rounded block break-all">
              {webhookUrl}
            </code>
          </div>

          {/* Health checks */}
          <div className="bg-ui-bg-subtle rounded-lg p-4 border border-ui-border-base">
            <Text className="text-sm font-medium mb-3">Estado del sistema</Text>
            <div className="space-y-2">
              <HealthRow label="WaSenderAPI Key" ok={!!config?.wasender_key && config.wasender_key !== ""} />
              <HealthRow label="DeepSeek API Key" ok={!!config?.deepseek_key && config.deepseek_key !== ""} />
              <HealthRow label="Teléfono del dueño" ok={!!config?.owner_phone && config.owner_phone !== ""} />
              <HealthRow label="Bot habilitado" ok={config?.enabled === "true"} />
            </div>
          </div>
        </div>
      )}

      {/* ── Conversations tab ──────────────────────────────────────── */}
      {tab === "conversations" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: 400 }}>
          {/* Conversation list */}
          <div className="border border-ui-border-base rounded-lg overflow-hidden">
            <div className="bg-ui-bg-subtle p-3 border-b border-ui-border-base">
              <Text className="text-sm font-medium">Conversaciones recientes</Text>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 500 }}>
              {conversations.length === 0 ? (
                <Text className="p-4 text-ui-fg-muted text-sm">Sin conversaciones aún</Text>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.phone}
                    onClick={() => loadConversation(c.phone)}
                    className={`w-full text-left p-3 border-b border-ui-border-base hover:bg-ui-bg-subtle transition-colors ${
                      selectedConvo === c.phone ? "bg-ui-bg-subtle-hover" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Text className="text-sm font-medium">
                        {c.customer_name || c.phone}
                      </Text>
                      <Badge color={c.session_status === "bot_active" ? "blue" : "orange"} className="text-[10px]">
                        {c.session_status === "bot_active" ? "Bot" : "Humano"}
                      </Badge>
                    </div>
                    <Text className="text-xs text-ui-fg-muted mt-0.5 truncate">
                      {c.last_message || "..."}
                    </Text>
                    <Text className="text-[10px] text-ui-fg-disabled mt-0.5">
                      {c.message_count} msgs · {timeAgo(c.last_message_at)}
                    </Text>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message view */}
          <div className="md:col-span-2 border border-ui-border-base rounded-lg overflow-hidden">
            <div className="bg-ui-bg-subtle p-3 border-b border-ui-border-base">
              <Text className="text-sm font-medium">
                {selectedConvo ? `Chat con ${selectedConvo}` : "Selecciona una conversación"}
              </Text>
            </div>
            <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: 500 }}>
              {!selectedConvo ? (
                <Text className="text-ui-fg-muted text-sm">← Selecciona una conversación para ver los mensajes</Text>
              ) : messages.length === 0 ? (
                <Text className="text-ui-fg-muted text-sm">Sin mensajes</Text>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                        m.role === "user"
                          ? "bg-ui-bg-subtle text-ui-fg-base"
                          : m.role === "human"
                          ? "bg-orange-100 text-orange-900"
                          : "bg-blue-100 text-blue-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-medium uppercase opacity-60">
                          {m.role === "user" ? "Cliente" : m.role === "human" ? "Admin" : "Bot"}
                        </span>
                        <span className="text-[10px] opacity-40">
                          {new Date(m.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Config tab ─────────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="space-y-6 max-w-xl">
          <ConfigField
            label="Nombre del bot"
            value={configForm.bot_name || ""}
            onChange={(v) => setConfigForm({ ...configForm, bot_name: v })}
            placeholder="Enrola Bot"
          />
          <ConfigField
            label="WaSenderAPI Key"
            value={configForm.wasender_key || ""}
            onChange={(v) => setConfigForm({ ...configForm, wasender_key: v })}
            placeholder="Bearer token de WaSenderAPI"
            sensitive
          />
          <ConfigField
            label="DeepSeek API Key"
            value={configForm.deepseek_key || ""}
            onChange={(v) => setConfigForm({ ...configForm, deepseek_key: v })}
            placeholder="sk-..."
            sensitive
          />
          <ConfigField
            label="Teléfono del dueño (notificaciones)"
            value={configForm.owner_phone || ""}
            onChange={(v) => setConfigForm({ ...configForm, owner_phone: v })}
            placeholder="34612345678"
          />
          <ConfigField
            label="Timeout sesión humana (minutos)"
            value={configForm.human_timeout || "30"}
            onChange={(v) => setConfigForm({ ...configForm, human_timeout: v })}
            placeholder="30"
          />
          <ConfigField
            label="Timeout sesión bot (minutos)"
            value={configForm.bot_timeout || "120"}
            onChange={(v) => setConfigForm({ ...configForm, bot_timeout: v })}
            placeholder="120"
          />

          <div className="border-t border-ui-border-base my-4 pt-4">
            <Text className="text-ui-fg-subtle font-medium mb-3">Telegram (notificaciones de pedidos)</Text>
          </div>
          <ConfigField
            label="Telegram Bot Token"
            value={configForm.telegram_bot_token || ""}
            onChange={(v) => setConfigForm({ ...configForm, telegram_bot_token: v })}
            placeholder="123456:ABCdef..."
            sensitive
          />
          <ConfigField
            label="Telegram Chat ID"
            value={configForm.telegram_chat_id || ""}
            onChange={(v) => setConfigForm({ ...configForm, telegram_chat_id: v })}
            placeholder="-1001234567890"
          />

          <div className="border-t border-ui-border-base my-4 pt-4">
            <Text className="text-ui-fg-subtle font-medium mb-3">Notas de voz (Groq Whisper)</Text>
          </div>
          <ConfigField
            label="Groq API Key"
            value={configForm.groq_key || ""}
            onChange={(v) => setConfigForm({ ...configForm, groq_key: v })}
            placeholder="gsk_..."
            sensitive
          />

          <div className="border-t border-ui-border-base my-4 pt-4">
            <Text className="text-ui-fg-subtle text-xs">Pago Móvil: Banco de Venezuela | 21028734 | 04244043276 (hardcoded en checkout)</Text>
          </div>

          <Button onClick={saveConfig}>Guardar configuración</Button>
        </div>
      )}
    </Container>
  )
}

// ─── Helper components ──────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ui-bg-subtle rounded-lg p-4 border border-ui-border-base text-center">
      <Text className="text-2xl font-bold">{value}</Text>
      <Text className="text-xs text-ui-fg-muted mt-1">{label}</Text>
    </div>
  )
}

function HealthRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <Text className="text-sm">{label}</Text>
      <Badge color={ok ? "green" : "red"} className="text-[10px]">
        {ok ? "✓ OK" : "✗ Falta"}
      </Badge>
    </div>
  )
}

function ConfigField({
  label,
  value,
  onChange,
  placeholder,
  sensitive,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  sensitive?: boolean
}) {
  return (
    <div>
      <Text className="text-sm font-medium mb-1">{label}</Text>
      <Input
        type={sensitive ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export const config = defineRouteConfig({
  label: "WhatsApp Bot",
  icon: ChatBubbleLeftRight,
})

export default WhatsAppBotPage
