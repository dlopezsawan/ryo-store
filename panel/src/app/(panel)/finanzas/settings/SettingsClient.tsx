"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Settings, Plus, X, Save, AlertCircle, CheckCircle2, RotateCcw, Wallet, Edit2 } from "lucide-react"
import { createWalletAction, updateWalletAction, deleteWalletAction } from "../actions"
import type { FinanzasWallet } from "@/lib/medusa"

type Toast = { kind: "ok" | "err"; msg: string } | null

const STORAGE_PREFS = "panel_finanzas_prefs"
const STORAGE_CATEGORIES = "panel_finanzas_categories"

interface Prefs {
  defaultCurrency: "eur" | "usdt"
  warnRunwayDays: number     // umbral para alerta runway warning
  criticalRunwayDays: number // umbral para alerta runway critical
  warnConversionDays: number // alerta de Bs sin convertir > N días
  warnExpenseSpikePercent: number  // % sobre histórico para flag spike
  showBcvEur: boolean
}

const DEFAULT_PREFS: Prefs = {
  defaultCurrency: "eur",
  warnRunwayDays: 90,
  criticalRunwayDays: 30,
  warnConversionDays: 30,
  warnExpenseSpikePercent: 50,
  showBcvEur: true,
}

const DEFAULT_CATEGORIES = [
  "Operativo",
  "Marketing / Ads",
  "Inventario / COGS",
  "Servicios SaaS",
  "Logística / Envíos",
  "Sueldos / RRHH",
  "Impuestos",
  "Otros",
]

/** Draft local que mapea a `FinanzasWallet` del backend.  */
interface WalletDraft {
  id?: string  // si existe → update, sino → create
  name?: string
  currency?: string
  description?: string
  sort_order?: number
  is_active?: boolean
}

