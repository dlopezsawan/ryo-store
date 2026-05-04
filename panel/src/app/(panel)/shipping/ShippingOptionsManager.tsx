"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Pencil, Check, X, Truck, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  createShippingOptionAction, updateShippingOptionAction, deleteShippingOptionAction,
} from "./actions"

export interface ShippingOptionRow {
  id: string
  name: string
  price_type: "flat" | "calculated"
  amount: number | null
  currency: string
  service_zone_id: string
  shipping_profile_id: string
  provider_id: string
  type_label: string
}

interface Props {
  /** Por profile */
  profileId: string
  profileName: string
  rows: ShippingOptionRow[]
  /** Service zones disponibles para crear options */
  serviceZones: Array<{ id: string; name: string }>
  /** Providers disponibles */
  providers: Array<{ id: string }>
  defaultCurrency: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function ShippingOptionsManager({ profileId, profileName, rows, serviceZones, providers, defaultCurrency }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <>
      <div className="px-5 py-2 border-t border-warm-200/50 flex items-center justify-end" style={{ background: "rgb(var(--surface-2))" }}>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          disabled={serviceZones.length === 0 || providers.length === 0}
          title={serviceZones.length === 0 ? "Necesitas al menos una service zone" : "Crear opción de envío"}
          className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva opción
        </button>
      </div>

      {creating && (
        <CreateForm
          profileId={profileId}
          serviceZones={serviceZones}
          providers={providers}
          defaultCurrency={defaultCurrency}
          pending={pending}
          onCancel={() => setCreating(false)}
          onSubmit={(input) => {
            startTransition(async () => {
              const r = await createShippingOptionAction(input)
              if (!r.ok) return flash("err", r.error)
              flash("ok", `Opción "${input.name}" creada en ${profileName}`)
              setCreating(false)
              router.refresh()
            })
          }}
        />
      )}

      {rows.length === 0 ? (
        <div className="p-6 text-center text-[12px] text-ink-3">
          Sin opciones de envío en este profile.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Opción</th>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Tipo</th>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Provider</th>
              <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2">Precio</th>
              <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2 w-32">Acción</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {rows.map((opt) => (
              editingId === opt.id ? (
                <EditRow
                  key={opt.id}
                  opt={opt}
                  pending={pending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(patch) => {
                    startTransition(async () => {
                      const r = await updateShippingOptionAction(opt.id, patch)
                      if (!r.ok) return flash("err", r.error)
                      flash("ok", "Opción actualizada")
                      setEditingId(null)
                      router.refresh()
                    })
                  }}
                />
              ) : (
                <tr key={opt.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                  <td className="px-3 py-3 font-display font-bold text-ink">
                    <div className="flex items-center gap-2">
                      <Truck size={13} strokeWidth={2.2} className="text-ink-3" />
                      {opt.name}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-ink-2">{opt.type_label}</td>
                  <td className="px-3 py-3 font-mono text-[10px] text-ink-3">{opt.provider_id}</td>
                  <td className="px-3 py-3 text-right">
                    {opt.price_type === "calculated" ? (
                      <span className="text-[11px] font-display font-bold uppercase text-orange">Calculado</span>
                    ) : (
                      <span className="font-display font-black text-[14px] num">
                        {opt.amount != null ? `${opt.currency.toUpperCase()} ${opt.amount.toFixed(2)}` : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {confirmDelId === opt.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startTransition(async () => {
                            const r = await deleteShippingOptionAction(opt.id)
                            if (!r.ok) return flash("err", r.error)
                            flash("ok", "Opción eliminada")
                            setConfirmDelId(null)
                            router.refresh()
                          })}
                          disabled={pending}
                          className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                        <button onClick={() => setConfirmDelId(null)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingId(opt.id)} className="text-ink-3 hover:text-orange p-1" title="Editar">
                          <Pencil size={11} strokeWidth={2.4} />
                        </button>
                        <button onClick={() => setConfirmDelId(opt.id)} className="text-ink-3 hover:text-primary p-1" title="Eliminar">
                          <Trash2 size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}

function CreateForm({
  profileId, serviceZones, providers, defaultCurrency, pending, onCancel, onSubmit,
}: {
  profileId: string
  serviceZones: Array<{ id: string; name: string }>
  providers: Array<{ id: string }>
  defaultCurrency: string
  pending: boolean
  onCancel: () => void
  onSubmit: (input: Parameters<typeof createShippingOptionAction>[0]) => void
}) {
  const [form, setForm] = useState({
    name: "",
    service_zone_id: serviceZones[0]?.id ?? "",
    provider_id: providers[0]?.id ?? "",
    price_type: "flat" as "flat" | "calculated",
    price_amount: 0,
    currency_code: defaultCurrency,
  })

  return (
    <div className="p-4 bg-orange/5" style={{ borderBottom: "1.5px dashed #FF3B27" }}>
      <div className="grid grid-cols-6 gap-2">
        <input
          type="text"
          placeholder="Nombre *"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="col-span-2 px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
        <select
          value={form.service_zone_id}
          onChange={(e) => setForm((f) => ({ ...f, service_zone_id: e.target.value }))}
          className="px-3 py-2 bg-cream rounded-md text-[11px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        >
          {serviceZones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
        <select
          value={form.provider_id}
          onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value }))}
          className="px-3 py-2 bg-cream rounded-md text-[11px] font-mono focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.id}</option>
          ))}
        </select>
        <select
          value={form.price_type}
          onChange={(e) => setForm((f) => ({ ...f, price_type: e.target.value as typeof f.price_type }))}
          className="px-3 py-2 bg-cream rounded-md text-[11px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        >
          <option value="flat">Flat</option>
          <option value="calculated">Calculado</option>
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="precio"
          value={form.price_amount || ""}
          onChange={(e) => setForm((f) => ({ ...f, price_amount: Number(e.target.value) || 0 }))}
          disabled={form.price_type === "calculated"}
          className="px-3 py-2 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}
        />
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button type="button" onClick={onCancel} disabled={pending}
          className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSubmit({
            name: form.name,
            service_zone_id: form.service_zone_id,
            shipping_profile_id: profileId,
            provider_id: form.provider_id,
            price_type: form.price_type,
            price_amount: form.price_amount,
            currency_code: form.currency_code,
          })}
          disabled={pending || !form.name.trim() || !form.service_zone_id || !form.provider_id}
          className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          {pending ? "Creando…" : "Crear opción"}
        </button>
      </div>
    </div>
  )
}

function EditRow({ opt, pending, onCancel, onSubmit }: {
  opt: ShippingOptionRow
  pending: boolean
  onCancel: () => void
  onSubmit: (patch: Parameters<typeof updateShippingOptionAction>[1]) => void
}) {
  const [form, setForm] = useState({
    name: opt.name,
    price_type: opt.price_type,
    price_amount: opt.amount ?? 0,
    currency_code: opt.currency,
  })
  return (
    <tr className="bg-orange/5 border-b border-warm-200/50">
      <td className="px-3 py-2">
        <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full px-2 py-1 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
      </td>
      <td className="px-3 py-2">
        <select value={form.price_type} onChange={(e) => setForm((f) => ({ ...f, price_type: e.target.value as typeof f.price_type }))}
          className="w-full px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
          <option value="flat">Flat</option>
          <option value="calculated">Calculado</option>
        </select>
      </td>
      <td className="px-3 py-2 font-mono text-[10px] text-ink-3">{opt.provider_id}</td>
      <td className="px-3 py-2 text-right">
        <input type="number" min={0} step="0.01" value={form.price_amount}
          disabled={form.price_type === "calculated"}
          onChange={(e) => setForm((f) => ({ ...f, price_amount: Number(e.target.value) || 0 }))}
          className="w-24 px-2 py-1 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onSubmit({
            name: form.name,
            price_type: form.price_type,
            price_amount: form.price_amount,
            currency_code: form.currency_code,
          })} disabled={pending} className="text-secondary p-1 disabled:opacity-50">
            <Check size={13} strokeWidth={3} />
          </button>
          <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1 disabled:opacity-50">
            <X size={13} strokeWidth={3} />
          </button>
        </div>
      </td>
    </tr>
  )
}
