"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Network, Tag, Save, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  updateProductSalesChannelsAction,
  updateProductCategoriesAction,
} from "./actions"

interface Option { id: string; name: string }

interface Props {
  productId: string
  /** Catálogo completo */
  allChannels: Option[]
  allCategories: Option[]
  allCollections: Option[]
  /** Asignaciones actuales */
  currentChannelIds: string[]
  currentCategoryIds: string[]
  currentCollectionId: string | null
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function AssignmentsPanel({
  productId,
  allChannels, allCategories, allCollections,
  currentChannelIds, currentCategoryIds, currentCollectionId,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [channels, setChannels] = useState<Set<string>>(new Set(currentChannelIds))
  const [categories, setCategories] = useState<Set<string>>(new Set(currentCategoryIds))
  const [collection, setCollection] = useState<string | null>(currentCollectionId)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function toggle(setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setFn((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function saveChannels() {
    startTransition(async () => {
      const r = await updateProductSalesChannelsAction(productId, Array.from(channels))
      if (!r.ok) return flash("err", r.error)
      flash("ok", "Sales channels actualizados")
      router.refresh()
    })
  }

  function saveCategories() {
    startTransition(async () => {
      const r = await updateProductCategoriesAction(productId, Array.from(categories), collection)
      if (!r.ok) return flash("err", r.error)
      flash("ok", "Categorías y colección actualizadas")
      router.refresh()
    })
  }

  const channelsDirty =
    channels.size !== currentChannelIds.length ||
    Array.from(channels).some((id) => !currentChannelIds.includes(id))

  const categoriesDirty =
    categories.size !== currentCategoryIds.length ||
    Array.from(categories).some((id) => !currentCategoryIds.includes(id)) ||
    collection !== currentCollectionId

  return (
    <>
      {/* Sales channels */}
      <div className="stamp-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-secondary text-cream flex items-center justify-center" style={{ border: "1.5px solid var(--border)" }}>
            <Network size={14} strokeWidth={2.4} />
          </div>
          <h3 className="font-display font-black text-[13px] uppercase tracking-wider">
            Sales Channels
          </h3>
        </div>
        {allChannels.length === 0 ? (
          <p className="text-[11px] text-ink-3 italic">No hay sales channels configurados.</p>
        ) : (
          <div className="space-y-1.5">
            {allChannels.map((c) => {
              const checked = channels.has(c.id)
              return (
                <label key={c.id} className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-cream-2/40 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(setChannels, c.id)}
                  />
                  <span className={checked ? "text-ink font-display font-bold" : "text-ink-2"}>
                    {c.name}
                  </span>
                </label>
              )
            })}
          </div>
        )}
        {channelsDirty && (
          <button
            type="button"
            onClick={saveChannels}
            disabled={pending}
            className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
          >
            <Save size={11} strokeWidth={2.5} /> {pending ? "..." : "Guardar channels"}
          </button>
        )}
      </div>

      {/* Categories + Collection */}
      <div className="stamp-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-orange text-dark flex items-center justify-center" style={{ border: "1.5px solid var(--border)" }}>
            <Tag size={14} strokeWidth={2.4} />
          </div>
          <h3 className="font-display font-black text-[13px] uppercase tracking-wider">
            Categorías + colección
          </h3>
        </div>

        <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1">
          Colección (1 max)
        </label>
        <select
          value={collection ?? ""}
          onChange={(e) => setCollection(e.target.value || null)}
          className="w-full px-3 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none mb-3"
          style={{ border: "1.5px solid var(--border)" }}
        >
          <option value="">— Sin colección —</option>
          {allCollections.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1">
          Categorías ({categories.size} seleccionadas)
        </label>
        {allCategories.length === 0 ? (
          <p className="text-[11px] text-ink-3 italic">
            No hay categorías. Crea desde <a href="/catalog" className="text-orange hover:underline">/catalog</a>.
          </p>
        ) : (
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {allCategories.map((c) => {
              const checked = categories.has(c.id)
              return (
                <label key={c.id} className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-cream-2/40 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(setCategories, c.id)}
                  />
                  <span className={checked ? "text-ink font-display font-bold" : "text-ink-2"}>
                    {c.name}
                  </span>
                </label>
              )
            })}
          </div>
        )}

        {categoriesDirty && (
          <button
            type="button"
            onClick={saveCategories}
            disabled={pending}
            className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
          >
            <Save size={11} strokeWidth={2.5} /> {pending ? "..." : "Guardar taxonomía"}
          </button>
        )}
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
    </>
  )
}
