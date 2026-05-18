"use client"

import { useState, useEffect, useRef, useCallback, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Search, MessageCircle, User, Bot, AlertCircle, CheckCircle2,
  Send, Sparkles, Hand, Edit3, ArrowLeft, Eye, FileText, Receipt, Image as ImageIcon, MapPin, IdCard,
} from "lucide-react"
import type { DanaConversation, DanaMessage } from "@/lib/medusa"
import { setStatusAction, sendMessageAction, previewAsDanaAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

const POLL_INTERVAL_LIST_MS = 10_000
const POLL_INTERVAL_THREAD_MS = 6_000

export function DanaWorkspace({
  initialConversations,
  initialStatus,
  initialQuery,
  selectedPhone,
}: {
  initialConversations: DanaConversation[]
  initialTotal: number
  initialStatus: "bot_active" | "human_active" | "all"
  initialQuery: string
  selectedPhone?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [conversations, setConversations] = useState(initialConversations)
  const [statusFilter, setStatusFilter] = useState<"bot_active" | "human_active" | "all">(initialStatus)
  const [search, setSearch] = useState(initialQuery)
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [toast, setToast] = useState<Toast>(null)

  const [activePhone, setActivePhone] = useState<string | undefined>(selectedPhone)
  const [activeConv, setActiveConv] = useState<DanaConversation | null>(
    selectedPhone ? initialConversations.find((c) => c.phone === selectedPhone) ?? null : null
  )
  const [messages, setMessages] = useState<DanaMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  // Sync activePhone with the URL ?phone= param so a refresh keeps the
  // selection. We only push when the user clicks a list item — polling
  // updates won't navigate.
  function selectPhone(phone: string | undefined) {
    setActivePhone(phone)
    const sp = new URLSearchParams(searchParams?.toString())
    if (phone) sp.set("phone", phone)
    else sp.delete("phone")
    router.replace(`${pathname}?${sp.toString()}`)
  }

  // ─── Polling lista ────────────────────────────────────────────────
  useEffect(() => {
    let stop = false
    async function refresh() {
      try {
        const res = await fetch(
          `/api/dana/conversations?status=${statusFilter}&q=${encodeURIComponent(search)}&limit=50`,
          { cache: "no-store" }
        )
        if (!res.ok) return
        const data = (await res.json()) as { conversations: DanaConversation[]; total: number }
        if (!stop) setConversations(data.conversations)
      } catch { /* swallow polling errors */ }
    }
    const id = setInterval(refresh, POLL_INTERVAL_LIST_MS)
    return () => { stop = true; clearInterval(id) }
  }, [statusFilter, search])

  // Re-fetch list immediately when filter or search changes
  useEffect(() => {
    let stop = false
    async function refreshNow() {
      try {
        const res = await fetch(
          `/api/dana/conversations?status=${statusFilter}&q=${encodeURIComponent(search)}&limit=50`,
          { cache: "no-store" }
        )
        if (!res.ok) return
        const data = (await res.json()) as { conversations: DanaConversation[]; total: number }
        if (!stop) setConversations(data.conversations)
      } catch { /* */ }
    }
    refreshNow()
    return () => { stop = true }
  }, [statusFilter, search])

  // ─── Polling thread activo ────────────────────────────────────────
  const fetchThread = useCallback(async (phone: string, silent: boolean) => {
    if (!silent) setThreadLoading(true)
    try {
      const res = await fetch(`/api/dana/conversation/${encodeURIComponent(phone)}`, { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { conversation: DanaConversation; messages: DanaMessage[] }
      setActiveConv(data.conversation)
      setMessages(data.messages)
    } catch { /* swallow */ }
    finally { if (!silent) setThreadLoading(false) }
  }, [])

  useEffect(() => {
    if (!activePhone) {
      setActiveConv(null)
      setMessages([])
      return
    }
    fetchThread(activePhone, false)
    const id = setInterval(() => fetchThread(activePhone, true), POLL_INTERVAL_THREAD_MS)
    return () => clearInterval(id)
  }, [activePhone, fetchThread])

  // Master-detail responsive: en móvil (<md) solo una vista a la vez.
  //   - Sin conversación seleccionada → lista a pantalla completa.
  //   - Con conversación → chat a pantalla completa, header tiene
  //     botón "← Lista" que limpia activePhone.
  // En desktop (≥md) se ven ambos lado a lado como antes. Usamos
  // utility classes de Tailwind para no duplicar el árbol — `hidden
  // md:flex` en la lista cuando hay phone, y `hidden md:flex` en el
  // canvas cuando NO hay phone (sin esto el grid se rompe).
  const showListOnMobile = !activePhone
  const showChatOnMobile = !!activePhone

  return (
    <div className="flex gap-3 flex-1 min-h-0">
      {/* ─── LISTA ─────────────────────────────────────────────── */}
      <aside
        className={`${showListOnMobile ? "flex" : "hidden md:flex"} w-full md:w-[320px] shrink-0 flex-col bg-page rounded-md overflow-hidden`}
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput) }}
            className="relative mb-2"
          >
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </form>
          <div className="flex gap-1">
            {(["all", "human_active", "bot_active"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 px-2 py-1 rounded text-[10px] font-display font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === s
                    ? "bg-orange text-dark"
                    : "bg-cream text-ink-2 hover:bg-cream-2"
                }`}
                style={{ border: "1.5px solid var(--border)" }}
              >
                {s === "all" ? "Todas" : s === "human_active" ? "Operador" : "Dana"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-ink-3 text-[12px]">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-40" />
              {search ? "Sin resultados" : "Aún no hay conversaciones"}
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationListItem
                key={c.id}
                conv={c}
                active={c.phone === activePhone}
                onSelect={() => selectPhone(c.phone)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ─── CHAT VIEW ─────────────────────────────────────────── */}
      <main
        className={`${showChatOnMobile ? "flex" : "hidden md:flex"} flex-1 flex-col bg-page rounded-md overflow-hidden min-w-0`}
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        {!activeConv ? (
          <EmptyState />
        ) : (
          <ChatView
            conv={activeConv}
            messages={messages}
            loading={threadLoading}
            onBack={() => selectPhone(undefined)}
            onStatusChanged={(c) => {
              setActiveConv(c)
              setConversations((cs) => cs.map((x) => (x.phone === c.phone ? { ...x, session_status: c.session_status } : x)))
            }}
            onSent={() => activePhone && fetchThread(activePhone, true)}
            flash={flash}
          />
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

function ConversationListItem({ conv, active, onSelect }: { conv: DanaConversation; active: boolean; onSelect: () => void }) {
  const lastMsg = conv.last_message ?? "(sin mensajes aún)"
  const truncated = lastMsg.length > 60 ? lastMsg.slice(0, 60) + "…" : lastMsg
  const time = conv.last_message_at ? formatRelative(conv.last_message_at) : ""

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 border-b transition-colors ${active ? "bg-orange/10" : "hover:bg-cream"}`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-display font-bold text-[12px] text-ink truncate">
            {conv.customer_name || conv.phone}
          </span>
          {conv.session_status === "human_active" && (
            <span className="shrink-0 px-1 py-0.5 bg-primary/15 text-primary rounded text-[8px] font-display font-bold uppercase tracking-wider">
              Op
            </span>
          )}
        </div>
        {time && <span className="text-[10px] text-ink-3 shrink-0 num">{time}</span>}
      </div>
      <p className="text-[11px] text-ink-2 line-clamp-1">
        {conv.last_message_role === "assistant" && <span className="text-orange font-bold">Dana: </span>}
        {conv.last_message_role === "human" && <span className="text-secondary font-bold">Tú: </span>}
        {truncated}
      </p>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-ink-3 px-8 text-center">
      <MessageCircle size={48} className="mb-3 opacity-30" />
      <h3 className="font-display font-black text-[14px] uppercase tracking-tight text-ink-2 mb-2">
        Selecciona una conversación
      </h3>
      <p className="text-[11px] max-w-sm leading-relaxed">
        Desde acá puedes ver el chat completo, tomar control de la conversación, o redactar respuestas que Dana traducirá a su voz.
      </p>
    </div>
  )
}

function ChatView({
  conv,
  messages,
  loading,
  onStatusChanged,
  onSent,
  onBack,
  flash,
}: {
  conv: DanaConversation
  messages: DanaMessage[]
  loading: boolean
  onStatusChanged: (c: DanaConversation) => void
  onSent: () => void
  /** Cuando se llama, limpia activePhone — en móvil regresa a la lista.
   *  En desktop el botón "← Lista" no se muestra (media query) así que
   *  la prop solo se activa en móvil. */
  onBack: () => void
  flash: (k: "ok" | "err", m: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const [previewWarning, setPreviewWarning] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al fondo cuando llegan mensajes nuevos.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const isHuman = conv.session_status === "human_active"

  function toggleControl() {
    const next = isHuman ? "bot_active" : "human_active"
    startTransition(async () => {
      const r = await setStatusAction(conv.phone, next)
      if (!r.ok) return flash("err", r.error)
      onStatusChanged({ ...conv, session_status: next })
      flash("ok", next === "human_active" ? "Tomaste control — Dana muda" : "Dana retomó la conversación")
    })
  }

  function sendDirect() {
    if (!draft.trim()) return
    const text = preview ?? draft  // si hay preview aprobado, mandalo
    const mode = preview && !previewWarning ? "as-dana" : "human"
    startTransition(async () => {
      const r = await sendMessageAction(conv.phone, text, mode)
      if (!r.ok) return flash("err", r.error)
      setDraft("")
      setPreview(null)
      setPreviewWarning(null)
      onSent()
    })
  }

  function rewriteAsDana() {
    if (!draft.trim()) return
    setPreviewLoading(true)
    startTransition(async () => {
      const r = await previewAsDanaAction(conv.phone, draft)
      setPreviewLoading(false)
      if (!r.ok) return flash("err", r.error)
      setPreview(r.rewritten)
      setPreviewWarning(r.warning ?? null)
    })
  }

  function discardPreview() {
    setPreview(null)
    setPreviewWarning(null)
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        {/* Back-to-list — solo móvil */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a la lista"
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-md bg-cream text-ink hover:bg-cream-2 shrink-0"
          style={{ border: "1.5px solid var(--border)" }}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-black text-[14px] md:text-[16px] text-ink truncate">
            {conv.customer_name || conv.phone}
          </h2>
          <p className="text-[10px] md:text-[11px] text-ink-3 num truncate">
            {conv.phone}
            {conv.customer_email && <> · {conv.customer_email}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleControl}
          disabled={pending}
          className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-2 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all shrink-0 ${
            isHuman ? "bg-primary text-white" : "bg-cream text-ink hover:bg-cream-2"
          }`}
          style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
        >
          <Hand size={11} strokeWidth={2.5} />
          {/* Label corto en móvil, completo en desktop */}
          <span className="hidden sm:inline">{isHuman ? "Soltar control" : "Tomar control"}</span>
          <span className="sm:hidden">{isHuman ? "Soltar" : "Tomar"}</span>
        </button>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {loading && messages.length === 0 && (
          <div className="text-center text-ink-3 text-[11px] py-8">Cargando mensajes…</div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
        {messages.length === 0 && !loading && (
          <div className="text-center text-ink-3 text-[11px] py-8">Sin mensajes — la conversación está vacía.</div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 shrink-0 space-y-2" style={{ borderColor: "var(--border)" }}>
        {isHuman ? (
          <div className="text-[10px] font-display font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Hand size={10} /> Modo humano — Dana está silenciada. El mensaje se envía tal cual.
          </div>
        ) : (
          <div className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
            <Bot size={10} /> Dana está respondiendo. Escribe abajo y dale a "Reescribir como Dana" para que lo mande en su voz, o "Enviar como tú" para que lo mande tal cual y tomar control.
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div
            className="rounded-md p-3 bg-orange/5"
            style={{ border: "1.5px dashed var(--border)" }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={11} className="text-orange" />
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-orange">
                Preview en voz Dana
              </span>
              <button
                onClick={discardPreview}
                className="ml-auto text-[10px] text-ink-3 hover:text-primary uppercase font-display font-bold"
              >
                Descartar
              </button>
            </div>
            <p className="text-[12px] text-ink whitespace-pre-wrap mb-2">{preview}</p>
            {previewWarning && (
              <p className="text-[10px] text-primary mb-2">⚠️ {previewWarning}</p>
            )}
          </div>
        )}

        <textarea
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setPreview(null); setPreviewWarning(null) }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendDirect() }
          }}
          placeholder={isHuman ? "Escribe tu respuesta…" : "Escribe — luego Reescribe como Dana o envía tal cual"}
          rows={3}
          disabled={pending}
          className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}
        />

        {/* Counter arriba, botones full-width abajo en móvil — en
            desktop vuelven a la disposición horizontal original. */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <span className="text-[10px] text-ink-3 hidden md:inline">{draft.length}/4000 chars · ⌘+Enter para enviar</span>
          <span className="text-[10px] text-ink-3 md:hidden">{draft.length}/4000 chars</span>
          <div className="flex items-center gap-2">
            {!isHuman && !preview && (
              <button
                type="button"
                onClick={rewriteAsDana}
                disabled={pending || previewLoading || !draft.trim()}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
              >
                {previewLoading ? "Reescribiendo…" : (
                  <>
                    <Sparkles size={11} strokeWidth={2.5} />
                    <span className="hidden sm:inline">Reescribir como Dana</span>
                    <span className="sm:hidden">Reescribir</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={sendDirect}
              disabled={pending || !draft.trim()}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                preview && !previewWarning ? "bg-orange text-dark" : "bg-secondary text-cream"
              }`}
              style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
            >
              <Send size={11} strokeWidth={3} />
              {preview && !previewWarning ? "Enviar como Dana" : "Enviar como tú"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function MessageBubble({ msg }: { msg: DanaMessage }) {
  const fromCustomer = msg.role === "user"
  const isHuman = msg.role === "human"
  const align = fromCustomer ? "items-start" : "items-end"

  let bubbleStyle = "bg-cream text-ink"
  let label: string | null = null
  let labelColor = "text-ink-3"
  let LabelIcon = User
  if (msg.role === "assistant") {
    bubbleStyle = "bg-orange/15 text-ink"
    label = "Dana"
    labelColor = "text-orange"
    LabelIcon = Bot
  } else if (isHuman) {
    bubbleStyle = "bg-secondary/15 text-ink"
    label = "Operador"
    labelColor = "text-secondary"
    LabelIcon = Edit3
  }

  const analysis = msg.metadata?.image_analysis
  const imageUrl = typeof msg.metadata?.image_url === "string" ? msg.metadata.image_url : undefined

  return (
    <div className={`flex flex-col ${align} gap-0.5`}>
      {label && (
        <span className={`text-[9px] font-display font-bold uppercase tracking-wider ${labelColor} flex items-center gap-1 px-1`}>
          <LabelIcon size={9} /> {label}
        </span>
      )}
      <div
        className={`max-w-[75%] px-3 py-2 rounded-md text-[12px] whitespace-pre-wrap break-words ${bubbleStyle}`}
        style={{ border: "1.5px solid var(--border)" }}
      >
        {msg.content}
      </div>
      {analysis && <ImageAnalysisChip analysis={analysis} imageUrl={imageUrl} />}
      <span className="text-[9px] text-ink-3 num px-1">{formatTime(msg.created_at)}</span>
    </div>
  )
}

/**
 * Pequeño card debajo del mensaje cuando llegó imagen analizada por
 * vision. Muestra: tipo, descripción semántica, texto extraído (si lo
 * hay), confianza, y link al archivo original. El operador puede
 * comparar lo que Dana "vio" vs la imagen real para debug.
 */
function ImageAnalysisChip({
  analysis,
  imageUrl,
}: {
  analysis: NonNullable<DanaMessage["metadata"]>["image_analysis"]
  imageUrl?: string
}) {
  if (!analysis) return null

  const TYPE_META: Record<string, { label: string; Icon: typeof Eye; bg: string; fg: string }> = {
    handwriting:   { label: "Manuscrito",   Icon: FileText,  bg: "bg-orange/10",    fg: "text-orange" },
    receipt:       { label: "Comprobante",  Icon: Receipt,   bg: "bg-secondary/10", fg: "text-secondary" },
    product_photo: { label: "Producto",     Icon: ImageIcon, bg: "bg-secondary/10", fg: "text-secondary" },
    screenshot:    { label: "Screenshot",   Icon: ImageIcon, bg: "bg-cream-2",      fg: "text-ink" },
    map:           { label: "Mapa",         Icon: MapPin,    bg: "bg-orange/10",    fg: "text-orange" },
    id_document:   { label: "Cédula",       Icon: IdCard,    bg: "bg-primary/10",   fg: "text-primary" },
    other:         { label: "Otro",         Icon: Eye,       bg: "bg-cream-2",      fg: "text-ink-3" },
  }
  const meta = TYPE_META[analysis.type] ?? TYPE_META.other

  const confColor =
    analysis.confidence === "high" ? "text-secondary" :
    analysis.confidence === "medium" ? "text-orange" :
    "text-primary"

  return (
    <div
      className={`mt-1 max-w-[75%] px-2.5 py-1.5 rounded-md text-[10px] ${meta.bg}`}
      style={{ border: "1px dashed var(--border-soft)" }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <meta.Icon size={11} strokeWidth={2.5} className={meta.fg} />
        <span className={`font-display font-bold uppercase tracking-wider ${meta.fg}`}>
          👁 Dana leyó: {meta.label}
        </span>
        <span className={`ml-auto font-display font-bold uppercase ${confColor}`}>
          {analysis.confidence}
        </span>
      </div>
      {analysis.description && (
        <p className="text-ink-2 leading-snug italic mb-1">
          {analysis.description}
        </p>
      )}
      {analysis.text_content && (
        <details className="cursor-pointer">
          <summary className="text-ink-3 hover:text-ink">Texto extraído</summary>
          <pre className="text-[10px] text-ink whitespace-pre-wrap mt-1 font-mono">
            {analysis.text_content}
          </pre>
        </details>
      )}
      <div className="flex items-center gap-2 text-ink-3 mt-1">
        <span className="text-[9px]">vía {analysis.provider}</span>
        {imageUrl && (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] underline hover:text-orange"
          >
            Ver original
          </a>
        )}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return new Date(iso).toLocaleDateString("es-VE", { day: "2-digit", month: "short" })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
}
