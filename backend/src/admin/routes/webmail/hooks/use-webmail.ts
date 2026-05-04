import { useState, useCallback, useEffect, useRef } from "react"

type Folder = { path: string; name: string; unseen: number; total: number }
type MessageSummary = {
  uid: number; seq: number; from: string; to: string
  subject: string; date: string; seen: boolean; flagged: boolean
  size: number; preview: string
}

export type SortKey = "date-desc" | "date-asc" | "from-asc" | "from-desc" | "subject-asc" | "subject-desc" | "size-desc" | "size-asc"
type MessageDetail = {
  uid: number; from: string; to: string; cc: string
  subject: string; date: string; html: string; text: string
  seen: boolean; attachments: { filename: string; size: number; contentType: string }[]
}

export type SavedAccount = { email: string; token: string }
const ACCOUNTS_KEY = "webmail_accounts"
const ACTIVE_KEY = "webmail_active_email"

function loadAccounts(): SavedAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]") } catch { return [] }
}
function saveAccounts(a: SavedAccount[]) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a)) }
function getActiveEmail(): string { return localStorage.getItem(ACTIVE_KEY) || "" }
function setActiveEmail(e: string) { localStorage.setItem(ACTIVE_KEY, e) }
function addOrUpdateAccount(email: string, token: string) {
  const list = loadAccounts().filter(a => a.email !== email)
  list.unshift({ email, token })
  saveAccounts(list); setActiveEmail(email)
}
function removeAccount(email: string) {
  const list = loadAccounts().filter(a => a.email !== email)
  saveAccounts(list)
  if (getActiveEmail() === email) setActiveEmail(list[0]?.email || "")
}
function getActiveAccount(): SavedAccount | null {
  const e = getActiveEmail()
  return loadAccounts().find(a => a.email === e) || loadAccounts()[0] || null
}

