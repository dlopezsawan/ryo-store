"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, AlertCircle, CheckCircle2, Sparkles, X, Image as ImageIcon, Hash, Send,
  Calendar, AtSign, Loader2,
} from "lucide-react"
import { crossPostAction, updatePostAction } from "./actions"
import { uploadFileAction } from "./uploadActions"

type Toast = { kind: "ok" | "err"; msg: string } | null

const ALL_CHANNELS = [
  { id: "instagram", label: "INSTAGRAM",   color: "#E1306C", maxChars: 2200 },
  { id: "tiktok",    label: "TIKTOK",      color: "#000000", maxChars: 2200 },
  { id: "twitter",   label: "X / TWITTER", color: "#1DA1F2", maxChars: 280 },
  { id: "facebook",  label: "FACEBOOK",    color: "#1877F2", maxChars: 5000 },
  { id: "youtube",   label: "YOUTUBE",     color: "#FF0000", maxChars: 1000 },
  { id: "blog",      label: "BLOG",        color: "#4D5431", maxChars: 100000 },
] as const

const SUGGESTED_HASHTAGS = [
  "ryostore", "venezuela", "rollingpapers", "smokeshop", "420",
  "grinder", "lifestyle", "caracas", "stoner", "smokers",
  "rolling", "highlife", "weedlovers", "headshop", "cannabiscommunity",
]

const TONES = ["casual", "profesional", "divertido", "minimalista", "épico", "irónico"] as const

interface ExistingPost {
  id: string
  channel?: string | null
  title: string
  caption?: string | null
  date_planned?: string | null
  status: string
  media_urls?: string[] | null
}

interface Props {
  /** Si se pasa, modo edit. Si no, modo create. */
  existing?: ExistingPost | null
  /** Trigger custom (si no se pasa, se renderiza un botón "Nuevo post" estándar). */
  triggerLabel?: string
  /** Inicial selected date (ISO local datetime) — usado por drag&drop o click en calendar. */
  initialDate?: string | null
  /** Si ya está abierto (controlled). Si no, autocontenido con su propio botón. */
  open?: boolean
  onClose?: () => void
}

