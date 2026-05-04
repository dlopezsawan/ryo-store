"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Pencil, Check, X, Globe2, Percent, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  createTaxRegionAction, deleteTaxRegionAction,
  createTaxRateAction, updateTaxRateAction, deleteTaxRateAction,
} from "./actions"

interface RateRow {
  id: string
  name: string
  rate: number
  code: string
}

export interface RegionRow {
  id: string
  country_code: string
  province_code: string
  default_rate_pct: number | null
  default_rate_name: string
  rates: RateRow[]
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function TaxManager({ rows }: { rows: RegionRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creatingRegion, setCreatingRegion] = useState(false)
  const [confirmDelRegion, setConfirmDelRegion] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-ink-3 font-mono">
          {rows.length} región{rows.length === 1 ? "" : "es"} con taxes ·{" "}
          {rows.reduce((s, r) => s + r.rates.length, 0)} rates configurados
        </p>
        <button
          type="button"
          onClick={() => setCreatingRegion(!creatingRegion)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva tax region
        </button>
      </div>

      {creatingRegion && (
        <CreateRegionForm
          pending={pending}
          onCancel={() => setCreatingRegion(false)}
          onSubmit={(input) => {
            startTransition(async () => {
              const r = await createTaxRegionAction(input)
              if (!r.ok) return flash("err", r.error)
              flash("ok", "Tax region creada")
              setCreatingRegion(false)
              router.refresh()
            })
          }}
        />
      )}

      {rows.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin tax regions configuradas
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            Necesarias para que los pedidos calculen IVA o equivalente automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((region) => (
            <RegionCard
              key={region.id}
              region={region}
              pending={pending}
              confirmDel={confirmDelRegion === region.id}
              onConfirmDel={() => setConfirmDelRegion(region.id)}
              onCancelDel={() => setConfirmDelRegion(null)}
              onDeleted={() => { setConfirmDelRegion(null); flash("ok", "Tax region eliminada"); router.refresh() }}
              onChanged={() => { flash("ok", "Cambios guardados"); router.refresh() }}
              onError={(m) => flash("err", m)}
              startTransition={startTransition}
            />
          ))}
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

function CreateRegionForm({ pending, onCancel, onSubmit }: {
  pending: boolean
  onCancel: () => void
  onSubmit: (input: {
    country_code: string
    province_code?: string
    defaultRate?: { name: string; rate: number; code?: string }
  }) => void
}) {
  const [form, setForm] = useState({
    country_code: "ve",
    province_code: "",
    rate_name: "IVA",
    rate_pct: 16,
    rate_code: "iva",
  })
  return (
    <div className="stamp-card p-4 mb-4 bg-orange/5">
      <h4 className="font-display font-black text-[13px] uppercase tracking-wider mb-3">Nueva tax region</h4>
      <div className="grid grid-cols-5 gap-2">
        <Field label="País ISO-2 *">
          <input type="text" maxLength={2} value={form.country_code}
            onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value.toLowerCase().slice(0, 2) }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Provincia">
          <input type="text" value={form.province_code}
            onChange={(e) => setForm((f) => ({ ...f, province_code: e.target.value }))}
            placeholder="(opcional)"
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Default rate %">
          <input type="number" min={0} max={100} step="0.1" value={form.rate_pct}
            onChange={(e) => setForm((f) => ({ ...f, rate_pct: Number(e.target.value) || 0 }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Nombre">
          <input type="text" value={form.rate_name}
            onChange={(e) => setForm((f) => ({ ...f, rate_name: e.target.value }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Code">
          <input type="text" value={form.rate_code}
            onChange={(e) => setForm((f) => ({ ...f, rate_code: e.target.value.toLowerCase() }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button type="button" onClick={onCancel} disabled={pending}
          className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
          Cancelar
        </button>
        <button type="button"
          onClick={() => onSubmit({
            country_code: form.country_code,
            province_code: form.province_code || undefined,
            defaultRate: form.rate_name.trim() ? {
              name: form.rate_name,
              rate: form.rate_pct / 100,  // Medusa espera fracción 0-1
              code: form.rate_code || undefined,
            } : undefined,
          })}
          disabled={pending || !form.country_code.trim()}
          className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1.5px solid #1A1A1A" }}>
          {pending ? "Creando…" : "Crear región"}
        </button>
      </div>
    </div>
  )
}

function RegionCard({
  region, pending, confirmDel,
  onConfirmDel, onCancelDel, onDeleted, onChanged, onError, startTransition,
}: {
  region: RegionRow
  pending: boolean
  confirmDel: boolean
  onConfirmDel: () => void
  onCancelDel: () => void
  onDeleted: () => void
  onChanged: () => void
  onError: (m: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [creatingRate, setCreatingRate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  function delRegion() {
    startTransition(async () => {
      const r = await deleteTaxRegionAction(region.id)
      if (!r.ok) return onError(r.error)
      onDeleted()
    })
  }

  return (
    <div className="stamp-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-9 h-9 bg-secondary text-cream flex items-center justify-center flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
            <Globe2 size={14} strokeWidth={2.4} />
          </div>
          <div>
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              {region.country_code.toUpperCase()}
              {region.province_code && <span className="text-ink-3 ml-1.5">/ {region.province_code}</span>}
            </h3>
            <p className="text-[10px] font-mono text-ink-3">
              {region.default_rate_pct != null
                ? <>default: {region.default_rate_name} · {(region.default_rate_pct * 100).toFixed(1)}%</>
                : "sin default rate"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCreatingRate(!creatingRate)}
            className="px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider flex items-center gap-1"
            style={{ border: "1.5px solid #1A1A1A" }}
          >
            <Plus size={10} strokeWidth={3} /> Rate
          </button>
          {confirmDel ? (
            <>
              <button onClick={delRegion} disabled={pending} className="px-2 py-1 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
                Eliminar
              </button>
              <button onClick={onCancelDel} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
                <X size={12} />
              </button>
            </>
          ) : (
            <button onClick={onConfirmDel} className="text-ink-3 hover:text-primary p-1.5" title="Eliminar región">
              <Trash2 size={12} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>

      {creatingRate && (
        <CreateRateRow
          regionId={region.id}
          pending={pending}
          onCancel={() => setCreatingRate(false)}
          onCreated={() => { setCreatingRate(false); onChanged() }}
          onError={onError}
          startTransition={startTransition}
        />
      )}

      {region.rates.length === 0 ? (
        <p className="text-[11px] text-ink-3 italic">Sin tax rates extra (sólo el default).</p>
      ) : (
        <div className="space-y-1">
          {region.rates.map((r) => (
            <RateRowItem
              key={r.id}
              row={r}
              editing={editingId === r.id}
              pending={pending}
              onEdit={() => setEditingId(r.id)}
              onCancel={() => setEditingId(null)}
              onSaved={() => { setEditingId(null); onChanged() }}
              onError={onError}
              startTransition={startTransition}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CreateRateRow({ regionId, pending, onCancel, onCreated, onError, startTransition }: {
  regionId: string
  pending: boolean
  onCancel: () => void
  onCreated: () => void
  onError: (m: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [form, setForm] = useState({ name: "", rate_pct: 0, code: "" })
  function go() {
    startTransition(async () => {
      const r = await createTaxRateAction({
        tax_region_id: regionId,
        name: form.name,
        rate: form.rate_pct / 100,
        code: form.code || undefined,
      })
      if (!r.ok) return onError(r.error)
      onCreated()
    })
  }
  return (
    <div className="flex items-center gap-2 p-2 mb-2 bg-orange/5 rounded-md" style={{ border: "1.5px dashed #FF3B27" }}>
      <input type="text" placeholder="Nombre (ej. IVA Reducido)" value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="flex-1 px-2 py-1 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
      <input type="number" min={0} max={100} step="0.1" placeholder="%" value={form.rate_pct || ""}
        onChange={(e) => setForm((f) => ({ ...f, rate_pct: Number(e.target.value) || 0 }))}
        className="w-20 px-2 py-1 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
      <input type="text" placeholder="code" value={form.code}
        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
        className="w-24 px-2 py-1 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
      <button onClick={go} disabled={pending || !form.name.trim() || !(form.rate_pct >= 0)}
        className="px-2 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1.5px solid #1A1A1A" }}>
        <Check size={11} className="inline" />
      </button>
      <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1 disabled:opacity-50">
        <X size={12} />
      </button>
    </div>
  )
}

function RateRowItem({
  row, editing, pending, onEdit, onCancel, onSaved, onError, startTransition,
}: {
  row: RateRow
  editing: boolean
  pending: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: () => void
  onError: (m: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [form, setForm] = useState({ name: row.name, rate_pct: row.rate * 100, code: row.code })
  const [confirmDel, setConfirmDel] = useState(false)

  function save() {
    startTransition(async () => {
      const r = await updateTaxRateAction(row.id, {
        name: form.name,
        rate: form.rate_pct / 100,
        code: form.code,
      })
      if (!r.ok) return onError(r.error)
      onSaved()
    })
  }

  function del() {
    startTransition(async () => {
      const r = await deleteTaxRateAction(row.id)
      if (!r.ok) return onError(r.error)
      onSaved()
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-orange/5 rounded-md">
        <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="flex-1 px-2 py-1 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="number" min={0} step="0.1" value={form.rate_pct} onChange={(e) => setForm((f) => ({ ...f, rate_pct: Number(e.target.value) || 0 }))}
          className="w-20 px-2 py-1 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
          className="w-24 px-2 py-1 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <button onClick={save} disabled={pending} className="text-secondary p-1 disabled:opacity-50"><Check size={13} strokeWidth={3} /></button>
        <button onClick={onCancel} disabled={pending} className="text-ink-3 p-1 disabled:opacity-50"><X size={13} strokeWidth={3} /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-cream-2/40 rounded-md" style={{ border: "1px solid var(--border)" }}>
      <Percent size={11} strokeWidth={2.4} className="text-ink-3" />
      <span className="font-display font-bold text-[12px] flex-1">{row.name}</span>
      {row.code && <code className="text-[10px] font-mono text-ink-3">{row.code}</code>}
      <span className="font-display font-black text-[13px] num text-orange">{(row.rate * 100).toFixed(1)}%</span>
      {confirmDel ? (
        <>
          <button onClick={del} disabled={pending} className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
            ✓
          </button>
          <button onClick={() => setConfirmDel(false)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50"><X size={11} /></button>
        </>
      ) : (
        <>
          <button onClick={onEdit} className="text-ink-3 hover:text-orange p-1"><Pencil size={10} strokeWidth={2.4} /></button>
          <button onClick={() => setConfirmDel(true)} className="text-ink-3 hover:text-primary p-1"><Trash2 size={10} strokeWidth={2.4} /></button>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-2 mb-1">{label}</label>
      {children}
    </div>
  )
}
