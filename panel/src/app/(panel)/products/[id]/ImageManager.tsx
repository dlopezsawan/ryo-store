"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Upload, X, Star, AlertCircle, CheckCircle2, Loader2, GripVertical } from "lucide-react"
import {
  uploadProductImagesAction,
  removeProductImageAction,
  setProductThumbnailAction,
  reorderProductImagesAction,
} from "./actions"

interface ImageRow {
  id: string
  url: string
}

interface Props {
  productId: string
  thumbnail: string | null
  images: ImageRow[]
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function ImageManager({ productId, thumbnail, images }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Local order state — sincronizada con prop, mutable al hacer reorder
  const [localOrder, setLocalOrder] = useState<ImageRow[]>(images)
  useEffect(() => { setLocalOrder(images) }, [images])

  const [draggedUrl, setDraggedUrl] = useState<string | null>(null)
  const [dragOverUrl, setDragOverUrl] = useState<string | null>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function upload(files: FileList | File[] | null) {
    if (!files || (files instanceof FileList && files.length === 0)) return
    const arr = Array.from(files)
    if (arr.length === 0) return
    const fd = new FormData()
    for (const f of arr) fd.append("files", f, f.name)
    startTransition(async () => {
      const res = await uploadProductImagesAction(productId, fd)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${res.data?.urls.length ?? arr.length} imagen(es) subida(s)`)
      router.refresh()
    })
  }

  function remove(url: string) {
    startTransition(async () => {
      const res = await removeProductImageAction(productId, url)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Imagen eliminada")
      router.refresh()
    })
  }

  function setThumb(url: string) {
    startTransition(async () => {
      const res = await setProductThumbnailAction(productId, url)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Thumbnail actualizado")
      router.refresh()
    })
  }

  function handleDragStart(url: string) {
    setDraggedUrl(url)
  }

  function handleDragEnter(url: string) {
    if (!draggedUrl || url === draggedUrl) return
    setDragOverUrl(url)
  }

  function handleDragEnd() {
    if (!draggedUrl || !dragOverUrl || draggedUrl === dragOverUrl) {
      setDraggedUrl(null); setDragOverUrl(null); return
    }
    // Reorder local
    const fromIdx = localOrder.findIndex((i) => i.url === draggedUrl)
    const toIdx   = localOrder.findIndex((i) => i.url === dragOverUrl)
    if (fromIdx < 0 || toIdx < 0) {
      setDraggedUrl(null); setDragOverUrl(null); return
    }
    const next = [...localOrder]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setLocalOrder(next)
    setDraggedUrl(null); setDragOverUrl(null)

    // Persist
    startTransition(async () => {
      const res = await reorderProductImagesAction(productId, next.map((i) => i.url))
      if (!res.ok) {
        flash("err", res.error)
        // Revert UI
        setLocalOrder(images)
      } else {
        flash("ok", "Orden actualizado")
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* Hero (thumbnail actual) */}
      <div className="aspect-square bg-cream-2 relative overflow-hidden stamp-card p-0">
        {thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-3 text-[10px] uppercase tracking-widest">
            Sin thumbnail
          </div>
        )}
        <span
          className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] font-display font-bold uppercase tracking-wider bg-orange text-dark px-2 py-0.5 rounded-md"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          <Star size={10} strokeWidth={3} fill="currentColor" /> Thumbnail
        </span>
      </div>

      {/* Drop zone + grid */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files) }}
        className={`stamp-card p-4 transition-colors ${dragOver ? "bg-orange/10" : ""}`}
        style={{ borderStyle: dragOver ? "dashed" : "solid", borderWidth: dragOver ? 2 : undefined }}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-black text-[12px] uppercase tracking-wider">
            Galería ({images.length})
          </h4>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} strokeWidth={2.5} />}
            Subir
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => { upload(e.target.files); e.target.value = "" }}
          className="hidden"
        />

        {localOrder.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-ink-3">
            Arrastra imágenes aquí o usa <span className="text-orange font-bold">Subir</span>
            <p className="mt-1 font-mono text-[10px]">PNG · JPG · WEBP · max 8 MB · multiple</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-ink-3 font-mono mb-2">
              <GripVertical size={10} className="inline mr-0.5" /> arrastrá las miniaturas para reordenar · primera = thumbnail
            </p>
          <div className="grid grid-cols-3 gap-2">
            {localOrder.map((img) => {
              const isThumb = img.url === thumbnail
              const isDragging = draggedUrl === img.url
              const isDragOver = dragOverUrl === img.url
              return (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => handleDragStart(img.url)}
                  onDragEnter={() => handleDragEnter(img.url)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDragEnd}
                  className={`aspect-square bg-cream-2 relative overflow-hidden group cursor-grab active:cursor-grabbing transition-all ${
                    isDragging ? "opacity-40" : ""
                  } ${isDragOver ? "scale-105 ring-2 ring-orange" : ""}`}
                  style={{ border: isThumb ? "2px solid #FF3B27" : "1.5px solid var(--border)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center gap-1 p-1.5 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent 60%)" }}>
                    {!isThumb && (
                      <button
                        type="button"
                        onClick={() => setThumb(img.url)}
                        disabled={pending}
                        className="pointer-events-auto bg-orange text-dark rounded-md px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider hover:translate-y-[-1px] disabled:opacity-50"
                        style={{ border: "1px solid #1A1A1A" }}
                        title="Usar como thumbnail"
                      >
                        <Star size={9} strokeWidth={3} className="inline" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(img.url)}
                      disabled={pending}
                      className="pointer-events-auto bg-primary text-white rounded-md px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider hover:translate-y-[-1px] disabled:opacity-50"
                      style={{ border: "1px solid #1A1A1A" }}
                      title="Eliminar"
                    >
                      <X size={9} strokeWidth={3} className="inline" />
                    </button>
                  </div>
                  {isThumb && (
                    <span className="absolute top-1 left-1 bg-orange text-dark rounded-md px-1 py-0.5 text-[8px] font-display font-bold uppercase tracking-wider" style={{ border: "1px solid #1A1A1A" }}>
                      ★
                    </span>
                  )}
                  <span className="absolute bottom-1 left-1 bg-page/80 text-ink-3 rounded-md px-1 py-0 text-[8px] font-mono opacity-0 group-hover:opacity-100">
                    <GripVertical size={9} className="inline" />
                  </span>
                </div>
              )
            })}
          </div>
          </>
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
    </div>
  )
}
