import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useState, useRef } from "react"

const BACKEND = __BACKEND_URL__ ?? ""

type Props = {
  data: {
    id: string
    metadata?: Record<string, unknown> | null
  }
}

const ProductSliderImageWidget = ({ data }: Props) => {
  const initial = (data.metadata?.slider_image as string) || ""
  const [imageUrl, setImageUrl] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const saveToProduct = async (url: string) => {
    setSaving(true)
    try {
      const res = await fetch(`${BACKEND}/admin/products/${data.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            ...(data.metadata || {}),
            slider_image: url || null,
          },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2500)
    } catch (err) {
      console.error("[slider-image] Save failed:", err)
      alert("No se pudo guardar la imagen. Intentá de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("files", file)
      const res = await fetch(`${BACKEND}/admin/uploads`, {
        method: "POST",
        credentials: "include",
        body: fd,
      })
      if (!res.ok) throw new Error("Upload failed")
      const d = await res.json()
      const url = d.files?.[0]?.url ?? d.uploads?.[0]?.url ?? ""
      if (!url) throw new Error("Upload returned no URL")
      setImageUrl(url)
      await saveToProduct(url)
    } catch (err) {
      console.error("[slider-image] Upload failed:", err)
      alert("Error al subir la imagen.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleClear = async () => {
    setImageUrl("")
    await saveToProduct("")
  }

  return (
    <div
      style={{
        padding: 16,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Imagen del slider (home)</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            Imagen standalone para el carrusel principal. Si está vacía se usa el thumbnail.
          </div>
        </div>
        {savedToast && (
          <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Guardado ✓</span>
        )}
      </div>

      {imageUrl ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "20 / 9",
              background: "#f3f4f6",
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
            }}
          >
            <img
              src={imageUrl}
              alt="slider"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || saving}
              style={{
                flex: 1,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: uploading || saving ? "wait" : "pointer",
              }}
            >
              {uploading ? "Subiendo..." : "Reemplazar"}
            </button>
            <button
              onClick={handleClear}
              disabled={uploading || saving}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                border: "1px solid #fecaca",
                background: "#fff",
                color: "#dc2626",
                cursor: uploading || saving ? "wait" : "pointer",
              }}
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || saving}
          style={{
            width: "100%",
            padding: "24px 12px",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 6,
            border: "1px dashed #d1d5db",
            background: "#fafafa",
            color: "#374151",
            cursor: uploading || saving ? "wait" : "pointer",
          }}
        >
          {uploading ? "Subiendo..." : saving ? "Guardando..." : "+ Subir imagen para slider"}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>
        Recomendado: 1920 × 864 px (aspect 20:9), webp o jpg. El slider recorta a este ratio.
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductSliderImageWidget
