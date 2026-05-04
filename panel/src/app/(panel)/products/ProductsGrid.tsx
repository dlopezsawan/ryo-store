"use client"

import { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, AlertCircle, X, Eye, Archive, Trash2, Copy, DollarSign } from "lucide-react"
import { fmtEur } from "@/lib/utils"
import {
  bulkSetProductStatusAction, bulkDeleteProductsAction,
  bulkAdjustPricesAction, bulkDuplicateProductsAction,
  type BulkProductResult,
} from "./actions"

export interface ProductRow {
  id: string
  title: string
  handle: string | null
  status: "draft" | "published" | "proposed" | "rejected"
  thumbnail: string | null
  firstSku: string | null
  firstPrice: number | null
  totalStock: number
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function ProductsGrid({ rows }: { rows: ProductRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeIdx, setActiveIdx] = useState(-1)
  const [pending, startTransition] = useTransition()
  const [confirmDel, setConfirmDel] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [showPriceAdjust, setShowPriceAdjust] = useState(false)
  const [priceMode, setPriceMode] = useState<"percent" | "fixed">("percent")
  const [priceAmount, setPriceAmount] = useState<number>(0)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 5000)
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Atajos j/k/enter/x
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIdx((i) => Math.min(rows.length - 1, i < 0 ? 0 : i + 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIdx((i) => Math.max(0, i - 1))
      } else if (e.key === "Enter" && activeIdx >= 0 && activeIdx < rows.length) {
        e.preventDefault()
        router.push(`/products/${rows[activeIdx].id}`)
      } else if ((e.key === "x" || e.key === " ") && activeIdx >= 0 && activeIdx < rows.length) {
        e.preventDefault()
        toggleOne(rows[activeIdx].id)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [rows, activeIdx, router])

  function bulkPublish() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res: BulkProductResult = await bulkSetProductStatusAction(ids, "published")
      flash(res.failed.length === 0 ? "ok" : "err", `${res.ok} publicado(s)${res.failed.length > 0 ? ` · ${res.failed.length} fallaron` : ""}`)
      setSelected(new Set())
      router.refresh()
    })
  }

  function bulkDraft() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res: BulkProductResult = await bulkSetProductStatusAction(ids, "draft")
      flash(res.failed.length === 0 ? "ok" : "err", `${res.ok} en borrador${res.failed.length > 0 ? ` · ${res.failed.length} fallaron` : ""}`)
      setSelected(new Set())
      router.refresh()
    })
  }

  function bulkDelete() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res: BulkProductResult = await bulkDeleteProductsAction(ids)
      flash(res.failed.length === 0 ? "ok" : "err", `${res.ok} eliminado(s)${res.failed.length > 0 ? ` · ${res.failed.length} fallaron` : ""}`)
      setSelected(new Set())
      setConfirmDel(false)
      router.refresh()
    })
  }

  function bulkDuplicate() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res: BulkProductResult = await bulkDuplicateProductsAction(ids)
      flash(res.failed.length === 0 ? "ok" : "err", `${res.ok} duplicado(s)${res.failed.length > 0 ? ` · ${res.failed.length} fallaron` : ""}`)
      setSelected(new Set())
      router.refresh()
    })
  }

  function bulkAdjustPrices() {
    const ids = Array.from(selected)
    if (priceAmount === 0) return flash("err", "Monto no puede ser 0")
    startTransition(async () => {
      const res: BulkProductResult = await bulkAdjustPricesAction(ids, priceMode, priceAmount)
      flash(res.failed.length === 0 ? "ok" : "err",
        `${res.ok} producto(s) con precios ajustados${res.failed.length > 0 ? ` · ${res.failed.length} fallaron` : ""}`)
      setSelected(new Set())
      setShowPriceAdjust(false)
      setPriceAmount(0)
      router.refresh()
    })
  }

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.id)))
  }
  const allSelected = rows.length > 0 && selected.size === rows.length

  if (rows.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
          Sin productos en este filtro
        </p>
        <p className="text-[12px] text-ink-3 mt-1">Prueba ampliar el rango o crear el primer producto.</p>
      </div>
    )
  }

  return (
    <>
      {/* Master select-all toolbar (siempre visible si hay rows) */}
      <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-display font-bold uppercase tracking-wider text-ink-3">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-orange">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Seleccionar todo ({rows.length})
        </label>
        {selected.size > 0 && selected.size < rows.length && (
          <button onClick={toggleAll} className="text-orange hover:underline">
            · seleccionar los {rows.length - selected.size} restantes
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div
          className="stamp-card p-3 flex items-center gap-2 sticky top-2 z-20 bg-page mb-4 flex-wrap"
          style={{ borderColor: "#FF3B27" }}
        >
          <span className="text-[12px] font-display font-bold uppercase tracking-wider text-orange">
            {selected.size} producto{selected.size === 1 ? "" : "s"} sel.
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}
          >
            Deseleccionar
          </button>
          <button
            type="button"
            onClick={bulkPublish}
            disabled={pending}
            className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }}
          >
            <Eye size={11} strokeWidth={2.5} /> Publicar
          </button>
          <button
            type="button"
            onClick={bulkDraft}
            disabled={pending}
            className="flex items-center gap-1 px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}
          >
            <Archive size={11} strokeWidth={2.5} /> Borrador
          </button>
          <button
            type="button"
            onClick={bulkDuplicate}
            disabled={pending}
            className="flex items-center gap-1 px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}
          >
            <Copy size={11} strokeWidth={2.5} /> Duplicar
          </button>
          <button
            type="button"
            onClick={() => setShowPriceAdjust(!showPriceAdjust)}
            disabled={pending}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 ${
              showPriceAdjust ? "bg-orange text-dark" : "bg-cream text-ink hover:bg-cream-2"
            }`}
            style={{ border: "1.5px solid var(--border)" }}
          >
            <DollarSign size={11} strokeWidth={2.5} /> Precios
          </button>
          {confirmDel ? (
            <>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={pending}
                className="px-3 py-1.5 bg-primary text-white rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                style={{ border: "1.5px solid #1A1A1A" }}
              >
                Confirmar eliminar
              </button>
              <button onClick={() => setConfirmDel(false)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              disabled={pending}
              className="flex items-center gap-1 px-3 py-1.5 bg-cream text-primary rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-primary/5 disabled:opacity-50"
              style={{ border: "1.5px solid #BB3B2E" }}
            >
              <Trash2 size={11} strokeWidth={2.5} /> Eliminar
            </button>
          )}
        </div>
      )}

      {/* Inline price-adjust panel */}
      {selected.size > 0 && showPriceAdjust && (
        <div className="stamp-card p-3 mb-4 bg-orange/5" style={{ borderColor: "#FF3B27" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-orange">
              Ajustar precios de {selected.size} producto{selected.size === 1 ? "" : "s"}:
            </span>
            <div className="flex items-center bg-cream rounded-md overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
              <button onClick={() => setPriceMode("percent")}
                className={`px-2 py-1 text-[10px] font-display font-bold uppercase ${priceMode === "percent" ? "bg-dark text-cream" : "text-ink-3"}`}>
                %
              </button>
              <button onClick={() => setPriceMode("fixed")}
                className={`px-2 py-1 text-[10px] font-display font-bold uppercase ${priceMode === "fixed" ? "bg-dark text-cream" : "text-ink-3"}`}>
                EUR fijo
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              value={priceAmount || ""}
              onChange={(e) => setPriceAmount(Number(e.target.value) || 0)}
              placeholder={priceMode === "percent" ? "+10  o  -15" : "+1.50  o  -0.50"}
              className="w-32 px-2 py-1 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <span className="text-[10px] font-mono text-ink-3">
              {priceAmount !== 0 && (priceMode === "percent"
                ? `Ej: €10 → €${(10 * (1 + priceAmount / 100)).toFixed(2)}`
                : `Ej: €10 → €${(10 + priceAmount).toFixed(2)}`)}
            </span>
            <span className="flex-1" />
            <button onClick={bulkAdjustPrices} disabled={pending || priceAmount === 0}
              className="px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}>
              {pending ? "Aplicando…" : "Aplicar"}
            </button>
            <button onClick={() => { setShowPriceAdjust(false); setPriceAmount(0) }}
              className="text-ink-3 px-1">
              <X size={14} />
            </button>
          </div>
          <p className="text-[10px] text-ink-3 font-mono mt-2 italic">
            ⚠ Aplica a TODAS las variants y monedas. Ej: 10% a €10/$12 → €11/$13.20. Operación lenta para selecciones grandes.
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5">
        {rows.map((p, idx) => {
          const isSelected = selected.has(p.id)
          const isActive = idx === activeIdx
          const stockTone = p.totalStock === 0 ? "muted" : p.totalStock < 10 ? "primary" : p.totalStock < 30 ? "orange" : "secondary"
          const status = p.status === "published" ? { label: "Activo", cls: "text-secondary" }
                      : p.status === "draft"   ? { label: "Borrador", cls: "text-ink-3" }
                      : { label: p.status, cls: "text-orange" }
          return (
            <div
              key={p.id}
              className={`stamp-card stamp-card-hover p-0 overflow-hidden block relative ${p.status !== "published" ? "opacity-70" : ""} ${
                isSelected ? "ring-2 ring-orange" : ""
              } ${isActive ? "outline outline-2 -outline-offset-2 outline-orange" : ""}`}
            >
              <label
                className="absolute top-2 left-2 z-10 w-6 h-6 bg-page/90 rounded-md flex items-center justify-center cursor-pointer"
                style={{ border: "1.5px solid var(--border)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(p.id)}
                />
              </label>
              <Link href={`/products/${p.id}`} className="block">
                <div className="aspect-square bg-cream-2 relative overflow-hidden">
                  <div className={`absolute top-2 right-2 pill ${status.cls}`} style={{ background: "rgb(var(--surface))" }}>
                    <span className="pill-dot" />{status.label}
                  </div>
                  {p.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-3 text-[10px] uppercase tracking-widest">
                      Sin imagen
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="font-display font-bold text-[13px] text-ink leading-tight line-clamp-2">{p.title}</div>
                  <div className="text-[10px] text-ink-3 font-mono truncate">
                    {p.firstSku ?? p.handle ?? "—"}
                  </div>
                  <div className="dotted-div my-2" />
                  <div className="flex items-baseline justify-between">
                    <span className="font-display font-black text-[18px] num">
                      {p.firstPrice != null ? fmtEur(p.firstPrice) : "—"}
                    </span>
                    <span className="text-[10px] text-ink-3 font-display font-bold uppercase">
                      {p.totalStock === 0
                        ? <>— sin stock</>
                        : <>Stock <span className={`${stockToneClass(stockTone)} num`}>{p.totalStock}</span></>}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      <div className="mt-3 text-[10px] font-mono text-ink-3 flex items-center gap-3 px-2">
        <span><kbd className="px-1 py-0 bg-cream rounded" style={{ border: "1px solid var(--border-soft)" }}>j</kbd> <kbd className="px-1 py-0 bg-cream rounded" style={{ border: "1px solid var(--border-soft)" }}>k</kbd> navegar</span>
        <span><kbd className="px-1 py-0 bg-cream rounded" style={{ border: "1px solid var(--border-soft)" }}>↵</kbd> abrir</span>
        <span><kbd className="px-1 py-0 bg-cream rounded" style={{ border: "1px solid var(--border-soft)" }}>x</kbd> seleccionar</span>
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

function stockToneClass(tone: "secondary" | "orange" | "primary" | "muted") {
  switch (tone) {
    case "secondary": return "text-secondary"
    case "orange":    return "text-orange"
    case "primary":   return "text-primary"
    case "muted":     return "text-ink-3"
  }
}
