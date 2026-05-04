"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, toast, Input } from "@medusajs/ui"
import { useState, useCallback } from "react"
import { Envelope, Plus, Trash, X } from "@medusajs/icons"
import { useWebmail } from "./hooks/use-webmail"
import type { SavedAccount } from "./hooks/use-webmail"
import { FolderList } from "./components/FolderList"
import { MessageList } from "./components/MessageList"
import { MessageView } from "./components/MessageView"
import { ComposeModal } from "./components/ComposeModal"

type ComposeMode = "compose" | "reply" | "forward"

// ── Add-account modal ────────────────────────────────────────────────────────
function AddAccountModal({
  open,
  onClose,
  onLogin,
  loading,
  error,
}: {
  open: boolean
  onClose: () => void
  onLogin: (email: string, password: string) => Promise<void>
  loading: boolean
  error: string
}) {
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onLogin(email, pass)
      setEmail(""); setPass(""); onClose()
    } catch { /* error shown via prop */ }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <Container
        style={{ width: 380, padding: 28, position: "relative" }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 12, right: 12, border: "none", background: "none", cursor: "pointer", display: "flex" }}
        >
          <X />
        </button>
        <Heading level="h2" style={{ marginBottom: 16 }}>Añadir cuenta</Heading>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            type="email" placeholder="correo@enrola.shop"
            value={email} onChange={e => setEmail(e.target.value)}
            required disabled={loading}
          />
          <Input
            type="password" placeholder="Contraseña"
            value={pass} onChange={e => setPass(e.target.value)}
            required disabled={loading}
          />
          {error && <Text size="small" style={{ color: "#ef4444" }}>{error}</Text>}
          <Button type="submit" isLoading={loading} disabled={loading}>
            Iniciar sesión
          </Button>
        </form>
      </Container>
    </div>
  )
}

// ── Account switcher dropdown ─────────────────────────────────────────────────
function AccountSwitcher({
  accounts,
  activeEmail,
  onSwitch,
  onRemove,
  onAddAccount,
}: {
  accounts: SavedAccount[]
  activeEmail: string
  onSwitch: (email: string) => void
  onRemove: (email: string) => void
  onAddAccount: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 6,
          border: "1px solid var(--border-base, #e5e7eb)",
          background: "var(--bg-subtle, #f9fafb)",
          cursor: "pointer", fontSize: 13, fontWeight: 500,
          color: "var(--fg-base, #1a1a1a)",
          maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        <Envelope style={{ width: 14, height: 14, flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{activeEmail}</span>
        <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            minWidth: 260, zIndex: 200,
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "6px 0",
          }}
        >
          {accounts.map(acc => (
            <div
              key={acc.email}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px",
                background: acc.email === activeEmail ? "#f3f4f6" : "transparent",
              }}
            >
              <button
                onClick={() => { onSwitch(acc.email); setOpen(false) }}
                style={{
                  flex: 1, textAlign: "left", border: "none", background: "none",
                  cursor: "pointer", fontSize: 13, color: "#374151",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {acc.email === activeEmail && <span style={{ color: "#6366f1", marginRight: 6 }}>✓</span>}
                {acc.email}
              </button>
              {accounts.length > 1 && (
                <button
                  onClick={() => { onRemove(acc.email); setOpen(false) }}
                  title="Eliminar cuenta"
                  style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: "#9ca3af", padding: 2 }}
                >
                  <Trash style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>
          ))}
          <div style={{ borderTop: "1px solid #f3f4f6", margin: "4px 0" }} />
          <button
            onClick={() => { onAddAccount(); setOpen(false) }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 12px", width: "100%", border: "none",
              background: "none", cursor: "pointer", fontSize: 13,
              color: "#6366f1", fontWeight: 500,
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Añadir cuenta
          </button>
        </div>
      )}
    </div>
  )
}

