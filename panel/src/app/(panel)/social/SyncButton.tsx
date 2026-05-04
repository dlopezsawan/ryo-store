"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { syncSocialAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

/**
 * Botón "Sync" que llama al endpoint POST /admin/social/sync del backend.
 *
 * El sync re-lee `storefront/scripts/social/dashboard.html`, copia toda la
 * media nueva a `/static/social-media/...` y upsertea posts + stories en DB.
 * Es idempotente — no pisa status, feedback ni scheduled_at existentes.
 */
export function SyncButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [lastSync, setLastSync] = useState<{ posts: number; stories: number; at: Date } | null>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 5000)
  }

  function sync() {
    startTransition(async () => {
      const res = await syncSocialAction()
      if (!res.ok) return flash("err", res.error)
      setLastSync({ posts: res.posts, stories: res.stories, at: new Date() })
      flash("ok", `Sync OK · ${res.posts} posts + ${res.stories} stories`)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        title={lastSync
          ? `Última sync: ${lastSync.at.toLocaleTimeString("es-VE")} · ${lastSync.posts} posts + ${lastSync.stories} stories`
          : "Re-sincronizar contenido desde storefront/scripts/social/dashboard.html"}
        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <RefreshCw size={11} strokeWidth={2.5} className={pending ? "animate-spin" : ""} />
        {pending ? "Sincronizando…" : "Sync"}
      </button>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
