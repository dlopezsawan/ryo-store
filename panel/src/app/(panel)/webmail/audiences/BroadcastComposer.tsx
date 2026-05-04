"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Megaphone, Send, Calendar, AlertCircle, CheckCircle2 } from "lucide-react"
import { createAndSendBroadcastAction } from "../actions"

interface AudienceOption {
  id: string
  name: string
  contactCount: number
}

interface Props {
  audiences: AudienceOption[]
  defaultFrom: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null
type Mode = "draft" | "send_now" | "schedule"

export function BroadcastComposer({ audiences, defaultFrom }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState({
    audience_id: audiences[0]?.id ?? "",
    name: "",
    subject: "",
    body: "",
    mode: "draft" as Mode,
    scheduled_at: "",
  })

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 5000)
  }

  function submit() {
    startTransition(async () => {
      const res = await createAndSendBroadcastAction({
        audience_id: form.audience_id,
        name: form.name || undefined,
        subject: form.subject,
        body: form.body,
        send_now: form.mode === "send_now" || form.mode === "schedule",
        scheduled_at: form.mode === "schedule" && form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : undefined,
      })
      if (!res.ok) return flash("err", res.error)
      const aud = audiences.find((a) => a.id === form.audience_id)
      flash(
        "ok",
        form.mode === "send_now"
          ? `Broadcast enviado a ${aud?.contactCount ?? 0} contacto(s)`
          : form.mode === "schedule"
            ? `Broadcast programado · ${form.scheduled_at}`
            : "Broadcast guardado como draft (envíalo desde Resend dashboard)",
      )
      setForm({
        audience_id: form.audience_id,
        name: "",
        subject: "",
        body: "",
        mode: "draft",
        scheduled_at: "",
      })
      setOpen(false)
      router.refresh()
    })
  }

  if (audiences.length === 0) return null

  const selectedAud = audiences.find((a) => a.id === form.audience_id)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
        style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
      >
        <Megaphone size={13} strokeWidth={2.5} /> Nueva campaña
      </button>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && setOpen(false)}>
          <div className="bg-page rounded-md max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1 flex items-center gap-2">
              <Megaphone size={18} className="text-orange" /> Nueva campaña
            </h3>
            <p className="text-[11px] text-ink-3 mb-4">
              Newsletter masivo a una audience de Resend · From: <code className="font-mono text-orange">{defaultFrom}</code>
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Audience *">
                  <select value={form.audience_id} onChange={(e) => setForm((f) => ({ ...f, audience_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
                    {audiences.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.contactCount} contactos)</option>
                    ))}
                  </select>
                </Field>
                <Field label="Nombre interno (opcional)">
                  <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="ej. Restock Mayo 2026"
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </Field>
              </div>

              <Field label="Asunto *">
                <input type="text" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Lo que verán en su bandeja"
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>

              <Field label="Mensaje (HTML o texto plano)">
                <textarea rows={10} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Texto plano se convierte automáticamente a HTML simple"
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none resize-none" style={{ border: "1.5px solid var(--border)" }} />
                <p className="text-[10px] text-ink-3 font-mono mt-1">
                  Se enviará a {selectedAud?.contactCount ?? 0} contactos
                </p>
              </Field>

              <div>
                <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-2">
                  Cuándo
                </label>
                <div className="flex items-center gap-2">
                  <ModeButton active={form.mode === "draft"} onClick={() => setForm((f) => ({ ...f, mode: "draft" }))}>
                    Guardar borrador
                  </ModeButton>
                  <ModeButton active={form.mode === "send_now"} onClick={() => setForm((f) => ({ ...f, mode: "send_now" }))}>
                    Enviar ahora
                  </ModeButton>
                  <ModeButton active={form.mode === "schedule"} onClick={() => setForm((f) => ({ ...f, mode: "schedule" }))}>
                    Programar
                  </ModeButton>
                </div>
                {form.mode === "schedule" && (
                  <div className="mt-2 flex items-center gap-2">
                    <Calendar size={14} className="text-ink-3" />
                    <input type="datetime-local" value={form.scheduled_at}
                      onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpen(false)} disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)" }}>
                Cancelar
              </button>
              <button type="button" onClick={submit}
                disabled={pending || !form.audience_id || !form.subject.trim() || !form.body.trim() || (form.mode === "schedule" && !form.scheduled_at)}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
                <Send size={13} strokeWidth={2.5} />
                {pending ? "..." : form.mode === "draft" ? "Guardar draft" : form.mode === "schedule" ? "Programar" : "Enviar ahora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
        active ? "bg-dark text-cream" : "bg-cream text-ink-3 hover:text-ink"
      }`}
      style={{ border: "1.5px solid var(--border)" }}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