export function SettingsClient({ initialWallets, walletsError }: {
  initialWallets: FinanzasWallet[]
  walletsError: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null)
  const [walletDraft, setWalletDraft] = useState<WalletDraft>({})
  const [newCat, setNewCat] = useState("")
  const [toast, setToast] = useState<Toast>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const wallets = initialWallets  // viene del server, no se mutate localmente

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    try {
      const rawP = localStorage.getItem(STORAGE_PREFS)
      if (rawP) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(rawP) })
      const rawC = localStorage.getItem(STORAGE_CATEGORIES)
      if (rawC) setCategories(JSON.parse(rawC))
    } catch { /* ignore */ }
  }, [])

  function startEditWallet(w: FinanzasWallet | null) {
    if (w) {
      setEditingWalletId(w.id)
      setWalletDraft({
        id: w.id,
        name: w.name,
        currency: w.currency,
        description: w.description ?? "",
        sort_order: w.sort_order,
        is_active: w.is_active,
      })
    } else {
      setEditingWalletId("__new__")
      setWalletDraft({ name: "", currency: "usdt", description: "", sort_order: 99, is_active: true })
    }
  }

  function saveWalletDraft() {
    if (!walletDraft.name?.trim()) {
      flash("err", "Nombre requerido")
      return
    }
    if (!walletDraft.currency?.trim()) {
      flash("err", "Moneda requerida")
      return
    }
    startTransition(async () => {
      const isNew = editingWalletId === "__new__"
      const res = isNew
        ? await createWalletAction({
            name: walletDraft.name!,
            currency: walletDraft.currency!,
            description: walletDraft.description,
            sort_order: walletDraft.sort_order,
            is_active: walletDraft.is_active,
          })
        : await updateWalletAction(walletDraft.id!, {
            name: walletDraft.name,
            currency: walletDraft.currency,
            description: walletDraft.description ?? null,
            sort_order: walletDraft.sort_order,
            is_active: walletDraft.is_active,
          })
      if (!res.ok) return flash("err", res.error)
      flash("ok", isNew ? "Wallet creado en backend" : "Wallet actualizado")
      setEditingWalletId(null)
      setWalletDraft({})
      router.refresh()
    })
  }

  function deleteWallet(id: string, name: string) {
    if (!window.confirm(`¿Eliminar wallet "${name}" del backend? Esta acción es permanente.`)) return
    startTransition(async () => {
      const res = await deleteWalletAction(id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Wallet eliminado")
      router.refresh()
    })
  }

  function persistPrefs(next: Prefs) {
    setPrefs(next)
    try {
      localStorage.setItem(STORAGE_PREFS, JSON.stringify(next))
      setSavedAt(new Date())
    } catch { /* ignore */ }
  }

  function persistCategories(next: string[]) {
    setCategories(next)
    try {
      localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(next))
      setSavedAt(new Date())
    } catch { /* ignore */ }
  }

  function addCategory() {
    const t = newCat.trim()
    if (!t) return
    if (categories.includes(t)) return flash("err", "Ya existe esa categoría")
    persistCategories([...categories, t])
    setNewCat("")
    flash("ok", "Categoría añadida")
  }

  function removeCategory(name: string) {
    persistCategories(categories.filter((c) => c !== name))
  }

  function resetCategories() {
    persistCategories(DEFAULT_CATEGORIES)
    flash("ok", "Categorías restauradas")
  }

  function resetPrefs() {
    persistPrefs(DEFAULT_PREFS)
    flash("ok", "Preferencias restauradas")
  }

  return (
    <>
      {/* Status indicator */}
      {savedAt && (
        <div className="text-[10px] font-mono text-secondary text-right">
          <CheckCircle2 size={10} className="inline mr-1" /> Guardado a las {savedAt.toLocaleTimeString("es-VE")}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Preferencias generales */}
        <div className="col-span-7 stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <div className="flex items-center gap-2">
              <Settings size={14} strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Preferencias UI</h3>
            </div>
            <button onClick={resetPrefs}
              className="text-[10px] font-display font-bold uppercase tracking-wider text-cream/60 hover:text-orange flex items-center gap-1">
              <RotateCcw size={10} strokeWidth={2.5} /> Reset
            </button>
          </div>
          <div className="p-5 space-y-4">
            <Field label="Moneda por defecto"
              hint="Determina qué valor mostrar primero en KPIs (EUR es la moneda interna del sistema)">
              <div className="flex items-center bg-cream rounded-md overflow-hidden" style={{ border: "1.5px solid var(--border)", width: "fit-content" }}>
                {(["eur", "usdt"] as const).map((c) => (
                  <button key={c} onClick={() => persistPrefs({ ...prefs, defaultCurrency: c })}
                    className={`px-4 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider ${
                      prefs.defaultCurrency === c ? "bg-dark text-cream" : "text-ink-3 hover:bg-cream-2"
                    }`}>
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Mostrar BCV en EUR (además de USD)"
              hint="Sidebar ticker mostrará ambas tasas si activado">
              <Toggle on={prefs.showBcvEur} onChange={(v) => persistPrefs({ ...prefs, showBcvEur: v })} />
            </Field>

            <div className="dotted-div" />

            <h4 className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-orange">Umbrales de alertas</h4>

            <Field label="Runway · días warning"
              hint="Si el runway baja de este valor, se muestra alerta amarilla">
              <NumInput value={prefs.warnRunwayDays}
                onChange={(v) => persistPrefs({ ...prefs, warnRunwayDays: v })}
                suffix="días" />
            </Field>

            <Field label="Runway · días critical"
              hint="Si el runway baja de este valor, alerta roja crítica">
              <NumInput value={prefs.criticalRunwayDays}
                onChange={(v) => persistPrefs({ ...prefs, criticalRunwayDays: v })}
                suffix="días" />
            </Field>

            <Field label="Bs sin convertir · días"
              hint="Pago Móvil más viejo que esto se marca pendiente urgente">
              <NumInput value={prefs.warnConversionDays}
                onChange={(v) => persistPrefs({ ...prefs, warnConversionDays: v })}
                suffix="días" />
            </Field>

            <Field label="Spike de gastos · %"
              hint="Si el mes en curso supera este % sobre promedio histórico, alerta">
              <NumInput value={prefs.warnExpenseSpikePercent}
                onChange={(v) => persistPrefs({ ...prefs, warnExpenseSpikePercent: v })}
                suffix="%" />
            </Field>
          </div>
        </div>

        {/* Categorías de gastos */}
        <div className="col-span-5 stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Categorías de gastos</h3>
            <button onClick={resetCategories}
              className="text-[10px] font-display font-bold uppercase tracking-wider text-cream/60 hover:text-orange flex items-center gap-1">
              <RotateCcw size={10} strokeWidth={2.5} /> Reset
            </button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-[11px] text-ink-3">
              Lista que aparece en el modal "Nuevo gasto" en /finanzas. Editable acá, persistida en este navegador.
            </p>

            <ul className="space-y-1">
              {categories.map((c) => (
                <li key={c} className="flex items-center justify-between gap-2 px-3 py-2 bg-cream-2/40 rounded-md group" style={{ border: "1.5px solid var(--border-soft)" }}>
                  <span className="text-[12px] font-display font-bold text-ink">{c}</span>
                  <button onClick={() => removeCategory(c)}
                    className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-primary p-0.5">
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory() }}
                placeholder="Nueva categoría"
                className="flex-1 px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}
              />
              <button onClick={addCategory} disabled={!newCat.trim()}
                className="flex items-center gap-1 px-2 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                style={{ border: "1.5px solid #1A1A1A" }}>
                <Plus size={11} strokeWidth={2.5} /> Añadir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallets / Tesorería — REAL backend */}
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
          <div className="flex items-center gap-2">
            <Wallet size={14} strokeWidth={2.5} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Wallets de tesorería</h3>
            <span className="text-[10px] font-mono text-cream/60">· {wallets.length} en backend</span>
          </div>
          <button onClick={() => startEditWallet(null)} disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }}>
            <Plus size={11} strokeWidth={2.5} /> Añadir wallet
          </button>
        </div>
        <div className="p-5 space-y-3">
          {walletsError ? (
            <div className="p-3 bg-primary/5 rounded-md text-[12px] text-primary" style={{ border: "1.5px solid #BB3B2E" }}>
              <AlertCircle size={12} className="inline mr-1" /> {walletsError}
            </div>
          ) : (
            <p className="text-[11px] text-ink-3">
              Wallets en el módulo finanzas del backend. Cada movimiento (revenue, expense, conversion) afecta el ledger
              <code className="mx-1">finanzas_wallet_entry</code>; el saldo se calcula como <code>SUM(amount)</code> por wallet.
            </p>
          )}

          {wallets.length === 0 && !walletsError && (
            <div className="p-4 text-center text-[12px] text-ink-3 bg-cream-2/40 rounded-md" style={{ border: "1.5px dashed var(--border)" }}>
              Sin wallets configurados. Crea el primero — ej: "Daniel · USDT" (currency: usdt)
            </div>
          )}

          <ul className="space-y-2">
            {wallets.map((w) => (
              <li key={w.id} className="p-3 bg-cream-2/40 rounded-md group" style={{ border: "1.5px solid var(--border-soft)" }}>
                {editingWalletId === w.id ? (
                  <WalletEditForm
                    draft={walletDraft}
                    onChange={setWalletDraft}
                    onSave={saveWalletDraft}
                    onCancel={() => { setEditingWalletId(null); setWalletDraft({}) }}
                    pending={pending}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 flex items-center justify-center font-display font-black text-[10px] flex-shrink-0 ${
                      w.currency === "usdt" ? "bg-secondary/15 text-secondary" :
                      w.currency === "bs"   ? "bg-orange/15 text-orange" :
                      w.currency === "eur"  ? "bg-cream-2 text-ink" :
                      w.currency === "usd"  ? "bg-cream-2 text-ink-2" :
                      "bg-cream-2 text-ink-3"
                    }`} style={{ border: "1.5px solid var(--border)" }}>
                      {w.currency.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-display font-bold text-[13px] text-ink truncate">{w.name}</span>
                        {!w.is_active && (
                          <span className="text-[8px] font-display font-bold uppercase tracking-wider text-primary px-1 py-0.5 bg-primary/10 rounded-md">
                            INACTIVO
                          </span>
                        )}
                      </div>
                      {w.description && (
                        <div className="text-[10px] font-mono text-ink-3 truncate">{w.description}</div>
                      )}
                      <div className="text-[9px] font-mono text-ink-3/60 truncate">id {w.id} · sort {w.sort_order}</div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button onClick={() => startEditWallet(w)} disabled={pending}
                        className="text-ink-3 hover:text-orange p-1 disabled:opacity-50" title="Editar">
                        <Edit2 size={11} strokeWidth={2.5} />
                      </button>
                      <button onClick={() => deleteWallet(w.id, w.name)} disabled={pending}
                        className="text-ink-3 hover:text-primary p-1 disabled:opacity-50" title="Eliminar">
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {editingWalletId === "__new__" && (
              <li className="p-3 bg-orange/5 rounded-md" style={{ border: "1.5px dashed #FF3B27" }}>
                <WalletEditForm
                  draft={walletDraft}
                  onChange={setWalletDraft}
                  onSave={saveWalletDraft}
                  onCancel={() => { setEditingWalletId(null); setWalletDraft({}) }}
                  pending={pending}
                />
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Backend-managed (read-only) */}
      <div className="stamp-card p-4 bg-cream-2/30">
        <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-ink-3 mb-3">
          ⚙ Configuración del backend (read-only)
        </h3>
        <p className="text-[11px] text-ink-2 mb-3">
          Las siguientes configuraciones viven en el plugin <code>enrola-core</code> de Medusa y no son editables desde este panel.
          Para modificar, edítalas en <code className="text-orange">backend/src/modules/finanzas/</code> y redespliega.
        </p>
        <ul className="space-y-1.5 text-[11px] font-mono">
          <li>· <span className="text-ink-3">Wallet USDT operaciones:</span> configurada en backend env (<code>FINANZAS_USDT_WALLET</code>)</li>
          <li>· <span className="text-ink-3">Burn target mensual:</span> hardcoded en <code>finanzas/runway.service.ts</code></li>
          <li>· <span className="text-ink-3">Spread Bs/USDT:</span> calculado dinámico de cada conversion</li>
          <li>· <span className="text-ink-3">COGS por SKU:</span> en <code>variant.metadata.cogs_eur</code> de Medusa products</li>
          <li>· <span className="text-ink-3">Margen target:</span> hardcoded por bucket en <code>pricing.service.ts</code></li>
        </ul>
      </div>

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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1">
        {label}
      </label>
      {hint && <p className="text-[10px] text-ink-3 mb-1.5 font-mono">{hint}</p>}
      {children}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={`relative w-10 h-5 rounded-full transition-colors ${on ? "bg-orange" : "bg-cream-2"}`}
      style={{ border: "1.5px solid var(--border)" }}>
      <span className={`absolute top-0.5 w-3 h-3 bg-page rounded-full transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
        style={{ border: "1px solid var(--border)" }} />
    </button>
  )
}

function WalletEditForm({ draft, onChange, onSave, onCancel, pending }: {
  draft: WalletDraft
  onChange: (d: WalletDraft) => void
  onSave: () => void
  onCancel: () => void
  pending: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-3 mb-0.5">Nombre *</label>
          <input
            type="text"
            value={draft.name ?? ""}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Ej: Daniel · USDT"
            autoFocus
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>
        <div>
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-3 mb-0.5">Moneda *</label>
          <select
            value={draft.currency ?? "usdt"}
            onChange={(e) => onChange({ ...draft, currency: e.target.value })}
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}>
            <option value="usdt">USDT</option>
            <option value="bs">Bolívares (Bs)</option>
            <option value="usd">USD</option>
            <option value="eur">EUR</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-3 mb-0.5">Descripción (opcional)</label>
        <input
          type="text"
          value={draft.description ?? ""}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          placeholder="Wallet del owner · personal"
          className="w-full px-2 py-1.5 bg-cream rounded-md text-[11px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-3 mb-0.5">Sort order</label>
          <input
            type="number"
            value={draft.sort_order ?? 0}
            onChange={(e) => onChange({ ...draft, sort_order: Number(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>
        <div>
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-3 mb-0.5">Estado</label>
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer h-[34px]">
            <input
              type="checkbox"
              checked={draft.is_active ?? true}
              onChange={(e) => onChange({ ...draft, is_active: e.target.checked })}
            />
            <span className="font-display font-bold uppercase tracking-wider text-secondary">{draft.is_active === false ? "Inactivo" : "Activo"}</span>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end pt-1">
        <button onClick={onCancel} disabled={pending}
          className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}>
          Cancelar
        </button>
        <button onClick={onSave} disabled={pending || !draft.name?.trim() || !draft.currency?.trim()}
          className="px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
          style={{ border: "1.5px solid #1A1A1A" }}>
          <Save size={10} strokeWidth={2.5} className="inline mr-1" /> {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  )
}

function NumInput({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-24 px-2 py-1 bg-cream rounded-md text-[13px] font-mono num text-right focus:outline-none"
        style={{ border: "1.5px solid var(--border)" }}
      />
      {suffix && <span className="text-[10px] font-mono text-ink-3">{suffix}</span>}
    </div>
  )
}
