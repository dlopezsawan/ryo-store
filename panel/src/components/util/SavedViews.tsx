"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { Bookmark, Plus, X, Star, Edit2, Check } from "lucide-react"

export interface SavedView {
  id: string
  name: string
  query: string  // querystring sin "?"
  pinned?: boolean
  createdAt: number
}

interface Props {
  /** Clave de namespace en localStorage. ej: "panel_views_orders" */
  storageKey: string
  /** Quick filters predefinidos (no editables, siempre visibles primero) */
  presets?: SavedView[]
}

/**
 * Componente genérico de saved views para listings.
 * Lee la URL actual y permite guardarla con un nombre. Los views se guardan
 * en localStorage por clave (orders/products/customers/etc.).
 *
 * Renderiza una barra de chips horizontales:
 *   [Todos] [Preset 1] [Preset 2] | [⭐ Mi view 1] [Mi view 2] [+ Guardar]
 *
 * Click en chip → navega a esa querystring
 * Edit / delete via icon buttons en hover
 */
export function SavedViews({ storageKey, presets = [] }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentQuery = searchParams.toString()

  const [views, setViews] = useState<SavedView[]>([])
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  // Restore from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setViews(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [storageKey])

  function persist(next: SavedView[]) {
    setViews(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function activeId(): string | null {
    // Match exact querystring against presets and saved views
    const all = [...presets, ...views]
    const match = all.find((v) => normalizeQS(v.query) === normalizeQS(currentQuery))
    return match?.id ?? null
  }

  function go(view: SavedView) {
    const target = view.query ? `${pathname}?${view.query}` : pathname
    router.push(target)
  }

  function save() {
    if (!name.trim()) return
    const next: SavedView = {
      id: `v_${Date.now().toString(36)}`,
      name: name.trim(),
      query: currentQuery,
      createdAt: Date.now(),
    }
    persist([...views, next])
    setName("")
    setNaming(false)
  }

  function deleteView(id: string) {
    persist(views.filter((v) => v.id !== id))
  }

  function rename(id: string) {
    if (!editName.trim()) return
    persist(views.map((v) => v.id === id ? { ...v, name: editName.trim() } : v))
    setEditingId(null)
    setEditName("")
  }

  function togglePin(id: string) {
    persist(views.map((v) => v.id === id ? { ...v, pinned: !v.pinned } : v))
  }

  // Sort: pinned first, then by createdAt desc
  const sortedSaved = [...views].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.createdAt - a.createdAt
  })

  const active = activeId()

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Presets primero */}
      {presets.map((p) => {
        const isActive = active === p.id
        return (
          <button key={p.id} onClick={() => go(p)}
            className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap rounded-md ${
              isActive ? "bg-dark text-cream" : "text-ink-3 hover:bg-cream-2"
            }`}
            style={{ border: isActive ? "1.5px solid var(--ink)" : "1.5px solid var(--border)" }}>
            {p.name}
          </button>
        )
      })}

      {presets.length > 0 && views.length > 0 && (
        <span className="w-px h-5 bg-warm-200 mx-1" />
      )}

      {/* Saved views */}
      {sortedSaved.map((v) => {
        const isActive = active === v.id
        const isEditing = editingId === v.id
        if (isEditing) {
          return (
            <div key={v.id} className="flex items-center gap-1 px-2 py-1 bg-orange/5 rounded-md" style={{ border: "1.5px solid #FF3B27" }}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename(v.id)
                  if (e.key === "Escape") { setEditingId(null); setEditName("") }
                }}
                autoFocus
                className="w-32 bg-transparent text-[11px] font-mono focus:outline-none"
              />
              <button onClick={() => rename(v.id)} className="text-secondary p-0.5">
                <Check size={11} strokeWidth={2.5} />
              </button>
              <button onClick={() => { setEditingId(null); setEditName("") }} className="text-ink-3 p-0.5">
                <X size={11} strokeWidth={2.5} />
              </button>
            </div>
          )
        }
        return (
          <div key={v.id} className="flex items-center group rounded-md" style={{ border: isActive ? "1.5px solid var(--ink)" : "1.5px solid var(--border)" }}>
            <button
              onClick={() => go(v)}
              className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap ${
                isActive ? "bg-dark text-cream" : "text-ink-3 hover:text-orange"
              } flex items-center gap-1`}>
              {v.pinned && <Star size={9} fill="currentColor" strokeWidth={0} className="text-orange" />}
              {v.name}
            </button>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center px-1 gap-0.5 bg-page">
              <button onClick={() => togglePin(v.id)}
                className="text-ink-3 hover:text-orange p-0.5"
                title={v.pinned ? "Desfijar" : "Fijar"}>
                <Star size={10} strokeWidth={2.5} fill={v.pinned ? "currentColor" : "none"} />
              </button>
              <button onClick={() => { setEditingId(v.id); setEditName(v.name) }}
                className="text-ink-3 hover:text-orange p-0.5" title="Renombrar">
                <Edit2 size={10} strokeWidth={2.5} />
              </button>
              <button onClick={() => deleteView(v.id)}
                className="text-ink-3 hover:text-primary p-0.5" title="Eliminar">
                <X size={10} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )
      })}

      {/* Save current */}
      {!naming ? (
        currentQuery ? (
          <button onClick={() => setNaming(true)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-display font-bold uppercase tracking-wider text-orange hover:bg-orange/10 rounded-md"
            style={{ border: "1.5px dashed #FF3B27" }}>
            <Bookmark size={10} strokeWidth={2.5} /> Guardar vista
          </button>
        ) : null
      ) : (
        <div className="flex items-center gap-1 px-2 py-1 bg-orange/5 rounded-md" style={{ border: "1.5px solid #FF3B27" }}>
          <Plus size={11} className="text-orange" strokeWidth={2.5} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save()
              if (e.key === "Escape") { setNaming(false); setName("") }
            }}
            autoFocus
            placeholder="Nombre de la vista"
            className="w-32 bg-transparent text-[11px] font-mono focus:outline-none"
          />
          <button onClick={save} disabled={!name.trim()}
            className="px-2 py-0.5 bg-orange text-dark rounded-md text-[9px] font-display font-bold uppercase tracking-wider disabled:opacity-50">
            OK
          </button>
          <button onClick={() => { setNaming(false); setName("") }} className="text-ink-3 p-0.5">
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}

// Normalizar querystring para comparación: orden alfabético de keys
function normalizeQS(qs: string): string {
  if (!qs) return ""
  const sp = new URLSearchParams(qs)
  const arr = Array.from(sp.entries()).sort(([a], [b]) => a.localeCompare(b))
  return arr.map(([k, v]) => `${k}=${v}`).join("&")
}
