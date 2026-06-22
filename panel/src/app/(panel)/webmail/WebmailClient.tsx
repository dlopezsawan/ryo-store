"use client"

/**
 * WebmailClient — cliente IMAP/SMTP completo embebido en el panel.
 *
 * Layout:
 *   [chip account 1] [chip account 2] ...        (account switcher, top)
 *   ┌──────────┬─────────────────────────────────┐
 *   │ folders  │  message list / detail          │
 *   │  inbox   │                                  │
 *   │  sent    │                                  │
 *   │  spam    │                                  │
 *   └──────────┴─────────────────────────────────┘
 *
 * Auto-login: al click en una chip, llama /api/webmail/auth con { email } y
 * el backend resuelve la password desde env WEBMAIL_PASS_*. El token IMAP
 * se cachea en memoria por (account_email).
 */

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  Inbox, Send, Trash2, Folder, RefreshCw, AlertCircle, Loader2, Search,
  Paperclip, X, ArrowLeft, Star, MailOpen, ChevronDown,
} from "lucide-react"
import type {
  WebmailAccount, WebmailFolder, WebmailMessageSummary, WebmailMessageDetail as WebmailMessageDetailBase,
} from "@/lib/webmail"
import { fmtRelative } from "@/lib/utils"
import { DangerConfirm } from "@/components/ui/DangerConfirm"

/** Extends the base type with the RFC-2822 Message-ID header, which the IMAP
 *  endpoint already returns but wasn't typed here. Used for In-Reply-To threading. */
type WebmailMessageDetail = WebmailMessageDetailBase & { message_id?: string | null }

interface AccountState {
  email: string
  label: string
  available: boolean
  /** IMAP token (in-memory only) */
  token: string | null
  /** Loading state per account */
  loading: boolean
  error: string | null
}

const FOLDER_ICONS: Record<string, typeof Inbox> = {
  INBOX: Inbox,
  Sent: Send,
  Trash: Trash2,
  Spam: AlertCircle,
  Drafts: Folder,
}

function folderIcon(name: string): typeof Inbox {
  return FOLDER_ICONS[name] ?? Folder
}

