"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Trash2, Download, AlertCircle, CheckCircle2, Radio } from "lucide-react"
import { createDraftOrderAction } from "./actions"

interface RegionOption { id: string; name: string; currency_code: string }
interface SalesChannelOption { id: string; name: string }

interface Props {
  regions: RegionOption[]
  salesChannels: SalesChannelOption[]
  /** URL params actuales del listing — se preservan en el export */
  exportQuery: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null

interface ItemDraft {
  title: string
  quantity: number
  unit_price: number
}

export function OrderHeaderActions({ regions, salesChannels, exportQuery }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState({
    email: "",
    region_id: regions[0]?.id ?? "",
    sales_channel_id: salesChannels[0]?.id ?? "",
  })
  const [items, setItems] = useState<ItemDraft[]>([{ title: "", quantity: 1, unit_price: 0 }])

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function updateItem(i: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((arr) => [...arr, { title: "", quantity: 1, unit_price: 0 }])
  }

  function removeItem(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i))
  }

  function submit() {
    startTransition(async () => {
      const region = regions.find((r) => r.id === form.region_id)
      const res = await createDraftOrderAction({
        email: form.email,
        region_id: form.region_id,
        sales_channel_id: form.sales_channel_id || undefined,
        currency_code: region?.currency_code,
        items,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", `Draft order #${res.data?.display_id} creado`)
      setOpen(false)
      if (res.data?.id) router.push(`/orders/${res.data.id}`)
    })
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const exportUrl = `/orders/export${exportQuery ? `?${exportQuery}` : ""}`

  return (
    <>
      <Link
        href="/orders/live"
        className="flex items-center gap-1.5 px-3 py-2 bg-primary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90"
        style={{ border: "1.5px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <Radio size={11} strokeWidth={2.5} className="animate-pulse" /> LIVE
      </Link>
      <a
        href={exportUrl}
        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <Download size={11} strokeWidth={2.5} /> Exportar CSV
      </a>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={regions.length === 0}
        title={regions.length === 0 ? "Necesitas al menos una región para crear órdenes" : "Crear pedido manual"}
        className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
      >
        <Plus size={11} strokeWidth={3} /> Nuevo manual
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
            className="bg-page rounded-md max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1">
              Nuevo pedido manual
            </h3>
            <p className="text-[11px] text-ink-3 mb-4">
              Crea un draft order — útil para pedidos por WhatsApp, mayoristas, o registro manual.
              Después puedes editarlo y capturar el pago desde el detail.
            </p>

            <div className="space-y-3">
              <Field label="Email del cliente *">
                <input
                  type="email"
                  autoFocus
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] font-mono focus:outline-none"
                  style={{ border: "1.5px solid var(--border)" }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Región *">
                  <select
                    value={form.region_id}
                    onChange={(e) => setForm((f) => ({ ...f, region_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  >
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.currency_code.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sales Channel">
                  <select
                    value={form.sales_channel_id}
                    onChange={(e) => setForm((f) => ({ ...f, sales_channel_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  >
                    {salesChannels.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2">
                    Líneas del pedido
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-orange hover:underline text-[10px] font-display font-bold uppercase tracking-wider flex items-center gap-1"
                  >
                    <Plus size={10} strokeWidth={3} /> Añadir línea
                  </button>
                </div>
                <div className="space-y-1.5">
                  {items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Título"
                        value={it.title}
                        onChange={(e) => updateItem(i, { title: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
                        style={{ border: "1.5px solid var(--border)" }}
                      />
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
                        className="w-16 px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
                        style={{ border: "1.5px solid var(--border)" }}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="precio"
                        value={it.unit_price || ""}
                        onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) || 0 })}
                        className="w-24 px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
                        style={{ border: "1.5px solid var(--border)" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        className="text-ink-3 hover:text-primary p-1 disabled:opacity-30"
                      >
                        <Trash2 size={12} strokeWidth={2.4} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="text-right text-[12px] font-mono num mt-2 pt-2" style={{ borderTop: "1.5px dashed var(--border)" }}>
                  Total: <span className="font-display font-black text-[14px]">{total.toFixed(2)}</span>
                </div>
              </div>
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
                onClick={submit}
                disabled={pending || !form.email.trim() || !form.region_id || items.every((i) => !i.title.trim())}
                className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
              >
                {pending ? "Creando…" : "Crear draft"}
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
