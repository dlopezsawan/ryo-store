"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Send, AlertCircle, CheckCircle2, FileText, Save, Trash2, X } from "lucide-react"
import { sendTransactionalAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

interface Template {
  id: string
  name: string
  subject: string
  body: string
  createdAt: number
}

const STORAGE_KEY = "panel_webmail_templates"

const PRESETS: Template[] = [
  {
    id: "preset-welcome",
    name: "Bienvenida",
    subject: "Gracias por tu compra en Ryo Store, {{nombre}}",
    body: `Hola {{nombre}},

Gracias por confiar en nosotros. Tu pedido #{{pedido}} ha sido recibido y lo estamos preparando.

Cualquier consulta, respondé directo a este email.

— Equipo Ryo`,
    createdAt: 0,
  },
  {
    id: "preset-shipped",
    name: "Pedido enviado",
    subject: "Tu pedido #{{pedido}} está en camino 📦",
    body: `Hola {{nombre}},

Buenas noticias — tu pedido #{{pedido}} ya salió de nuestra ubicación y va camino a tu dirección.

Tracking: {{tracking}}

— Equipo Ryo`,
    createdAt: 0,
  },
  {
    id: "preset-followup",
    name: "Follow-up post-compra",
    subject: "¿Cómo te fue con tu pedido, {{nombre}}?",
    body: `Hola {{nombre}},

Pasaron unos días desde que recibiste el pedido #{{pedido}}. Nos encantaría saber qué te pareció.

Si tenés un momento, déjanos un review — nos ayuda mucho.

Saludos,
Equipo Ryo`,
    createdAt: 0,
  },
]

const VARIABLES = ["nombre", "pedido", "email", "total", "tracking"]

export function SendEmailForm({ defaultFrom }: { defaultFrom: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    to: "",
    subject: "",
    body: "",
    from: defaultFrom,
  })
  const [toast, setToast] = useState<Toast>(null)

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [savingName, setSavingName] = useState("")
  const [showSave, setShowSave] = useState(false)

  // Variables: customer-specific values that get substituted into {{vars}}
  const [vars, setVars] = useState<Record<string, string>>({
    nombre: "", pedido: "", email: "", total: "", tracking: "",
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setTemplates(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  function persistTemplates(next: Template[]) {
    setTemplates(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function applyTemplate(t: Template) {
    setForm((f) => ({ ...f, subject: t.subject, body: t.body }))
    setShowTemplates(false)
  }

  function saveTemplate() {
    if (!savingName.trim()) return
    const t: Template = {
      id: `t_${Date.now().toString(36)}`,
      name: savingName.trim(),
      subject: form.subject,
      body: form.body,
      createdAt: Date.now(),
    }
    persistTemplates([...templates, t])
    setSavingName("")
    setShowSave(false)
    flash("ok", "Template guardado")
  }

  function deleteTemplate(id: string) {
    persistTemplates(templates.filter((t) => t.id !== id))
  }

  function insertVariable(name: string) {
    // Insert {{name}} en el body al final (textarea sin ref para mantener simple)
    setForm((f) => ({ ...f, body: f.body + `{{${name}}}` }))
  }

  // Substitute {{var}} → vars[var] for preview / send
  function substitute(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
  }

  const finalSubject = substitute(form.subject)
  const finalBody = substitute(form.body)
  const hasUnresolved = (finalSubject + finalBody).match(/\{\{\w+\}\}/) !== null

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 5000)
  }

  function send() {
    startTransition(async () => {
      const res = await sendTransactionalAction({
        to: form.to,
        subject: finalSubject,  // con variables sustituidas
        body: finalBody,         // con variables sustituidas
        from: form.from,
        tags: [{ name: "source", value: "panel-manual" }],
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", `Email enviado · id ${res.id?.slice(0, 8)}…`)
      setForm({ to: "", subject: "", body: "", from: defaultFrom })
      setVars({ nombre: "", pedido: "", email: "", total: "", tracking: "" })
      router.refresh()
    })
  }

  return (
    <div className="stamp-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
          Enviar email
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplates(!showTemplates)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
              showTemplates ? "bg-orange text-dark" : "bg-cream text-ink hover:bg-cream-2"
            }`}
            style={{ border: "1.5px solid var(--border)" }}>
            <FileText size={11} strokeWidth={2.5} /> Templates ({PRESETS.length + templates.length})
          </button>
          {(form.subject || form.body) && (
            <button onClick={() => setShowSave(true)}
              className="flex items-center gap-1 px-2 py-1 bg-cream text-ink rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
              style={{ border: "1.5px solid var(--border)" }}>
              <Save size={11} strokeWidth={2.5} /> Guardar
            </button>
          )}
        </div>
      </div>

      {/* Save template inline */}
      {showSave && (
        <div className="mb-3 p-2 bg-orange/5 rounded-md flex items-center gap-2" style={{ border: "1.5px dashed #FF3B27" }}>
          <input type="text" value={savingName} onChange={(e) => setSavingName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveTemplate() }}
            placeholder="Nombre del template (ej: Bienvenida v2)"
            autoFocus
            className="flex-1 px-2 py-1 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
          <button onClick={saveTemplate} disabled={!savingName.trim()}
            className="px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }}>
            Guardar
          </button>
          <button onClick={() => { setShowSave(false); setSavingName("") }} className="text-ink-3 p-1">
            <X size={11} />
          </button>
        </div>
      )}

      {/* Templates list */}
      {showTemplates && (
        <div className="mb-4 p-3 bg-cream-2/40 rounded-md space-y-2" style={{ border: "1.5px solid var(--border)" }}>
          <div className="text-[9px] font-display font-bold uppercase tracking-wider text-ink-3">PRESETS</div>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((t) => (
              <button key={t.id} onClick={() => applyTemplate(t)}
                className="text-left p-2 bg-cream rounded-md hover:bg-orange/10 transition-colors"
                style={{ border: "1.5px solid var(--border-soft)" }}>
                <div className="font-display font-bold text-[11px] text-ink truncate">{t.name}</div>
                <div className="text-[10px] text-ink-3 font-mono truncate">{t.subject}</div>
              </button>
            ))}
          </div>
          {templates.length > 0 && (
            <>
              <div className="text-[9px] font-display font-bold uppercase tracking-wider text-orange mt-2">TUS TEMPLATES</div>
              <div className="grid grid-cols-3 gap-2">
                {templates.map((t) => (
                  <div key={t.id} className="relative group">
                    <button onClick={() => applyTemplate(t)}
                      className="w-full text-left p-2 bg-cream rounded-md hover:bg-orange/10 transition-colors"
                      style={{ border: "1.5px solid var(--border-soft)" }}>
                      <div className="font-display font-bold text-[11px] text-ink truncate pr-4">{t.name}</div>
                      <div className="text-[10px] text-ink-3 font-mono truncate">{t.subject}</div>
                    </button>
                    <button onClick={() => deleteTemplate(t.id)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-primary hover:bg-primary/10 p-0.5 rounded"
                      title="Eliminar template">
                      <Trash2 size={10} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Field label="De">
          <input
            type="text"
            value={form.from}
            onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </Field>
        <Field label="Para">
          <input
            type="email"
            placeholder="cliente@email.com"
            value={form.to}
            onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </Field>
        <Field label="Asunto">
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </Field>
        <Field label="Mensaje">
          <textarea
            rows={8}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Texto plano o HTML... usa {{nombre}} {{pedido}} para variables"
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none resize-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            <span className="text-[9px] font-display font-bold uppercase tracking-wider text-ink-3 mr-1">Insertar:</span>
            {VARIABLES.map((v) => (
              <button key={v} type="button" onClick={() => insertVariable(v)}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-cream-2 hover:bg-orange/15 hover:text-orange rounded-md transition-colors">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </Field>

        {/* Variables values panel — solo visible si hay {{vars}} en subject o body */}
        {(form.subject + form.body).match(/\{\{(\w+)\}\}/) && (
          <div className="p-3 bg-orange/5 rounded-md" style={{ border: "1.5px dashed #FF3B27" }}>
            <div className="text-[9px] font-display font-bold uppercase tracking-[0.18em] text-orange mb-2">
              Valores de variables
            </div>
            <div className="grid grid-cols-3 gap-2">
              {VARIABLES.filter((v) => (form.subject + form.body).includes(`{{${v}}}`)).map((v) => (
                <div key={v}>
                  <label className="block text-[9px] font-mono text-ink-3 mb-0.5">{`{{${v}}}`}</label>
                  <input
                    type="text"
                    value={vars[v] ?? ""}
                    onChange={(e) => setVars((vv) => ({ ...vv, [v]: e.target.value }))}
                    placeholder={v === "nombre" ? "Daniel" : v === "pedido" ? "1234" : v === "total" ? "€25" : ""}
                    className="w-full px-2 py-1 bg-cream rounded-md text-[11px] font-mono focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview con variables sustituidas */}
        {(form.subject || form.body) && (
          <div className="p-3 bg-cream-2/30 rounded-md text-[11px]" style={{ border: "1.5px solid var(--border-soft)" }}>
            <div className="text-[9px] font-display font-bold uppercase tracking-[0.18em] text-ink-3 mb-2">
              Preview {hasUnresolved && <span className="text-primary">· faltan completar variables</span>}
            </div>
            {finalSubject && (
              <div className="mb-1.5">
                <span className="font-display font-bold text-[10px] uppercase text-ink-3 mr-2">Asunto:</span>
                <span className="font-display font-bold">{finalSubject}</span>
              </div>
            )}
            {finalBody && (
              <pre className="font-mono text-[11px] whitespace-pre-wrap break-words text-ink-2">{finalBody}</pre>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-[10px] text-ink-3 font-mono">
          Resend · transactional · tag: panel-manual
        </p>
        <button
          type="button"
          onClick={send}
          disabled={pending || !form.to.trim() || !form.subject.trim() || !form.body.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Send size={13} strokeWidth={2.5} /> {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