// ── Login screen (full page, for first login) ─────────────────────────────────
function LoginScreen({
  onLogin, loading, error,
}: { onLogin: (email: string, password: string) => Promise<void>; loading: boolean; error: string }) {
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onLogin(email, pass)
  }

  return (
    <Container style={{ maxWidth: 400, margin: "80px auto", padding: 32 }}>
      <Heading level="h1" style={{ marginBottom: 8 }}>Webmail</Heading>
      <Text size="small" className="text-ui-fg-subtle" style={{ marginBottom: 24 }}>
        Inicia sesión con tu cuenta IMAP/SMTP
      </Text>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input
          type="email" placeholder="correo@enrola.shop"
          value={email} onChange={e => setEmail(e.target.value)}
          required disabled={loading}
        />
        <Input
          type="password" placeholder="Contraseña"
          value={pass} onChange={e => setPass(e.target.value)}
          required disabled={loading}
        />
        {error && <Text size="small" style={{ color: "#ef4444" }}>{error}</Text>}
        <Button type="submit" isLoading={loading} disabled={loading}>
          Entrar
        </Button>
      </form>
    </Container>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
function WebmailPage() {
  const mail = useWebmail()
  const [composing, setComposing] = useState(false)
  const [composeMode, setComposeMode] = useState<ComposeMode>("compose")
  const [composeTo, setComposeTo] = useState<string | undefined>()
  const [composeSubject, setComposeSubject] = useState<string | undefined>()
  const [composeBody, setComposeBody] = useState<string | undefined>()
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>()
  const [addingAccount, setAddingAccount] = useState(false)

  const openCompose = useCallback((
    mode: ComposeMode,
    to?: string, subject?: string, body?: string, inReplyTo?: string
  ) => {
    setComposeMode(mode); setComposeTo(to); setComposeSubject(subject)
    setComposeBody(body); setComposeInReplyTo(inReplyTo); setComposing(true)
  }, [])

  const handleSelectMessage = useCallback(
    (uid: number) => { mail.fetchMessage(uid) },
    [mail.fetchMessage]
  )

  const handleReply = useCallback(() => {
    if (!mail.selected) return
    openCompose(
      "reply",
      mail.selected.from,
      `Re: ${mail.selected.subject.replace(/^Re:\s*/i, "")}`,
      `\n\n--- Mensaje original ---\nDe: ${mail.selected.from}\n\n${mail.selected.text || ""}`,
      mail.selected.from
    )
  }, [mail.selected, openCompose])

  const handleForward = useCallback(() => {
    if (!mail.selected) return
    openCompose(
      "forward", "",
      `Fwd: ${mail.selected.subject.replace(/^Fwd:\s*/i, "")}`,
      `\n\n--- Mensaje reenviado ---\nDe: ${mail.selected.from}\nFecha: ${mail.selected.date}\nAsunto: ${mail.selected.subject}\n\n${mail.selected.text || ""}`,
    )
  }, [mail.selected, openCompose])

  const handleSend = useCallback(
    async (to: string, subject: string, html: string, opts?: { cc?: string; bcc?: string; inReplyTo?: string }) => {
      try {
        await mail.sendEmail(to, subject, html, opts)
        toast.success("Email enviado correctamente")
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error"
        toast.error(`Error: ${msg}`)
        throw e
      }
    },
    [mail.sendEmail]
  )

  const handleDelete = useCallback(async (uid: number) => {
    try { await mail.deleteEmail(uid); toast.success("Email eliminado") }
    catch (e: unknown) { toast.error(`Error: ${e instanceof Error ? e.message : "Error"}`) }
  }, [mail.deleteEmail])

  const handleMarkUnread = useCallback(async (uid: number) => {
    try { await mail.markRead(uid, false); toast.success("Marcado como no leído") }
    catch (e: unknown) { toast.error(`Error: ${e instanceof Error ? e.message : "Error"}`) }
  }, [mail.markRead])

  const handleStar = useCallback(async (uid: number, flagged: boolean) => {
    try { await mail.starEmail(uid, flagged) }
    catch (e: unknown) { toast.error(`Error: ${e instanceof Error ? e.message : "Error"}`) }
  }, [mail.starEmail])

  const handleMarkAllRead = useCallback(async () => {
    try { await mail.markAllReadInFolder(); toast.success("Todo marcado como leído") }
    catch (e: unknown) { toast.error(`Error: ${e instanceof Error ? e.message : "Error"}`) }
  }, [mail.markAllReadInFolder])

  const handleAddAccount = useCallback(async (email: string, password: string) => {
    await mail.doLogin(email, password)
  }, [mail.doLogin])

  if (!mail.isAuthenticated) {
    return <LoginScreen onLogin={mail.doLogin} loading={mail.loggingIn} error={mail.loginError} />
  }

  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-120px)]">
      {/* Header */}
      <Container className="flex items-center justify-between px-6 py-3 rounded-b-none">
        <div className="flex items-center gap-3">
          <Heading level="h1">Webmail</Heading>
          <AccountSwitcher
            accounts={mail.accounts}
            activeEmail={mail.email}
            onSwitch={mail.switchAccount}
            onRemove={mail.removeAccountByEmail}
            onAddAccount={() => setAddingAccount(true)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="small" onClick={mail.refresh}>
            Actualizar
          </Button>
          <Button size="small" onClick={() => openCompose("compose")}>
            Nuevo email
          </Button>
          <Button variant="secondary" size="small" onClick={mail.doLogout}>
            Cerrar sesión
          </Button>
        </div>
      </Container>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 border border-ui-border-base rounded-lg overflow-hidden mx-0">
        {/* Sidebar */}
        <div className="w-[220px] border-r border-ui-border-base bg-ui-bg-subtle flex flex-col p-3 overflow-y-auto shrink-0">
          <FolderList
            folders={mail.folders}
            selected={mail.folder}
            onSelect={mail.setFolder}
          />
        </div>

        {/* Message list */}
        <div className="w-[360px] border-r border-ui-border-base flex flex-col shrink-0">
          <MessageList
            messages={mail.messages}
            loading={mail.loading}
            selectedUid={mail.selected?.uid ?? null}
            onSelect={handleSelectMessage}
            onStar={handleStar}
            onMarkAllRead={handleMarkAllRead}
            page={mail.page}
            totalPages={mail.totalPages}
            onPageChange={mail.setPage}
            sort={mail.sort}
            onSortChange={mail.setSort}
          />
        </div>

        {/* Reading pane */}
        <div className="flex-1 min-w-0 bg-ui-bg-base">
          <MessageView
            message={mail.selected}
            loading={mail.loadingMsg}
            onClose={() => mail.setSelected(null)}
            onReply={handleReply}
            onForward={handleForward}
            onDelete={handleDelete}
            onMarkUnread={handleMarkUnread}
          />
        </div>
      </div>

      {/* Compose modal */}
      <ComposeModal
        open={composing}
        onClose={() => setComposing(false)}
        onSend={handleSend}
        defaultTo={composeTo}
        defaultSubject={composeSubject}
        defaultBody={composeBody}
        inReplyTo={composeInReplyTo}
        mode={composeMode}
      />

      {/* Add account modal */}
      <AddAccountModal
        open={addingAccount}
        onClose={() => setAddingAccount(false)}
        onLogin={handleAddAccount}
        loading={mail.loggingIn}
        error={mail.loginError}
      />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Webmail",
  icon: Envelope,
})

export default WebmailPage
