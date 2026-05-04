import { useState } from "react"
import { Button, Text, toast } from "@medusajs/ui"
import type { SocialPost } from "../types"

const API = "https://api.enrola.shop"

/**
 * Edit media URLs for a post that didn't come from dashboard.html — i.e.
 * promoted posts (external_id = "promoted-…") that the regular `social:sync`
 * doesn't touch. The user pastes a URL pointing at /static/social-media/...
 * (already uploaded by other means) or a public CDN URL, and we PATCH it
 * directly into cover_url / media_urls on the post row.
 *
 * Why URL-paste and not file upload: keeps the backend simple (no multer,
 * no resize, no docker volume bind details). The user already has render.sh
 * for posts; for promoted-content media they can scp / rsync to
 * /root/ryo-store/storefront/scripts/social/promoted/<post>/file.jpg and
 * paste the resulting URL here.
 *
 * Validations:
 *   - URL must start with http/https or /static/social-media/
 *   - File extension whitelist: jpg/jpeg/png/mp4
 *
 * After save, parent's onChange refreshes the card so the new media appears
 * in MediaPreview / ReelFeedback immediately.
 */
export function MediaEditor({
  post,
  onChange,
}: {
  post: SocialPost
  onChange: () => void
}) {
  const [coverDraft, setCoverDraft] = useState("")
  const [urlDraft, setUrlDraft] = useState("")
  const [busy, setBusy] = useState(false)

  const urls: string[] = post.media_urls ?? []

  const valid = (u: string): boolean => {
    if (!u) return false
    if (!/^(https?:\/\/|\/static\/)/i.test(u)) return false
    if (!/\.(jpe?g|png|mp4|mov|webp)(\?|$)/i.test(u)) return false
    return true
  }

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/admin/social/posts/${post.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onChange()
    } catch (e) {
      toast.error("No se pudo guardar", { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const setCover = async () => {
    const u = coverDraft.trim()
    if (!valid(u)) {
      toast.error("URL inválida — debe terminar en .jpg/.png/.mp4 y empezar en http(s):// o /static/")
      return
    }
    await patch({ cover_url: u })
    setCoverDraft("")
    toast.success("Cover seteado")
  }

  const clearCover = () => patch({ cover_url: null }).then(() =>
    toast.success("Cover removido")
  )

  const addMedia = async () => {
    const u = urlDraft.trim()
    if (!valid(u)) {
      toast.error("URL inválida — debe terminar en .jpg/.png/.mp4 y empezar en http(s):// o /static/")
      return
    }
    if (urls.includes(u)) {
      toast.info("Ese URL ya está en la lista")
      return
    }
    await patch({ media_urls: [...urls, u] })
    setUrlDraft("")
    toast.success("Media agregada")
  }

  const removeMedia = async (idx: number) => {
    const next = urls.filter((_, i) => i !== idx)
    await patch({ media_urls: next })
  }

  const moveUp = async (idx: number) => {
    if (idx === 0) return
    const next = [...urls]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    await patch({ media_urls: next })
  }

  return (
    <details className="text-sm group">
      <summary className="cursor-pointer text-ui-fg-subtle hover:text-ui-fg-base text-xs uppercase tracking-wide select-none">
        🎬 Editar media · {urls.length} archivo{urls.length === 1 ? "" : "s"}
        {post.cover_url ? " · cover ✓" : " · sin cover"}
      </summary>

      <div className="mt-2 flex flex-col gap-2 rounded-md border border-ui-border-base p-2 bg-ui-bg-subtle">
        {/* Cover row — only relevant for Reels */}
        {post.format === "Reel" && (
          <div className="flex flex-col gap-1">
            <Text size="xsmall" className="text-ui-fg-subtle uppercase tracking-wide">
              Cover (poster)
            </Text>
            {post.cover_url ? (
              <div className="flex items-center gap-2 rounded border border-ui-border-base bg-ui-bg-base px-2 py-1 text-xs">
                <span className="font-mono truncate flex-1" title={post.cover_url}>
                  {post.cover_url}
                </span>
                <button
                  onClick={clearCover}
                  disabled={busy}
                  className="text-ui-fg-subtle hover:text-ui-fg-error"
                  aria-label="Remover cover"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={coverDraft}
                  onChange={(e) => setCoverDraft(e.target.value)}
                  placeholder="/static/social-media/post-X/cover.jpg"
                  disabled={busy}
                  onKeyDown={(e) => { if (e.key === "Enter") void setCover() }}
                  className="flex-1 text-xs bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 font-mono"
                />
                <Button size="small" variant="secondary" onClick={setCover} disabled={busy}>
                  Setear
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Media list */}
        <div className="flex flex-col gap-1">
          <Text size="xsmall" className="text-ui-fg-subtle uppercase tracking-wide">
            {post.format === "Carrusel" ? "Slides (en orden)"
              : post.format === "Reel" ? "Video del reel"
              : "Imagen"}
          </Text>
          {urls.map((u, idx) => (
            <div
              key={`${u}-${idx}`}
              className="flex items-center gap-2 rounded border border-ui-border-base bg-ui-bg-base px-2 py-1 text-xs"
            >
              <span className="text-ui-fg-muted shrink-0 font-mono w-5 text-right">
                {idx + 1}.
              </span>
              <span className="font-mono truncate flex-1" title={u}>
                {u}
              </span>
              {urls.length > 1 && idx > 0 && (
                <button
                  onClick={() => moveUp(idx)}
                  disabled={busy}
                  className="text-ui-fg-subtle hover:text-ui-fg-base"
                  title="Subir"
                  aria-label="Subir"
                >
                  ↑
                </button>
              )}
              <button
                onClick={() => removeMedia(idx)}
                disabled={busy}
                className="text-ui-fg-subtle hover:text-ui-fg-error"
                aria-label="Quitar"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-1">
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="/static/social-media/post-X/file.jpg  ·  o https://…"
              disabled={busy}
              onKeyDown={(e) => { if (e.key === "Enter") void addMedia() }}
              className="flex-1 text-xs bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 font-mono"
            />
            <Button size="small" variant="secondary" onClick={addMedia} disabled={busy}>
              + Agregar
            </Button>
          </div>
        </div>

        <Text size="xsmall" className="text-ui-fg-muted">
          💡 El path debe terminar en <code>.jpg</code> / <code>.png</code> / <code>.mp4</code>.
          Subí los archivos al VPS bajo <code>/root/ryo-store/storefront/scripts/social/&lt;carpeta&gt;/</code>
          y pegá la URL <code>/static/social-media/&lt;carpeta&gt;/&lt;archivo&gt;</code>.
        </Text>
      </div>
    </details>
  )
}