export function WebmailClient({ initialAccounts }: { initialAccounts: WebmailAccount[] }) {
  const [accounts, setAccounts] = useState<AccountState[]>(
    initialAccounts.map((a) => ({ ...a, token: null, loading: false, error: null })),
  )
  const [activeEmail, setActiveEmail] = useState<string | null>(initialAccounts[0]?.email ?? null)

  const [folders, setFolders] = useState<WebmailFolder[]>([])
  const [activeFolder, setActiveFolder] = useState<string>("INBOX")
  const [messages, setMessages] = useState<WebmailMessageSummary[]>([])
  const [totalMessages, setTotalMessages] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [openMessage, setOpenMessage] = useState<WebmailMessageDetail | null>(null)
  const [loadingMessage, setLoadingMessage] = useState(false)

  const [composing, setComposing] = useState(false)
  const [reply, setReply] = useState<{ to: string; subject: string; inReplyTo?: string; references?: string } | null>(null)

  const [search, setSearch] = useState("")
  const [trashUid, setTrashUid] = useState<number | null>(null)
  const [trashPending, setTrashPending] = useState(false)

  const activeAccount = useMemo(
    () => accounts.find((a) => a.email === activeEmail) ?? null,
    [accounts, activeEmail],
  )

  // Auto-login al cambiar de cuenta — fire-and-forget
  useEffect(() => {
    if (!activeAccount || activeAccount.token || !activeAccount.available || activeAccount.loading) return
    void loginAccount(activeAccount.email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmail])

  async function loginAccount(email: string) {
    setAccounts((prev) =>
      prev.map((a) => (a.email === email ? { ...a, loading: true, error: null } : a)),
    )
    try {
      const r = await fetch("/api/webmail/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "login failed")
      setAccounts((prev) =>
        prev.map((a) => (a.email === email ? { ...a, token: j.token, loading: false, error: null } : a)),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : "login failed"
      setAccounts((prev) =>
        prev.map((a) => (a.email === email ? { ...a, loading: false, error: msg } : a)),
      )
    }
  }

  // Cargar folders cuando hay token
  useEffect(() => {
    if (!activeAccount?.token) {
      setFolders([])
      return
    }
    void (async () => {
      try {
        const r = await fetch("/api/webmail/folders", { headers: { "x-webmail-token": activeAccount.token! } })
        const j = await r.json()
        if (j.ok) setFolders(j.folders ?? [])
      } catch { /* ignore */ }
    })()
  }, [activeAccount?.token])

  // Cargar mensajes cuando cambia (token, folder, page)
  useEffect(() => {
    if (!activeAccount?.token) {
      setMessages([])
      return
    }
    void loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.token, activeFolder, page])

  async function loadMessages() {
    if (!activeAccount?.token) return
    setLoadingMessages(true)
    try {
      const r = await fetch(`/api/webmail/messages?folder=${encodeURIComponent(activeFolder)}&page=${page}&limit=25`, {
        headers: { "x-webmail-token": activeAccount.token },
      })
      const j = await r.json()
      if (j.ok) {
        setMessages(j.messages ?? [])
        setTotalMessages(j.total ?? 0)
      }
    } finally {
      setLoadingMessages(false)
    }
  }

  async function openMessageDetail(uid: number) {
    if (!activeAccount?.token) return
    setLoadingMessage(true)
    try {
      const r = await fetch(`/api/webmail/messages/${uid}?folder=${encodeURIComponent(activeFolder)}`, {
        headers: { "x-webmail-token": activeAccount.token },
      })
      const j = await r.json()
      if (j.ok) {
        setOpenMessage(j.message)
        // Mark seen locally
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)))
      }
    } finally {
      setLoadingMessage(false)
    }
  }

  async function trashMessageNow(uid: number) {
    if (!activeAccount?.token) return
    setTrashPending(true)
    try {
      await fetch(`/api/webmail/messages/${uid}?folder=${encodeURIComponent(activeFolder)}`, {
        method: "DELETE",
        headers: { "x-webmail-token": activeAccount.token },
      })
      setOpenMessage(null)
      setTrashUid(null)
      void loadMessages()
    } catch { /* ignore */ } finally {
      setTrashPending(false)
    }
  }

  async function toggleFlagged(uid: number, flagged: boolean) {
    if (!activeAccount?.token) return
    try {
      await fetch(`/api/webmail/messages/${uid}/flags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-webmail-token": activeAccount.token },
        body: JSON.stringify({ folder: activeFolder, flagged }),
      })
      setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, flagged } : m)))
    } catch { /* ignore */ }
  }

  // Filter messages with local search (sin round-trip al server)
  const visibleMessages = useMemo(() => {
    if (!search.trim()) return messages
    const q = search.toLowerCase()
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q) ||
        m.to.toLowerCase().includes(q),
    )
  }, [messages, search])

  return (
    <div className="space-y-3">
      {/* Account switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        {accounts.map((a) => (
          <AccountChip
            key={a.email}
            account={a}
            active={a.email === activeEmail}
            onClick={() => {
              setActiveEmail(a.email)
              setOpenMessage(null)
              setActiveFolder("INBOX")
              setPage(1)
            }}
          />
        ))}
        {accounts.length === 0 && (
          <p className="text-[12px] text-ink-3 italic">No tenés buzones asignados.</p>
        )}
      </div>

      {/* Main layout */}
      {activeAccount && activeAccount.token && (
        <div className="grid grid-cols-12 gap-3 stamp-card overflow-hidden" style={{ minHeight: 600 }}>
          {/* Sidebar — folders */}
          <aside className="col-span-2 border-r-[1.5px] border-warm-200/60 p-2 bg-cream-2/30">
            <button
              onClick={() => { setComposing(true); setReply(null) }}
              className="w-full mb-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[1px] hover:translate-y-[1px] transition-transform"
              style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
            >
              <Send size={11} strokeWidth={2.5} /> Nuevo
            </button>
            <ul className="space-y-0.5">
              {folders.length === 0 ? (
                <li className="text-[10px] text-ink-3 px-2 py-1 font-mono italic">cargando…</li>
              ) : folders.map((f) => {
                const Icon = folderIcon(f.name)
                const isActive = f.path === activeFolder
                return (
                  <li key={f.path}>
                    <button
                      onClick={() => { setActiveFolder(f.path); setPage(1); setOpenMessage(null) }}
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-[11px] font-display ${
                        isActive ? "bg-orange/15 text-orange font-bold" : "text-ink-2 hover:bg-cream-2"
                      }`}
                    >
                      <Icon size={12} strokeWidth={2.5} />
                      <span className="flex-1 truncate uppercase tracking-wider">{f.name}</span>
                      {f.unseen > 0 && (
                        <span className="text-[9px] font-mono px-1 bg-orange text-dark rounded">{f.unseen}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {/* Message list */}
          <section className={`${openMessage || composing ? "col-span-4" : "col-span-10"} border-r-[1.5px] border-warm-200/60 flex flex-col`}>
            <div className="px-3 py-2 bg-cream-2/40 border-b-[1.5px] border-warm-200/60 flex items-center gap-2">
              <Search size={12} className="text-ink-3" strokeWidth={2.5} />
              <input
                type="text"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-[11px] focus:outline-none font-mono"
              />
              <button onClick={() => loadMessages()} className="text-ink-3 hover:text-orange p-1" title="Refrescar">
                <RefreshCw size={11} strokeWidth={2.5} className={loadingMessages ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 600 }}>
              {loadingMessages && messages.length === 0 ? (
                <div className="p-6 text-center">
                  <Loader2 size={20} className="text-orange animate-spin mx-auto" strokeWidth={2.5} />
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="p-6 text-center text-[11px] text-ink-3 font-mono italic">
                  {search ? "Nada coincide con la búsqueda." : "Sin mensajes."}
                </div>
              ) : (
                <ul>
                  {visibleMessages.map((m) => (
                    <li
                      key={m.uid}
                      className={`px-3 py-2 cursor-pointer border-b border-warm-200/40 hover:bg-orange/5 ${
                        openMessage?.uid === m.uid ? "bg-orange/10" : ""
                      } ${!m.seen ? "bg-cream" : ""}`}
                      onClick={() => openMessageDetail(m.uid)}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); void toggleFlagged(m.uid, !m.flagged) }}
                          className={`mt-1 ${m.flagged ? "text-orange" : "text-ink-3 hover:text-orange"}`}
                        >
                          <Star size={11} strokeWidth={2.5} fill={m.flagged ? "currentColor" : "none"} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[11px] truncate flex-1 ${!m.seen ? "font-display font-black text-ink" : "text-ink-2"}`}>
                              {m.from || "(sin remitente)"}
                            </span>
                            <span className="text-[9px] font-mono text-ink-3 flex-shrink-0">{fmtRelative(m.date)}</span>
                          </div>
                          <p className={`text-[11px] truncate ${!m.seen ? "font-bold text-ink" : "text-ink-2"}`}>
                            {m.subject || "(sin asunto)"}
                          </p>
                          {m.preview && (
                            <p className="text-[10px] text-ink-3 truncate mt-0.5 font-mono">{m.preview}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Pagination */}
            {totalMessages > 25 && (
              <div className="px-3 py-2 bg-cream-2/40 border-t-[1.5px] border-warm-200/60 flex items-center justify-between text-[10px] font-mono">
                <span className="text-ink-3">{totalMessages} totales · página {page}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-2 py-0.5 bg-cream hover:bg-cream-2 rounded disabled:opacity-30"
                    style={{ border: "1.5px solid var(--border)" }}>← prev</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page * 25 >= totalMessages}
                    className="px-2 py-0.5 bg-cream hover:bg-cream-2 rounded disabled:opacity-30"
                    style={{ border: "1.5px solid var(--border)" }}>next →</button>
                </div>
              </div>
            )}
          </section>

          {/* Detail / compose pane */}
          {(openMessage || composing) && (
            <section className="col-span-6 flex flex-col bg-cream/40 overflow-hidden">
              {composing ? (
                <ComposePane
                  fromEmail={activeAccount.email}
                  token={activeAccount.token!}
                  reply={reply ?? undefined}
                  onClose={() => { setComposing(false); setReply(null) }}
                  onSent={() => { setComposing(false); setReply(null); void loadMessages() }}
                />
              ) : openMessage ? (
                <MessageDetailPane
                  message={openMessage}
                  loading={loadingMessage}
                  onClose={() => setOpenMessage(null)}
                  onTrash={() => setTrashUid(openMessage.uid)}
                  onReply={() => {
                    setReply({
                      to: openMessage.from,
                      subject: openMessage.subject.startsWith("Re:") ? openMessage.subject : `Re: ${openMessage.subject}`,
                      inReplyTo: openMessage.message_id ?? undefined,
                      references: openMessage.message_id ?? undefined,
                    })
                    setComposing(true)
                  }}
                />
              ) : null}
            </section>
          )}
        </div>
      )}

      {/* DangerConfirm para mover a papelera */}
      <DangerConfirm
        open={trashUid !== null}
        onCancel={() => { if (!trashPending) setTrashUid(null) }}
        onConfirm={() => { if (trashUid !== null) void trashMessageNow(trashUid) }}
        pending={trashPending}
        title="¿Mover a papelera?"
        description={
          <>
            El email se moverá a la carpeta <code className="font-mono px-1 bg-cream-2 rounded">Trash</code> de{" "}
            <strong>{activeAccount?.email}</strong>. Podés recuperarlo desde ahí mientras no se vacíe la papelera.
          </>
        }
        confirmLabel="Mover a papelera"
      />

      {/* Account loading state */}
      {activeAccount && !activeAccount.token && (
        <div className="stamp-card p-10 text-center">
          {activeAccount.loading ? (
            <>
              <Loader2 size={32} className="text-orange mx-auto animate-spin" strokeWidth={2} />
              <p className="font-display font-bold text-[13px] uppercase tracking-wider text-orange mt-3">
                Conectando a {activeAccount.email}…
              </p>
            </>
          ) : !activeAccount.available ? (
            <>
              <AlertCircle size={32} className="text-primary mx-auto" strokeWidth={2} />
              <p className="font-display font-bold text-[13px] uppercase tracking-wider text-primary mt-3">
                Sin password configurada
              </p>
              <p className="text-[11px] text-ink-3 font-mono mt-1">
                Definí <code className="bg-cream-2 px-1">WEBMAIL_PASS_{activeAccount.email.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}</code> en el env del backend
              </p>
            </>
          ) : activeAccount.error ? (
            <>
              <AlertCircle size={32} className="text-primary mx-auto" strokeWidth={2} />
              <p className="font-display font-bold text-[13px] uppercase tracking-wider text-primary mt-3">
                {activeAccount.error}
              </p>
              <button onClick={() => loginAccount(activeAccount.email)}
                className="mt-3 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90"
                style={{ border: "1.5px solid #1A1A1A" }}>
                Reintentar
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

function AccountChip({ account, active, onClick }: { account: AccountState; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-display font-bold uppercase tracking-wider transition-colors ${
        active ? "bg-dark text-cream" : account.available ? "bg-cream hover:bg-cream-2 text-ink" : "bg-cream-2/40 text-ink-3"
      }`}
      style={{ border: "1.5px solid var(--border)" }}
      disabled={!account.available && !active}
      title={account.email}
    >
      {account.loading ? (
        <Loader2 size={11} className="animate-spin" strokeWidth={2.5} />
      ) : account.token ? (
        <span className="w-1.5 h-1.5 bg-secondary rounded-full inline-block streak" />
      ) : !account.available ? (
        <span className="w-1.5 h-1.5 bg-ink-3 rounded-full inline-block" />
      ) : (
        <span className="w-1.5 h-1.5 bg-orange rounded-full inline-block" />
      )}
      <span>{account.label}</span>
      <span className="font-mono text-[9px] opacity-60 ml-0.5 normal-case">@{account.email.split("@")[1]}</span>
    </button>
  )
}

function MessageDetailPane({
  message, loading, onClose, onTrash, onReply,
}: {
  message: WebmailMessageDetail
  loading: boolean
  onClose: () => void
  onTrash: () => void
  onReply: () => void
}) {
  return (
    <>
      {/* Toolbar */}
      <div className="px-3 py-2 bg-cream-2/40 border-b-[1.5px] border-warm-200/60 flex items-center gap-2">
        <button onClick={onClose} className="text-ink-3 hover:text-orange p-1" title="Cerrar">
          <X size={12} strokeWidth={2.5} />
        </button>
        <button onClick={onReply}
          className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90"
          style={{ border: "1.5px solid #1A1A1A" }}>
          <Send size={10} strokeWidth={2.5} /> Responder
        </button>
        <button onClick={onTrash}
          className="flex items-center gap-1 px-2 py-1 bg-cream text-primary rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-primary/10"
          style={{ border: "1.5px solid var(--border)" }}>
          <Trash2 size={10} strokeWidth={2.5} /> Papelera
        </button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="text-orange animate-spin" strokeWidth={2.5} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 600 }}>
          <h2 className="font-display font-black text-[16px] mb-2">{message.subject || "(sin asunto)"}</h2>
          <div className="text-[11px] text-ink-2 font-mono space-y-0.5 mb-3 pb-3 border-b border-warm-200/60">
            <div><span className="text-ink-3">De:</span> {message.from}</div>
            <div><span className="text-ink-3">Para:</span> {message.to}</div>
            {message.cc && <div><span className="text-ink-3">Cc:</span> {message.cc}</div>}
            <div><span className="text-ink-3">Fecha:</span> {message.date ? new Date(message.date).toLocaleString("es-VE") : "—"}</div>
          </div>
          {message.attachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {message.attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-cream-2 rounded-md text-[10px] font-mono">
                  <Paperclip size={9} strokeWidth={2.5} /> {a.filename} ({Math.round(a.size / 1024)}kb)
                </span>
              ))}
            </div>
          )}
          {message.html ? (
            <div className="mail-html-body text-[12px]" dangerouslySetInnerHTML={{ __html: message.html }} />
          ) : (
            <pre className="text-[12px] font-mono whitespace-pre-wrap break-words text-ink-2">{message.text}</pre>
          )}
        </div>
      )}
    </>
  )
}