const BASE = "https://api.enrola.shop/admin/webmail"

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init, credentials: "include",
    headers: { "Content-Type": "application/json", "x-webmail-token": token, ...(init?.headers || {}) },
  })
  if (res.status === 401) throw new Error("SESSION_EXPIRED")
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`) }
  return res.json()
}

export function useWebmail() {
  const [auth, setAuth] = useState<SavedAccount | null>(getActiveAccount)
  const [accounts, setAccounts] = useState<SavedAccount[]>(loadAccounts)
  const [folders, setFolders] = useState<Folder[]>([])
  const [folder, setFolder] = useState("INBOX")
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MessageDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [sort, setSort] = useState<SortKey>("date-desc")
  const limit = 25
  const tokenRef = useRef(auth?.token || "")
  tokenRef.current = auth?.token || ""

  const handleSessionExpired = useCallback(() => {
    if (auth?.email) removeAccount(auth.email)
    const rem = loadAccounts(); setAccounts(rem); setAuth(rem[0] || null)
  }, [auth])

  const doLogin = useCallback(async (email: string, password: string) => {
    setLoggingIn(true); setLoginError("")
    try {
      const res = await fetch(`${BASE}/auth`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Error de login") }
      const data = await res.json()
      addOrUpdateAccount(data.email, data.token)
      setAccounts(loadAccounts()); setAuth({ email: data.email, token: data.token })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error"
      setLoginError(msg); throw e
    } finally { setLoggingIn(false) }
  }, [])

  const doLogout = useCallback(async () => {
    if (tokenRef.current) {
      try { await fetch(`${BASE}/auth`, { method: "DELETE", credentials: "include", headers: { "x-webmail-token": tokenRef.current } }) } catch { /* ignore */ }
    }
    if (auth?.email) removeAccount(auth.email)
    const rem = loadAccounts(); setAccounts(rem); setAuth(rem[0] || null)
    if (!rem[0]) { setFolders([]); setMessages([]); setSelected(null); setFolder("INBOX"); setPage(1); setTotal(0) }
  }, [auth])

  const switchAccount = useCallback((email: string) => {
    const acc = loadAccounts().find(a => a.email === email)
    if (!acc) return
    setActiveEmail(email); setAuth(acc)
    setFolders([]); setMessages([]); setSelected(null); setFolder("INBOX"); setPage(1); setTotal(0)
  }, [])

  const removeAccountByEmail = useCallback((email: string) => {
    removeAccount(email)
    const rem = loadAccounts(); setAccounts(rem)
    if (auth?.email === email) {
      setAuth(rem[0] || null)
      if (!rem[0]) { setFolders([]); setMessages([]); setSelected(null); setFolder("INBOX"); setPage(1); setTotal(0) }
    }
  }, [auth])

  const fetchFolders = useCallback(async () => {
    if (!tokenRef.current) return
    try { const d = await api<{ folders: Folder[] }>("/folders", tokenRef.current); setFolders(d.folders) }
    catch (e: unknown) { if (e instanceof Error && e.message === "SESSION_EXPIRED") handleSessionExpired() }
  }, [handleSessionExpired])

  const fetchMessages = useCallback(async () => {
    if (!tokenRef.current) return
    setLoading(true)
    try {
      const d = await api<{ messages: MessageSummary[]; total: number }>(
        `/messages?folder=${encodeURIComponent(folder)}&page=${page}&limit=${limit}`, tokenRef.current)
      setMessages(d.messages); setTotal(d.total)
    } catch (e: unknown) { if (e instanceof Error && e.message === "SESSION_EXPIRED") handleSessionExpired() }
    setLoading(false)
  }, [folder, page, handleSessionExpired])

  const fetchMessage = useCallback(async (uid: number) => {
    if (!tokenRef.current) return
    setLoadingMsg(true)
    try {
      const d = await api<{ message: MessageDetail }>(`/messages/${uid}?folder=${encodeURIComponent(folder)}`, tokenRef.current)
      setSelected(d.message)
      setMessages(prev => prev.map(m => m.uid === uid ? { ...m, seen: true } : m))
    } catch (e: unknown) { if (e instanceof Error && e.message === "SESSION_EXPIRED") handleSessionExpired() }
    setLoadingMsg(false)
  }, [folder, handleSessionExpired])

  const sendEmail = useCallback(async (to: string, subject: string, html: string, opts?: { cc?: string; bcc?: string; inReplyTo?: string }) => {
    await api("/messages", tokenRef.current, { method: "POST", body: JSON.stringify({ to, subject, html, ...opts }) })
    await fetchMessages()
  }, [fetchMessages])

  const replyEmail = useCallback(async (uid: number, to: string, subject: string, html: string, inReplyTo?: string) => {
    await api(`/messages/${uid}/reply`, tokenRef.current, { method: "POST", body: JSON.stringify({ to, subject, html, inReplyTo }) })
  }, [])

  const markRead = useCallback(async (uid: number, seen: boolean) => {
    await api(`/messages/${uid}/flags`, tokenRef.current, { method: "PATCH", body: JSON.stringify({ folder, seen }) })
    setMessages(prev => prev.map(m => m.uid === uid ? { ...m, seen } : m))
    if (!seen && selected?.uid === uid) setSelected(prev => prev ? { ...prev, seen: false } : prev)
  }, [folder, selected])

  const starEmail = useCallback(async (uid: number, flagged: boolean) => {
    await api(`/messages/${uid}/flags`, tokenRef.current, { method: "PATCH", body: JSON.stringify({ folder, flagged }) })
    setMessages(prev => prev.map(m => m.uid === uid ? { ...m, flagged } : m))
  }, [folder])

  const markAllReadInFolder = useCallback(async () => {
    await api("/messages/mark-all-read", tokenRef.current, { method: "POST", body: JSON.stringify({ folder }) })
    setMessages(prev => prev.map(m => ({ ...m, seen: true })))
    setFolders(prev => prev.map(f => f.path === folder ? { ...f, unseen: 0 } : f))
  }, [folder])

  const deleteEmail = useCallback(async (uid: number) => {
    await api(`/messages/${uid}?folder=${encodeURIComponent(folder)}`, tokenRef.current, { method: "DELETE" })
    setSelected(null); await fetchMessages()
  }, [folder, fetchMessages])

  const moveEmail = useCallback(async (uid: number, destination: string) => {
    await api(`/messages/${uid}/move`, tokenRef.current, { method: "POST", body: JSON.stringify({ folder, destination }) })
    setSelected(null); await fetchMessages()
  }, [folder, fetchMessages])

  useEffect(() => {
    if (auth) { fetchFolders(); setPage(1); setSelected(null) }
  }, [auth]) // eslint-disable-line

  useEffect(() => {
    if (auth) { fetchMessages(); setSelected(null) }
  }, [auth, folder, page]) // eslint-disable-line

  const totalPages = Math.max(Math.ceil(total / limit), 1)
  const sortedMessages = [...messages].sort((a, b) => {
    switch (sort) {
      case "date-asc": return new Date(a.date).getTime() - new Date(b.date).getTime()
      case "date-desc": return new Date(b.date).getTime() - new Date(a.date).getTime()
      case "from-asc": return a.from.localeCompare(b.from)
      case "from-desc": return b.from.localeCompare(a.from)
      case "subject-asc": return a.subject.localeCompare(b.subject)
      case "subject-desc": return b.subject.localeCompare(a.subject)
      case "size-desc": return b.size - a.size
      case "size-asc": return a.size - b.size
      default: return 0
    }
  })

  return {
    isAuthenticated: !!auth,
    email: auth?.email || "",
    accounts, switchAccount, removeAccountByEmail,
    doLogin, doLogout, loggingIn, loginError,
    folders, folder, setFolder,
    messages: sortedMessages, total, page, setPage, totalPages,
    sort, setSort,
    selected, setSelected, fetchMessage,
    loading, loadingMsg,
    sendEmail, replyEmail, deleteEmail, moveEmail,
    markRead, starEmail, markAllReadInFolder,
    refresh: () => { fetchFolders(); fetchMessages() },
  }
}
