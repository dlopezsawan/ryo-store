import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import type { SocialTrendSource, SocialTrendBrief, TrendKind } from "../types"

const API = "https://api.enrola.shop"

const KIND_META: Record<TrendKind, { label: string; color: "grey" | "orange" | "red" | "blue" | "purple"; icon: string }> = {
  reddit_post:    { label: "Reddit",  color: "orange", icon: "🔥" },
  youtube_video:  { label: "YouTube", color: "red",    icon: "▶" },
  google_term:    { label: "Google",  color: "blue",   icon: "📈" },
  instagram_post: { label: "IG",      color: "grey",   icon: "📸" },
  tiktok_video:   { label: "TikTok",  color: "purple", icon: "🎵" },
}

/**
 * Trends view — mounted as the 4th tab in the social admin.
 *
 * Two panes:
 *   - Left 2/3: feed of trending signals (Reddit/YouTube), filterable by kind.
 *   - Right 1/3: the weekly AI brief (themes + content ideas + hashtags to watch).
 *
 * "Actualizar" button triggers /trends/refresh (fetches + upserts + optionally
 * regenerates brief). Cron also runs every 4h so manual refresh is rarely
 * needed — it's mostly a "force it" button for the impatient.
 */
export function TrendsView() {
  const [sources, setSources] = useState<SocialTrendSource[]>([])
  const [brief, setBrief] = useState<SocialTrendBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [kindFilter, setKindFilter] = useState<TrendKind | "all">("all")
  const [days, setDays] = useState(7)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ days: String(days), limit: "60" })
      if (kindFilter !== "all") qs.set("kind", kindFilter)
      const res = await fetch(`${API}/admin/social/trends?${qs}`, {
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json())
      setSources(res.sources ?? [])
      setBrief(res.brief ?? null)
    } catch (e) {
      toast.error("Error cargando trends", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [kindFilter, days])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = async (includeBrief: boolean) => {
    setRefreshing(true)
    try {
      const res = await fetch(`${API}/admin/social/trends/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: includeBrief }),
      }).then((r) => r.json())
      if (!res.ok) throw new Error("Refresh falló")
      toast.success(
        `${res.collected.total} señales · +${res.upsert.created} nuevas · ${res.upsert.updated} actualizadas` +
          (includeBrief && res.brief ? ` · brief semana ${res.brief.week}` : "")
      )
      await load()
    } catch (e) {
      toast.error("No se pudo actualizar", { description: (e as Error).message })
    } finally {
      setRefreshing(false)
    }
  }

  const kindCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of sources) c[s.kind] = (c[s.kind] ?? 0) + 1
    return c
  }, [sources])

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <Container className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterBtn
            active={kindFilter === "all"}
            onClick={() => setKindFilter("all")}
            label={`Todo (${sources.length})`}
          />
          {(["reddit_post", "youtube_video", "google_term", "tiktok_video"] as TrendKind[]).map((k) => (
            <FilterBtn
              key={k}
              active={kindFilter === k}
              onClick={() => setKindFilter(k)}
              label={`${KIND_META[k].icon} ${KIND_META[k].label} (${kindCounts[k] ?? 0})`}
            />
          ))}
          <span className="mx-2 h-5 w-px bg-ui-border-base" />
          {[3, 7, 14].map((d) => (
            <FilterBtn
              key={d}
              active={days === d}
              onClick={() => setDays(d)}
              label={`${d}d`}
              small
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" disabled={refreshing} onClick={() => refresh(false)}>
            {refreshing ? "…" : "↻ Actualizar"}
          </Button>
          <Button size="small" disabled={refreshing} onClick={() => refresh(true)}>
            {refreshing ? "…" : "🧠 Actualizar + Brief"}
          </Button>
        </div>
      </Container>

      {/* YouTube channel subscriptions — RSS-based, free, real-time */}
      <YouTubeSubscriptionPanel onChange={() => void load()} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Feed — 2/3 */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          <Heading level="h2">
            Señales · {sources.length}
          </Heading>

          {loading ? (
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          ) : sources.length === 0 ? (
            <Container className="p-6 text-center">
              <Text className="text-ui-fg-subtle">
                Todavía no hay señales. Tocá <strong>Actualizar</strong> arriba para tirar el primer fetch.
              </Text>
            </Container>
          ) : (
            <ul className="flex flex-col gap-2">
              {sources.map((s) => (
                <TrendCard key={s.id} source={s} />
              ))}
            </ul>
          )}
        </div>

        {/* Brief — 1/3 */}
        <aside className="flex flex-col gap-3">
          <Heading level="h2">Brief IA</Heading>
          {brief ? (
            <BriefCard brief={brief} />
          ) : (
            <Container className="p-4">
              <Text className="text-ui-fg-subtle text-sm">
                Sin brief aún. Tocá <strong>🧠 Actualizar + Brief</strong> para generar uno con los datos actuales.
              </Text>
            </Container>
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Individual trend card ─────────────────────────────────────────
function TrendCard({ source }: { source: SocialTrendSource }) {
  const meta = KIND_META[source.kind as TrendKind] ?? KIND_META.reddit_post
  const postedAgo = source.posted_at ? relTime(source.posted_at) : null
  return (
    <Container className="p-3 flex gap-3">
      {source.media_url && (
        <a href={source.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img
            src={source.media_url}
            alt=""
            className="w-24 h-24 object-cover rounded border border-ui-border-base bg-ui-bg-subtle"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </a>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge size="2xsmall" color={meta.color}>
            {meta.icon} {meta.label}
          </Badge>
          {source.author && (
            <Text size="xsmall" className="text-ui-fg-muted truncate">
              {source.author}
            </Text>
          )}
          {postedAgo && (
            <Text size="xsmall" className="text-ui-fg-muted">
              · {postedAgo}
            </Text>
          )}
        </div>
        <a
          href={source.permalink ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-ui-fg-base hover:text-ui-fg-interactive line-clamp-2"
        >
          {source.title}
        </a>
        {source.summary && (
          <Text size="small" className="text-ui-fg-subtle line-clamp-2">
            {source.summary}
          </Text>
        )}
        <div className="flex items-center gap-3 text-xs text-ui-fg-muted">
          {source.score > 0 && <span>⬆ {formatCount(source.score)}</span>}
          {source.comments > 0 && <span>💬 {formatCount(source.comments)}</span>}
          {source.keywords && source.keywords.length > 0 && (
            <span className="truncate">· {source.keywords.slice(0, 3).join(" · ")}</span>
          )}
        </div>
      </div>
    </Container>
  )
}

// ── Brief card ────────────────────────────────────────────────────
function BriefCard({ brief }: { brief: SocialTrendBrief }) {
  const c = brief.content
  return (
    <Container className="p-4 flex flex-col gap-3">
      <Text size="xsmall" className="text-ui-fg-muted">
        Semana {brief.week_start} · generado {relTime(brief.generated_at)}
        {brief.model_name && ` · ${brief.model_name}`}
      </Text>

      {c.themes && c.themes.length > 0 && (
        <section>
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wide mb-2">
            Temas
          </Text>
          <ul className="flex flex-col gap-2">
            {c.themes.map((t, i) => (
              <li key={i} className="text-sm">
                <div className="font-medium text-ui-fg-base">{t.title}</div>
                <div className="text-ui-fg-subtle text-xs mt-0.5">{t.why}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.content_ideas && c.content_ideas.length > 0 && (
        <section>
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wide mb-2">
            Ideas de contenido
          </Text>
          <ul className="flex flex-col gap-1 text-sm">
            {c.content_ideas.map((idea, i) => (
              <li key={i} className="text-ui-fg-base">
                · {idea}
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.hashtag_watch && c.hashtag_watch.length > 0 && (
        <section>
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wide mb-2">
            Hashtags a vigilar
          </Text>
          <div className="flex flex-wrap gap-1">
            {c.hashtag_watch.map((h) => (
              <Badge key={h} size="xsmall" color="grey">
                {h.startsWith("#") ? h : `#${h}`}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </Container>
  )
}

// ── Small atoms ───────────────────────────────────────────────────
function FilterBtn({
  active, onClick, label, small,
}: {
  active: boolean
  onClick: () => void
  label: string
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`${small ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"} rounded-md border transition ${
        active
          ? "border-ui-fg-base bg-ui-bg-component text-ui-fg-base"
          : "border-ui-border-base text-ui-fg-subtle hover:text-ui-fg-base"
      }`}
    >
      {label}
    </button>
  )
}

function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `hace ${s}s`
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`
  return `hace ${Math.floor(s / 86400)}d`
}

// ─── YouTube subscription panel ────────────────────────────────────
/**
 * Manage the list of YouTube channels the cron polls via RSS. Each
 * channel becomes a row in social_trend_subscription with kind=
 * "youtube_channel". The cron fetches /feeds/videos.xml?channel_id=X
 * for each active row every refresh and merges new videos into
 * social_trend_source.
 */
interface SocialTrendSubscription {
  id: string
  kind: string
  source_id: string
  label: string
  active: boolean
  last_fetched_at: string | null
  last_error: string | null
  fetch_error_count: number
}

function YouTubeSubscriptionPanel({ onChange }: { onChange: () => void }) {
  const [subs, setSubs] = useState<SocialTrendSubscription[]>([])
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [channelId, setChannelId] = useState("")
  const [label, setLabel] = useState("")
  const [pasted, setPasted] = useState("") // Raw user input — URL/handle/UCxxx

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/admin/social/trend-subscriptions?kind=youtube_channel`,
        { credentials: "include", cache: "no-store" },
      ).then((r) => r.json())
      setSubs(res.subscriptions ?? [])
    } catch {
      /* silent — non-critical UI */
    }
  }, [])

  useEffect(() => { void load() }, [load])

  /**
   * Server-side resolver: takes anything the user pasted (UCxxx, full URL,
   * @handle, /c/Name, /user/Name, even a bare name) and returns a clean
   * channel_id + name. Filling the form auto-runs this when the input
   * looks like a URL or handle so the user doesn't have to click resolve.
   */
  const resolve = async (input: string) => {
    if (!input.trim()) return
    setResolving(true)
    try {
      const res = await fetch(
        `${API}/admin/social/youtube/resolve-channel?input=${encodeURIComponent(input.trim())}`,
        { credentials: "include" },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        toast.error("No pude resolver el canal", { description: data.message })
        return
      }
      const data = (await res.json()) as { channel_id: string; name: string }
      setChannelId(data.channel_id)
      // Don't clobber a label the user typed manually
      if (!label.trim()) setLabel(data.name)
    } finally {
      setResolving(false)
    }
  }

  const add = async () => {
    if (!channelId.trim() || !label.trim()) {
      toast.error("Channel ID y nombre son obligatorios")
      return
    }
    setAdding(true)
    try {
      const res = await fetch(`${API}/admin/social/trend-subscriptions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "youtube_channel",
          source_id: channelId.trim(),
          label: label.trim(),
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(data.message ?? `HTTP ${res.status}`)
      }
      toast.success(`Canal "${label}" agregado`)
      setChannelId(""); setLabel(""); setPasted("")
      await load()
      onChange()
    } catch (e) {
      toast.error("No se pudo agregar", { description: (e as Error).message })
    } finally {
      setAdding(false)
    }
  }

  const toggle = async (sub: SocialTrendSubscription) => {
    await fetch(`${API}/admin/social/trend-subscriptions/${sub.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !sub.active }),
    })
    await load()
  }

  const remove = async (sub: SocialTrendSubscription) => {
    if (!confirm(`¿Quitar "${sub.label}"? Las señales ya capturadas se mantienen.`)) return
    await fetch(`${API}/admin/social/trend-subscriptions/${sub.id}`, {
      method: "DELETE",
      credentials: "include",
    })
    await load()
  }

  const activeCount = subs.filter((s) => s.active).length

  return (
    <Container className="p-3 flex flex-col gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden>▶</span>
          <Heading level="h3" className="inline">Canales de YouTube</Heading>
          <Badge size="xsmall" color="grey">{activeCount} activos</Badge>
          {subs.length > activeCount && (
            <Text size="xsmall" className="text-ui-fg-muted">
              · {subs.length - activeCount} pausados
            </Text>
          )}
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {open ? "Ocultar" : "Mostrar"}
        </Text>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          <Text size="small" className="text-ui-fg-muted">
            Suscripciones por canal vía RSS — gratis, sin cuota, casi en
            tiempo real. Pegá la URL del canal (o <code>@handle</code>) y
            te resuelvo el ID automáticamente. Cuando suben un video lo
            capturamos en el próximo refresh.
          </Text>

          {/* Add form — single paste field that auto-resolves */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="https://youtube.com/@handle  ·  /channel/UCxxx  ·  o sólo @handle"
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value)
                  // Clear resolved state if the user starts editing again
                  if (channelId) setChannelId("")
                }}
                onBlur={() => {
                  if (pasted.trim() && !channelId) void resolve(pasted)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !channelId) {
                    e.preventDefault()
                    void resolve(pasted)
                  }
                }}
                disabled={adding || resolving}
                className="text-sm bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 flex-1 min-w-[320px]"
              />
              <Button
                size="small"
                variant="secondary"
                disabled={!pasted.trim() || resolving || adding}
                onClick={() => void resolve(pasted)}
              >
                {resolving ? "…" : "Buscar"}
              </Button>
            </div>

            {/* Resolved result — only shown after successful resolve */}
            {channelId && (
              <div className="flex gap-2 flex-wrap items-end rounded-md border border-ui-tag-green-border bg-ui-tag-green-bg px-3 py-2">
                <div className="flex-1 min-w-[200px]">
                  <Text size="xsmall" className="text-ui-fg-subtle uppercase tracking-wide">
                    ✓ Canal detectado · ID
                  </Text>
                  <code className="text-xs font-mono text-ui-fg-base break-all">
                    {channelId}
                  </code>
                </div>
                <input
                  type="text"
                  placeholder="Nombre amigable"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={adding}
                  className="text-sm bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 flex-1 min-w-[160px]"
                />
                <Button size="small" onClick={add} disabled={adding}>
                  {adding ? "…" : "Agregar"}
                </Button>
              </div>
            )}
          </div>

          {/* List */}
          {subs.length > 0 && (
            <ul className="flex flex-col gap-1">
              {subs.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded border border-ui-border-base px-3 py-1.5 bg-ui-bg-base"
                >
                  <span aria-hidden>{s.active ? "▶" : "⏸"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.label}</div>
                    <div className="flex items-center gap-2 text-xs text-ui-fg-muted">
                      <span className="font-mono">{s.source_id}</span>
                      {s.last_fetched_at && (
                        <span>· última fetch {relTime(s.last_fetched_at)}</span>
                      )}
                      {s.fetch_error_count > 0 && (
                        <span className="text-ui-tag-red-text">
                          · {s.fetch_error_count} errores
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(s)}
                    className="text-xs text-ui-fg-subtle hover:text-ui-fg-base"
                    title={s.active ? "Pausar" : "Reanudar"}
                  >
                    {s.active ? "Pausar" : "Reanudar"}
                  </button>
                  <button
                    onClick={() => remove(s)}
                    className="text-ui-fg-subtle hover:text-ui-fg-error text-sm"
                    aria-label="Quitar canal"
                    title="Quitar"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Container>
  )
}
