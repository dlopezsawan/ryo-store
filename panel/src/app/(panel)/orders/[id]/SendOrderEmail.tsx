"use client"

import { useState, useTransition } from "react"
import { Mail, Send, AlertCircle, CheckCircle2 } from "lucide-react"
import { sendOrderEmailAction } from "./actions"

interface OrderItem {
  title: string
  quantity: number
  unit_price: number
}

interface Props {
  orderId: string
  displayId: number
  customerEmail: string
  customerName: string
  total?: number
  currency?: string
  items?: OrderItem[]
  trackingUrl?: string | null
}

type Toast = { kind: "ok" | "err"; msg: string } | null

interface TplCtx {
  name: string
  displayId: number
  total: number
  currency: string
  items: OrderItem[]
  trackingUrl: string | null
}

const TEMPLATES: Array<{
  key: string
  label: string
  subject: (c: TplCtx) => string
  body: (c: TplCtx) => string
}> = [
  {
    key: "received",
    label: "Pedido recibido",
    subject: (c) => `Recibimos tu pedido #${c.displayId} ✓`,
    body: (c) => `Hola ${c.name},\n\nGracias por tu pedido #${c.displayId}. Lo procesamos en las próximas horas y te avisamos cuando salga.\n\nSi tienes cualquier duda, responde a este email.\n\n— Equipo Enrola`,
  },
  {
    key: "shipped",
    label: "Pedido enviado",
    subject: (c) => `Tu pedido #${c.displayId} está en camino 📦`,
    body: (c) => {
      const tracking = c.trackingUrl ? `\n\nPuedes seguir el envío aquí: ${c.trackingUrl}` : ""
      return `Hola ${c.name},\n\nTu pedido #${c.displayId} ya salió y debería llegar pronto.${tracking}\n\nGracias por confiar en nosotros.\n\n— Equipo Enrola`
    },
  },
  {
    key: "delivered",
    label: "Pedido entregado",
    subject: (c) => `¿Cómo te fue con tu pedido #${c.displayId}?`,
    body: (c) => `Hola ${c.name},\n\nVemos que tu pedido #${c.displayId} ya fue entregado. Esperamos que todo haya llegado en perfecto estado.\n\nSi tienes cualquier comentario, simplemente responde a este email — leemos cada uno.\n\n— Equipo Enrola`,
  },
  {
    key: "invoice",
    label: "Factura / detalle",
    subject: (c) => `Detalle de tu pedido #${c.displayId} — ${c.currency.toUpperCase()} ${c.total.toFixed(2)}`,
    body: (c) => {
      const lines = c.items.map((it) => {
        const sub = (Number(it.unit_price) * it.quantity).toFixed(2)
        return `  · ${it.quantity}x ${it.title} — ${c.currency.toUpperCase()} ${sub}`
      }).join("\n")
      return `Hola ${c.name},\n\nAcá te paso el detalle de tu pedido #${c.displayId}:\n\n${lines}\n\n  TOTAL: ${c.currency.toUpperCase()} ${c.total.toFixed(2)}\n\nSi necesitas factura formal, responde a este email con tu RIF o cédula.\n\n— Equipo Enrola`
    },
  },
  {
    key: "payment_reminder",
    label: "Recordatorio de pago",
    subject: (c) => `Recordatorio: pago pendiente del pedido #${c.displayId}`,
    body: (c) => `Hola ${c.name},\n\nEste es un recordatorio amistoso de que tu pedido #${c.displayId} (${c.currency.toUpperCase()} ${c.total.toFixed(2)}) sigue pendiente de pago.\n\nSi ya pagaste, ignora este mensaje. Si necesitas datos para Pago Móvil o USDT, responde aquí y te los pasamos al instante.\n\n— Equipo Enrola`,
  },
  {
    key: "blank",
    label: "En blanco",
    subject: () => "",
    body: () => "",
  },
]

export function SendOrderEmail({
  orderId, displayId, customerEmail, customerName,
  total = 0, currency = "eur", items = [], trackingUrl = null,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [tplKey, setTplKey] = useState("received")

  const ctx: TplCtx = {
    name: customerName,
    displayId,
    total,
    currency,
    items,
    trackingUrl,
  }

  const [form, setForm] = useState(() => ({
    to: customerEmail,
    subject: TEMPLATES[0].subject(ctx),
    body: TEMPLATES[0].body(ctx),
  }))

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function applyTemplate(key: string) {
    const tpl = TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0]
    setTplKey(key)
    setForm((f) => ({
      ...f,
      subject: tpl.subject(ctx),
      body: tpl.body(ctx),
    }))
  }

  function send() {
    startTransition(async () => {
      const res = await sendOrderEmailAction({
        orderId,
        to: form.to,
        subject: form.subject,
        body: form.body,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", `Email enviado a ${form.to}`)
      setOpen(false)
    })
  }

  const validEmail = customerEmail && customerEmail.includes("@")

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!validEmail}
        title={validEmail ? "Enviar email al cliente" : "El pedido no tiene email"}
        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <Mail size={13} strokeWidth={2.5} /> Email cliente
      </button>

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

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-page rounded-md max-w-2xl w-full p-6"
            style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1">
              Enviar email · pedido #{displayId}
            </h3>
            <p className="text-[11px] text-ink-3 font-mono mb-4">vía Resend · tag order_id={orderId.slice(0, 12)}…</p>

            {/* Templates */}
            <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1" style={{ borderBottom: "2px dashed var(--border)" }}>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => applyTemplate(tpl.key)}
                  className={`px-3 py-1.5 font-display font-bold text-[10px] uppercase tracking-wider rounded-md whitespace-nowrap ${
                    tplKey === tpl.key ? "bg-dark text-cream" : "hover:bg-cream-2 text-ink-3"
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Field label="Para">
                <input
                  type="email"
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
                  rows={9}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none"
                  style={{ border: "1.5px solid var(--border)" }}
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={send}
                disabled={pending || !form.to.trim() || !form.subject.trim() || !form.body.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
              >
                <Send size={13} strokeWidth={2.5} /> {pending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
