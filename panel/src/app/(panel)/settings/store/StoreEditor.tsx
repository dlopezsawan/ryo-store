"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, Plus, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { updateStoreAction } from "./actions"

interface CurrencyEntry {
  currency_code: string
  is_default: boolean
}

interface Props {
  storeId: string
  initial: {
    name: string
    default_sales_channel_id: string | null
    default_region_id: string | null
    supported_currencies: CurrencyEntry[]
  }
  salesChannels: Array<{ id: string; name: string }>
  regions: Array<{ id: string; name: string; currency_code: string }>
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function StoreEditor({ storeId, initial, salesChannels, regions }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(initial)
  const [newCurrency, setNewCurrency] = useState("")
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function addCurrency() {
    const code = newCurrency.trim().toLowerCase().slice(0, 3)
    if (!code || form.supported_currencies.some((c) => c.currency_code === code)) {
      setNewCurrency("")
      return
    }
    setForm((f) => ({
      ...f,
      supported_currencies: [...f.supported_currencies, { currency_code: code, is_default: f.supported_currencies.length === 0 }],
    }))
    setNewCurrency("")
  }

  function removeCurrency(code: string) {
    setForm((f) => {
      const remaining = f.supported_currencies.filter((c) => c.currency_code !== code)
      // Si quitamos el default, hacemos default al primero
      if (remaining.length > 0 && !remaining.some((c) => c.is_default)) {
        remaining[0].is_default = true
      }
      return { ...f, supported_currencies: remaining }
    })
  }

  function setDefaultCurrency(code: string) {
    setForm((f) => ({
      ...f,
      supported_currencies: f.supported_currencies.map((c) => ({ ...c, is_default: c.currency_code === code })),
    }))
  }

  function save() {
    startTransition(async () => {
      const patch: Parameters<typeof updateStoreAction>[1] = {}
      if (form.name !== initial.name) patch.name = form.name
      if (form.default_sales_channel_id !== initial.default_sales_channel_id) {
        patch.default_sales_channel_id = form.default_sales_channel_id
      }
      if (form.default_region_id !== initial.default_region_id) {
        patch.default_region_id = form.default_region_id
      }
      const currChanged =
        form.supported_currencies.length !== initial.supported_currencies.length ||
        form.supported_currencies.some((c, i) => {
          const orig = initial.supported_currencies[i]
          return !orig || orig.currency_code !== c.currency_code || orig.is_default !== c.is_default
        })
      if (currChanged) patch.supported_currencies = form.supported_currencies

      if (Object.keys(patch).length === 0) {
        flash("ok", "Sin cambios")
        return
      }

      const res = await updateStoreAction(storeId, patch)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Tienda actualizada")
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="stamp-card p-5 space-y-4">
        <Field label="Nombre de la tienda">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[13px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Default Sales Channel">
            <select
              value={form.default_sales_channel_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, default_sales_channel_id: e.target.value || null }))}
              className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            >
              <option value="">— Ninguno —</option>
              {salesChannels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Default Region">
            <select
              value={form.default_region_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, default_region_id: e.target.value || null }))}
              className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            >
              <option value="">— Ninguna —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.currency_code.toUpperCase()})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-2">
            Monedas soportadas
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.supported_currencies.length === 0 && (
              <span className="text-[11px] text-ink-3 italic">Sin monedas configuradas</span>
            )}
            {form.supported_currencies.map((c) => (
              <span
                key={c.currency_code}
                onClick={() => setDefaultCurrency(c.currency_code)}
                className={`inline-flex items-center gap-1 text-[11px] font-mono uppercase pl-2 pr-1 py-1 rounded-md cursor-pointer transition-colors ${
                  c.is_default ? "bg-orange/15 text-orange" : "bg-cream-2 text-ink-2 hover:bg-cream-2/80"
                }`}
                style={{ border: c.is_default ? "1.5px solid #FF3B27" : "1px solid var(--border)" }}
                title={c.is_default ? "Default" : "Click para hacer default"}
              >
                {c.currency_code}
                {c.is_default && <span className="text-[9px] font-display font-bold uppercase">★</span>}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeCurrency(c.currency_code) }}
                  className="hover:bg-primary hover:text-white rounded p-0.5 transition-colors"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="eur, usd, ves..."
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value.toLowerCase().slice(0, 3))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addCurrency()
                }
              }}
              maxLength={3}
              className="w-32 px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <button
              type="button"
              onClick={addCurrency}
              disabled={!newCurrency.trim()}
              className="flex items-center gap-1 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
              style={{ border: "1.5px solid var(--border)" }}
            >
              <Plus size={11} strokeWidth={3} /> Añadir
            </button>
          </div>
          <p className="text-[10px] text-ink-3 font-mono mt-1.5">
            Click en una moneda para marcarla como default · ★ es la default actual
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Save size={13} strokeWidth={2.5} /> {pending ? "Guardando…" : "Guardar"}
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