export function PostEditor({ existing, triggerLabel, initialDate, open: controlledOpen, onClose }: Props) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (v: boolean) => {
    if (controlledOpen !== undefined) {
      if (!v) onClose?.()
    } else {
      setInternalOpen(v)
      if (!v) onClose?.()
    }
  }

  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const isEdit = !!existing
  const [channels, setChannels] = useState<string[]>(
    existing?.channel ? [existing.channel] : ["instagram"],
  )
  const [title, setTitle] = useState(existing?.title ?? "")
  const [caption, setCaption] = useState(existing?.caption ?? "")
  const [datePlanned, setDatePlanned] = useState(() => {
    if (existing?.date_planned) {
      // Convert ISO → datetime-local (YYYY-MM-DDTHH:mm)
      const d = new Date(existing.date_planned)
      const off = d.getTimezoneOffset()
      const local = new Date(d.getTime() - off * 60_000)
      return local.toISOString().slice(0, 16)
    }
    if (initialDate) return initialDate
    return ""
  })
  const [status, setStatus] = useState<string>(existing?.status ?? "draft")
  const [mediaUrls, setMediaUrls] = useState<string[]>(existing?.media_urls ?? [])
  const [hashtags, setHashtags] = useState<string[]>([])
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiTone, setAiTone] = useState<typeof TONES[number]>("casual")
  const [aiLength, setAiLength] = useState<"short" | "medium" | "long">("medium")
  const [aiOpen, setAiOpen] = useState(false)
  const [mentionsOpen, setMentionsOpen] = useState(false)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 5000)
  }

  function reset() {
    setChannels(["instagram"])
    setTitle("")
    setCaption("")
    setDatePlanned("")
    setStatus("draft")
    setMediaUrls([])
    setHashtags([])
    setAiPrompt("")
    setAiOpen(false)
  }

  // Sync to initialDate when caller changes it (e.g. user clicks another day)
  useEffect(() => {
    if (initialDate && !isEdit) setDatePlanned(initialDate)
  }, [initialDate, isEdit])

  // Auto-detect hashtags inline en caption ("#tag")
  useEffect(() => {
    const found = caption.match(/#(\w+)/g)?.map((t) => t.slice(1).toLowerCase()) ?? []
    setHashtags((prev) => {
      const set = new Set([...prev, ...found])
      return Array.from(set)
    })
  }, [caption])

  function toggleChannel(id: string) {
    setChannels((cur) => cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id])
  }

  function toggleHashtag(tag: string) {
    setHashtags((cur) => cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag])
  }

  // Char count (uses min limit across selected channels)
  const charLimit = channels.length > 0
    ? Math.min(...ALL_CHANNELS.filter((c) => channels.includes(c.id)).map((c) => c.maxChars))
    : 2200
  const fullText = `${caption}${hashtags.length > 0 ? "\n\n" + hashtags.map((h) => `#${h}`).join(" ") : ""}`
  const charCount = fullText.length
  const overLimit = charCount > charLimit

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const fd = new FormData()
      for (const f of Array.from(files)) fd.append("files", f)
      const res = await uploadFileAction(fd)
      if (!res.ok) {
        flash("err", res.error)
      } else {
        setMediaUrls((cur) => [...cur, ...res.urls])
        flash("ok", `${res.urls.length} archivo(s) subido(s)`)
      }
    } finally {
      setUploading(false)
    }
  }

  async function generateWithAi() {
    const prompt = aiPrompt.trim() || title.trim()
    if (!prompt) {
      flash("err", "Escribe un título o prompt para que la IA tenga contexto")
      return
    }
    setAiLoading(true)
    try {
      const res = await fetch("/api/social/ai-copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          channel: channels[0] ?? "instagram",
          tone: aiTone,
          length: aiLength,
        }),
      })
      const data = await res.json() as { ok: boolean; caption?: string; hashtags?: string[]; error?: string }
      if (!data.ok) {
        flash("err", data.error ?? "Error generando copy")
      } else {
        if (data.caption) setCaption(data.caption)
        if (data.hashtags?.length) {
          setHashtags((cur) => Array.from(new Set([...cur, ...data.hashtags!])))
        }
        flash("ok", "Copy generado")
        setAiOpen(false)
      }
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Error de red")
    } finally {
      setAiLoading(false)
    }
  }

  function submit() {
    if (!title.trim()) return flash("err", "Título requerido")
    if (channels.length === 0) return flash("err", "Selecciona al menos un canal")
    if (overLimit) return flash("err", `Texto excede ${charLimit} caracteres`)

    const isoDate = datePlanned ? new Date(datePlanned).toISOString() : undefined
    const fullCaption = fullText
    const meta = hashtags.length > 0 ? { hashtags } : undefined

    startTransition(async () => {
      if (isEdit && existing) {
        const res = await updatePostAction(existing.id, {
          channel: channels[0],
          title: title.trim(),
          content: fullCaption,
          date_planned: isoDate,
          status,
          media_urls: mediaUrls,
          metadata: meta,
        })
        if (!res.ok) return flash("err", res.error)
        flash("ok", "Post actualizado")
      } else {
        const res = await crossPostAction({
          channels,
          title: title.trim(),
          content: fullCaption,
          date_planned: isoDate,
          status,
          media_urls: mediaUrls,
          metadata: meta,
        })
        if (!res.ok) return flash("err", res.error)
        if (res.failed.length === 0) {
          flash("ok", `${res.created} post(s) creado(s)`)
        } else {
          flash("err", `${res.created} OK · ${res.failed.length} fallaron — ej: ${res.failed[0].error}`)
        }
      }
      reset()
      setOpen(false)
      router.refresh()
    })
  }

  const ChannelBadge = ({ id }: { id: string }) => {
    const c = ALL_CHANNELS.find((x) => x.id === id)
    if (!c) return null
    const active = channels.includes(id)
    return (
      <button
        type="button"
        onClick={() => toggleChannel(id)}
        disabled={isEdit}
        className={`px-2.5 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
          active ? "text-white" : "text-ink-3 hover:bg-cream-2"
        }`}
        style={active
          ? { background: c.color, border: `1.5px solid ${c.color}` }
          : { border: "1.5px solid var(--border)", background: "transparent" }}
      >
        {c.label}
      </button>
    )
  }

  return (
    <>
      {controlledOpen === undefined && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Plus size={11} strokeWidth={3} /> {triggerLabel ?? "Nuevo post"}
        </button>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && setOpen(false)}>
          <div className="bg-page rounded-md max-w-3xl w-full p-6 max-h-[92vh] overflow-y-auto" style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink">
                {isEdit ? "Editar post" : "Nuevo post"}
              </h3>
              <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink p-1">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Channels */}
              <Section title="CANAL(ES)" hint={isEdit ? "no editable en posts existentes" : "selecciona uno o varios para cross-posting"}>
                <div className="flex items-center gap-2 flex-wrap">
                  {ALL_CHANNELS.map((c) => <ChannelBadge key={c.id} id={c.id} />)}
                </div>
              </Section>

              {/* Title */}
              <Section title="TÍTULO INTERNO *" hint="solo para identificarlo en el panel">
                <input type="text" autoFocus={!isEdit} value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Promo grinders pre-420"
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Section>

              {/* AI block */}
              <Section title={
                <span className="flex items-center gap-1.5">
                  <Sparkles size={11} strokeWidth={2.5} className="text-orange" />
                  GENERAR CON IA
                </span>
              } hint="opcional">
                {!aiOpen ? (
                  <button type="button" onClick={() => setAiOpen(true)}
                    className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-orange hover:bg-orange/10 flex items-center gap-1.5"
                    style={{ border: "1.5px dashed #FF3B27" }}>
                    <Sparkles size={11} strokeWidth={2.5} /> Sugerir caption + hashtags
                  </button>
                ) : (
                  <div className="space-y-2 p-3 bg-orange/5 rounded-md" style={{ border: "1.5px dashed #FF3B27" }}>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={2}
                      placeholder="Brief del post (ej: Lanzamos nueva línea de papers de cáñamo, énfasis en sustentabilidad)"
                      className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none resize-none"
                      style={{ border: "1.5px solid var(--border)" }}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={aiTone} onChange={(e) => setAiTone(e.target.value as typeof TONES[number])}
                        className="px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
                        {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select value={aiLength} onChange={(e) => setAiLength(e.target.value as typeof aiLength)}
                        className="px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
                        <option value="short">corto</option>
                        <option value="medium">medio</option>
                        <option value="long">largo</option>
                      </select>
                      <button type="button" onClick={generateWithAi} disabled={aiLoading}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                        style={{ border: "1.5px solid #1A1A1A" }}>
                        {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} strokeWidth={2.5} />}
                        {aiLoading ? "Pensando…" : "Generar"}
                      </button>
                      <button type="button" onClick={() => setAiOpen(false)} className="text-ink-3 px-2 text-[10px] font-display font-bold uppercase">
                        cancelar
                      </button>
                    </div>
                  </div>
                )}
              </Section>

              {/* Caption */}
              <Section
                title="CAPTION"
                hint={
                  <span className={overLimit ? "text-primary" : "text-ink-3"}>
                    {charCount} / {charLimit} chars
                  </span>
                }
              >
                <textarea rows={6} value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="Texto del post… Usa #tag para crear hashtags inline o @usuario para mentions."
                  className={`w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none resize-none ${overLimit ? "ring-2 ring-primary/40" : ""}`}
                  style={{ border: "1.5px solid var(--border)" }} />
              </Section>

              {/* Hashtags chip picker */}
              <Section title={<span className="flex items-center gap-1.5"><Hash size={11} strokeWidth={2.5} /> HASHTAGS</span>}>
                <div className="space-y-2">
                  {hashtags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap p-2 bg-cream-2/50 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
                      {hashtags.map((t) => (
                        <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-orange/15 text-orange rounded-md text-[10px] font-mono font-bold">
                          #{t}
                          <button onClick={() => toggleHashtag(t)} className="text-orange/60 hover:text-primary">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 flex-wrap">
                    {SUGGESTED_HASHTAGS.filter((h) => !hashtags.includes(h)).slice(0, 12).map((t) => (
                      <button key={t} type="button" onClick={() => toggleHashtag(t)}
                        className="px-2 py-0.5 text-[10px] font-mono text-ink-3 hover:bg-orange/10 hover:text-orange rounded-md" style={{ border: "1px dashed var(--border)" }}>
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Media uploads */}
              <Section title={<span className="flex items-center gap-1.5"><ImageIcon size={11} strokeWidth={2.5} /> MEDIA</span>} hint={`${mediaUrls.length} archivo(s)`}>
                <div className="space-y-2">
                  {mediaUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {mediaUrls.map((url, i) => (
                        <div key={i} className="relative group aspect-square bg-cream-2 overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`media-${i}`} className="w-full h-full object-cover" />
                          <button onClick={() => setMediaUrls((cur) => cur.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 bg-primary text-white p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50 flex items-center gap-1.5"
                    style={{ border: "1.5px dashed var(--border)" }}>
                    {uploading ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} strokeWidth={2.5} />}
                    {uploading ? "Subiendo…" : "Subir imagen / video"}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
                    onChange={(e) => { void handleFiles(e.target.files); e.target.value = "" }} />
                </div>
              </Section>

              {/* Schedule + status */}
              <div className="grid grid-cols-2 gap-3">
                <Section title={<span className="flex items-center gap-1.5"><Calendar size={11} strokeWidth={2.5} /> FECHA PROGRAMADA</span>} hint="zona local Caracas">
                  <input type="datetime-local" value={datePlanned} onChange={(e) => setDatePlanned(e.target.value)}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </Section>
                <Section title="ESTADO">
                  <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
                    <option value="draft">Borrador</option>
                    <option value="in_review">En review</option>
                    <option value="approved">Aprobado</option>
                    <option value="scheduled">Programado</option>
                  </select>
                </Section>
              </div>

              {/* Mentions hint */}
              <button type="button" onClick={() => setMentionsOpen((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-ink-3 hover:text-orange font-display font-bold uppercase tracking-wider">
                <AtSign size={10} strokeWidth={2.5} /> {mentionsOpen ? "Ocultar" : "Mostrar"} ayuda mentions
              </button>
              {mentionsOpen && (
                <div className="text-[10px] text-ink-3 font-mono p-2 bg-cream-2/50 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
                  Usa <code className="text-orange">@usuario</code> en el caption. Cada plataforma resuelve mentions distinto:
                  IG/FB requieren handle exacto, X reconoce automáticamente, TikTok ignora si no existe.
                  Los mentions se guardan tal cual en el post.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4" style={{ borderTop: "1.5px dashed var(--border)" }}>
              <button type="button" onClick={() => setOpen(false)} disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
                Cancelar
              </button>
              <button type="button" onClick={submit} disabled={pending || !title.trim() || channels.length === 0 || overLimit}
                className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all flex items-center gap-1.5"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
                <Send size={11} strokeWidth={2.5} />
                {pending ? "Guardando…" : isEdit ? "Guardar cambios" : `Crear ${channels.length > 1 ? `× ${channels.length}` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, hint, children }: { title: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2">{title}</label>
        {hint && <span className="text-[9px] font-mono text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
