"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { setRegionProvidersAction } from "./actions"

interface RegionEntry {
  id: string
  name: string
  currency_code: string
  enabled_provider_ids: string[]
}

interface ProviderEntry {
  id: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function PaymentsManager({ regions, providers }: { regions: RegionEntry[]; providers: ProviderEntry[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(regions.map((r) => [r.id, new Set(r.enabled_provider_ids)])),
  )

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function toggle(regionId: string, providerId: string) {
    setDrafts((prev) => {
      const next = new Set(prev[regionId] ?? [])
      if (next.has(providerId)) next.delete(providerId)
      else next.add(providerId)
      return { ...prev, [regionId]: next }
    })
  }

  function save(region: RegionEntry) {
    const ids = Array.from(drafts[region.id] ?? [])
    startTransition(async () => {
      const r = await setRegionProvidersAction(region.id, ids)
      if (!r.ok) return flash("err", r.error)
      flash("ok", `${region.name}: ${ids.length} provider(s) asignados`)
      router.refresh()
    })
  }

  function isDirty(region: RegionEntry) {
    const draft = drafts[region.id] ?? new Set()
    if (draft.size !== region.enabled_provider_ids.length) return true
    for (const id of draft) if (!region.enabled_provider_ids.includes(id)) return true
    return false
  }

  if (providers.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
          No hay payment providers registrados
        </p>
        <p className="text-[12px] text-ink-3 mt-1">
          Configura al menos uno (manual, stripe, etc.) en <code className="font-mono">backend/medusa-config.ts</code>.
        </p>
      </div>
    )
  }

  if (regions.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
          No hay regiones para asignar
        </p>
        <p className="text-[12px] text-ink-3 mt-1">
          Crea al menos una en <a href="/settings/regions" className="text-orange hover:underline">/settings/regions</a> primero.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="stamp-card p-4 bg-orange/5">
        <p className="text-[12px] text-ink-2">
          <strong>{providers.length} provider(s)</strong> registrados. Asigna cuáles están disponibles para cada región.
          Los providers no asignados a una región no aparecerán como opción en el checkout.
        </p>
      </div>

      {regions.map((region) => {
        const dirty = isDirty(region)
        const draft = drafts[region.id] ?? new Set()
        return (
          <div key={region.id} className="stamp-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
                  {region.name}
                </h3>
                <p className="text-[10px] font-mono text-ink-3">
                  {region.currency_code.toUpperCase()} · {draft.size} de {providers.length} habilitados
                </p>
              </div>
              {dirty && (
                <button
                  type="button"
                  onClick={() => save(region)}
                  disabled={pending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
                  style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
                >
                  <Save size={11} strokeWidth={2.5} /> Guardar
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {providers.map((p) => {
                const checked = draft.has(p.id)
                return (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 bg-cream-2/40 rounded-md cursor-pointer hover:bg-cream-2/80 transition-colors" style={{ border: "1.5px solid var(--border)" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(region.id, p.id)}
                    />
                    <CreditCard size={12} className="text-ink-3 flex-shrink-0" />
                    <code className={`text-[11px] font-mono truncate ${checked ? "text-ink font-bold" : "text-ink-2"}`}>
                      {p.id}
                    </code>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

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