function ComposePane({
  fromEmail, token, reply, onClose, onSent,
}: {
  fromEmail: string
  token: string
  reply?: { to: string; subject: string; inReplyTo?: string; references?: string }
  onClose: () => void
  onSent: () => void
}) {
  const [to, setTo] = useState(reply?.to ?? "")
  const [subject, setSubject] = useState(reply?.subject ?? "")
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function send() {
    setError(null)
    startTransition(async () => {
      try {
        const r = await fetch("/api/webmail/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-webmail-token": token },
          body: JSON.stringify({
            to,
            subject,
            html: body.replace(/\n/g, "<br>"),
            inReplyTo: reply?.inReplyTo,
            references: reply?.references,
          }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || "send failed")
        onSent()
      } catch (e) {
        setError(e instanceof Error ? e.message : "send error")
      }
    })
  }

  return (
    <>
      <div className="px-3 py-2 bg-cream-2/40 border-b-[1.5px] border-warm-200/60 flex items-center gap-2">
        <button onClick={onClose} className="text-ink-3 hover:text-orange p-1" title="Cancelar">
          <X size={12} strokeWidth={2.5} />
        </button>
        <h3 className="font-display font-bold text-[12px] uppercase tracking-wider">{reply ? "Responder" : "Nuevo email"}</h3>
        <span className="ml-auto text-[10px] font-mono text-ink-3">desde {fromEmail}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <input type="email" placeholder="Para" value={to} onChange={(e) => setTo(e.target.value)}
          className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }} />
        <input type="text" placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }} />
        <textarea rows={14} placeholder="Mensaje…" value={body} onChange={(e) => setBody(e.target.value)}
          className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono focus:outline-none resize-none"
          style={{ border: "1.5px solid var(--border)" }} />
        {error && (
          <p className="text-[11px] text-primary flex items-center gap-1">
            <AlertCircle size={11} /> {error}
          </p>
        )}
      </div>
      <div className="px-3 py-2 bg-cream-2/40 border-t-[1.5px] border-warm-200/60 flex items-center justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
          style={{ border: "1.5px solid var(--border)" }}>Cancelar</button>
        <button onClick={send} disabled={pending || !to.trim() || !subject.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:opacity-90"
          style={{ border: "1.5px solid #1A1A1A" }}>
          <Send size={10} strokeWidth={2.5} /> {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </>
  )
}
