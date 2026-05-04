"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Ban, Copy, KeyRound, AlertCircle, CheckCircle2, X } from "lucide-react"
import { createApiKeyAction, revokeApiKeyAction, deleteApiKeyAction } from "./actions"

interface KeyRow {
  id: string
  title: string
  type: "publishable" | "secret"
  redacted: string
  created_at: string
  revoked_at: string | null
  last_used_at: string | null
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function ApiKeysManager({ rows }: { rows: KeyRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<{ title: string; type: "publishable" | "secret" }>({ title: "", type: "publishable" })
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<{ token: string; type: string } | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 5000)
  }

  function create() {
    startTransition(async () => {
      const res = await createApiKeyAction(draft)
      if (!res.ok) return flash("err", res.error)
      if (res.data?.token) setRevealed({ token: res.data.token, type: res.data.type })
      flash("ok", "API key creada · cópiala ahora, no se vuelve a mostrar")
      setDraft({ title: "", type: "publishable" })
      setCreating(false)
      router.refresh()
    })
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeApiKeyAction(id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "API key revocada")
      router.refresh()
    })
  }

  function del(id: string) {
    startTransition(async () => {
      const res = await deleteApiKeyAction(id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "API key eliminada")
      setConfirmDelId(null)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-ink-3 font-mono">
          {rows.length} key{rows.length === 1 ? "" : "s"} ·{" "}
          {rows.filter((r) => !r.revoked_at).length} activa{rows.filter((r) => !r.revoked_at).length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva API key
        </button>
      </div>

      {creating && (
        <div className="stamp-card p-4 mb-4 bg-orange/5">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Título (ej. storefront prod) *"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <select
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as typeof d.type }))}
              className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            >
              <option value="publishable">Publishable (frontend)</option>
              <option value="secret">Secret (server-only)</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <button type="button" onClick={() => { setCreating(false); setDraft({ title: "", type: "publishable" }) }} disabled={pending} className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
              Cancelar
            </button>
            <button type="button" onClick={create} disabled={pending || !draft.title.trim()} className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1.5px solid #1A1A1A" }}>
              {pending ? "Creando…" : "Crear"}
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <RevealedTokenModal
          type={revealed.type}
          token={revealed.token}
          onClose={() => setRevealed(null)}
          flash={flash}
        />
      )}

      {rows.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin API keys todavía
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            Las publishable se usan en el frontend; las secret solo server-side.
          </p>
        </div>
      ) : (
        <div className="stamp-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-dark text-cream text-[10px] uppercase tracking-[0.12em]">
                <th className="px-3 py-2.5 text-left font-display font-bold">Título</th>
                <th className="px-3 py-2.5 text-left font-display font-bold">Tipo</th>
                <th className="px-3 py-2.5 text-left font-display font-bold">Token (redacted)</th>
                <th className="px-3 py-2.5 text-left font-display font-bold">Estado</th>
                <th className="px-3 py-2.5 text-right font-display font-bold w-32">Acción</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {rows.map((k) => {
                const revoked = !!k.revoked_at
                return (
                  <tr key={k.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-3 font-display font-bold text-ink">{k.title}</td>
                    <td className="px-3 py-3">
                      <span className={`pill ${k.type === "secret" ? "text-primary" : "text-secondary"}`}>
                        <span className="pill-dot" />{k.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-ink-2">{k.redacted}</td>
                    <td className="px-3 py-3">
                      {revoked ? (
                        <span className="pill text-ink-3"><span className="pill-dot" />Revocada</span>
                      ) : (
                        <span className="pill text-secondary"><span className="pill-dot" />Activa</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {confirmDelId === k.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => del(k.id)} disabled={pending} className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
                            Confirmar
                          </button>
                          <button onClick={() => setConfirmDelId(null)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {!revoked && (
                            <button onClick={() => revoke(k.id)} disabled={pending} className="text-ink-3 hover:text-orange p-1 disabled:opacity-50" title="Revocar (no se puede deshacer)">
                              <Ban size={11} strokeWidth={2.4} />
                            </button>
                          )}
                          <button onClick={() => setConfirmDelId(k.id)} className="text-ink-3 hover:text-primary p-1" title="Eliminar permanentemente">
                            <Trash2 size={11} strokeWidth={2.4} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{
            background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E",
            color: "#fff",
            border: "2px solid #1A1A1A",
            boxShadow: "4px 4px 0 0 var(--shadow-color)",
            minWidth: 280,
            maxWidth: 480,
          }}
        >
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

function RevealedTokenModal({
  type, token, onClose, flash,
}: {
  type: string; token: string; onClose: () => void; flash: (k: "ok" | "err", m: string) => void
}) {
  function copy() {
    navigator.clipboard?.writeText(token).then(
      () => flash("ok", "Token copiado al clipboard"),
      () => flash("err", "No se pudo copiar"),
    )
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-page rounded-md max-w-lg w-full p-6" style={{ border: "2.5px solid #FF3B27", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}>
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={16} className="text-orange" />
          <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink">
            API key creada
          </h3>
        </div>
        <p className="text-[12px] text-ink-2 mb-3">
          ⚠ Cópiala ahora. Una vez cierres este modal, <strong>no se vuelve a mostrar</strong>. Tipo: <code className="font-mono text-orange">{type}</code>
        </p>
        <div className="bg-cream-2 rounded-md p-3 mb-3" style={{ border: "1.5px solid var(--border)" }}>
          <code className="text-[12px] font-mono break-all">{token}</code>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}
          >
            <Copy size={11} strokeWidth={2.5} /> Copiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
            style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
          >
            Cerrar (irreversible)
          </button>
        </div>
      </div>
    </div>
  )
}
