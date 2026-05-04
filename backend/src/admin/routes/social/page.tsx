import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo } from "@medusajs/icons"
import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  toast,
} from "@medusajs/ui"
import { PostCard } from "./components/PostCard"
import { StoryCard } from "./components/StoryCard"
import { CalendarView } from "./components/CalendarView"
import { KanbanView } from "./components/KanbanView"
import { TrendsView } from "./components/TrendsView"
import { MonthStats } from "./components/MonthStats"
import { RetrospectiveWidget } from "./components/RetrospectiveWidget"
import { SuggestionsSection } from "./components/SuggestionsSection"
import { KeyboardShortcuts } from "./components/KeyboardShortcuts"
import { BufferQuotaBadge } from "./components/BufferQuotaBadge"
import { NotificationsBell } from "./components/NotificationsBell"
import type { SocialPost, SocialStory } from "./types"

// Absolute URL to the Medusa backend. The admin is served from enrola.shop/dashboard
// (via storefront proxy), so same-origin "/admin/..." fetches miss the auth cookie
// that lives on api.enrola.shop. Loyalty/SEO modules use the same pattern.
const API = "https://api.enrola.shop"

type Tab = "lista" | "calendario" | "kanban" | "trends"

export default function SocialPage() {
  const [tab, setTab] = useState<Tab>("lista")
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [stories, setStories] = useState<SocialStory[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  // Shared between ListaView and keyboard shortcuts
  const [showApproved, setShowApproved] = useState(false)

  /**
   * Handle a click on a notification's entity title — switch to Lista
   * (the card may not be rendered in Calendar/Kanban views), defer one
   * frame so the new tab DOM mounts, then scroll the matching card
   * into view and add a 2s highlight ring so the user spots it.
   *
   * If the post/story is filtered out (e.g. status=published while
   * the lista hides those), the user might also want `setShowApproved(true)`.
   * Erring on the side of toggling that on too — it's reversible and
   * the alternative (silent failure to find the card) is worse UX.
   */
  const focusCard = useCallback((_entityType: "post" | "story", entityId: string) => {
    setTab("lista")
    setShowApproved(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`card-${entityId}`)
        if (!el) return
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        el.classList.add("ring-4", "ring-ui-fg-interactive", "ring-offset-2", "transition-all")
        setTimeout(() => {
          el.classList.remove("ring-4", "ring-ui-fg-interactive", "ring-offset-2")
        }, 2400)
      })
    })
  }, [])

  /**
   * Load posts + stories.
   *
   * `silent=true` skips toggling the loading flag — used for background
   * refreshes triggered by inline saves (ScheduleInput / StoryLinkInput /
   * PublishControls / etc). Without this, every save unmounts ListaView
   * and the user's scroll position resets to the top of the page.
   *
   * On initial mount we want the spinner so the user knows we're fetching;
   * after a save we just want fresh data swapped in invisibly.
   */
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [postsRes, storiesRes] = await Promise.all([
        fetch(`${API}/admin/social/posts`, { credentials: "include", cache: "no-store" }).then((r) => r.json()),
        fetch(`${API}/admin/social/stories`, { credentials: "include", cache: "no-store" }).then((r) => r.json()),
      ])
      setPosts(postsRes.posts ?? [])
      setStories(storiesRes.stories ?? [])
    } catch (e) {
      toast.error("Error cargando contenido", { description: (e as Error).message })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Cards/inputs call this; pass `true` so we don't unmount the lista.
  const refreshSilent = useCallback(() => {
    void loadAll(true)
  }, [loadAll])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${API}/admin/social/sync`, {
        method: "POST",
        credentials: "include",
      }).then((r) => r.json())
      if (res.ok) {
        toast.success("Sync completado", {
          description: `${res.posts_synced} posts · ${res.stories_synced} stories`,
        })
        await loadAll()
      } else {
        toast.error("Sync falló", { description: res.error })
      }
    } catch (e) {
      toast.error("Error en sync", { description: (e as Error).message })
    } finally {
      setSyncing(false)
    }
  }

  const counts = useMemo(
    () => ({
      total: posts.length,
      drafts: posts.filter((p) => p.status === "draft").length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      published: posts.filter((p) => p.status === "published").length,
    }),
    [posts]
  )

  return (
    <Container className="p-6 flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Heading level="h1">Social · Enrola Shop</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Panel colaborativo para feedback, aprobación y programación.
          </Text>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <NotificationsBell onMentionClick={focusCard} />
          <BufferQuotaBadge />
          <Badge color="grey">{counts.total} posts</Badge>
          <Badge color="orange">{counts.drafts} draft</Badge>
          <Badge color="blue">{counts.scheduled} scheduled</Badge>
          <Badge color="green">{counts.published} published</Badge>
          <Button onClick={handleSync} disabled={syncing} variant="secondary">
            {syncing ? "Sincronizando…" : "Sync desde creación"}
          </Button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-ui-border-base">
        {(["lista", "calendario", "kanban", "trends"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-ui-fg-base text-ui-fg-base"
                : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      {loading ? (
        <Text className="text-ui-fg-subtle">Cargando…</Text>
      ) : (
        <>
          {tab === "lista" && (
            <ListaView
              posts={posts}
              stories={stories}
              onRefresh={refreshSilent}
              showApproved={showApproved}
              setShowApproved={setShowApproved}
            />
          )}
          {tab === "calendario" && (
            <CalendarView posts={posts} stories={stories} onUpdate={refreshSilent} />
          )}
          {tab === "kanban" && <KanbanView posts={posts} onUpdate={refreshSilent} />}
          {tab === "trends" && <TrendsView />}
        </>
      )}

      {/* Global keyboard layer */}
      <KeyboardShortcuts
        onTab={setTab}
        onSync={handleSync}
        onToggleApproved={() => setShowApproved((v) => !v)}
      />
    </Container>
  )
}

// ─── Lista view ────────────────────────────────────────────────────
function ListaView({
  posts,
  stories,
  onRefresh,
  showApproved,
  setShowApproved,
}: {
  posts: SocialPost[]
  stories: SocialStory[]
  onRefresh: () => void
  showApproved: boolean
  setShowApproved: (v: boolean | ((prev: boolean) => boolean)) => void
}) {
  const [formatFilter, setFormatFilter] = useState<string | null>(null)
  const [pillarFilter, setPillarFilter] = useState<string | null>(null)
  // "all" = show both posts + stories (default).
  // "posts" = hide stories grid entirely.
  // "stories" = hide posts grid entirely.
  const [entityFilter, setEntityFilter] = useState<"all" | "posts" | "stories">("all")
  const [bulkApproving, setBulkApproving] = useState(false)

  const isPending = (s: SocialPost["status"]) => s === "draft" || s === "in_review"

  // All distinct pillars + formats for filter chip rendering
  const pillars = useMemo(
    () => Array.from(new Set(posts.map((p) => p.pillar).filter(Boolean))) as string[],
    [posts]
  )
  const formats = useMemo(
    () => Array.from(new Set(posts.map((p) => p.format).filter(Boolean))),
    [posts]
  )

  // Items that should never appear in the active workflow lista —
  // already done (published) or terminally errored (failed). They live in
  // the kanban / calendar so we don't lose them; the lista is for stuff
  // pending action.
  const isDone = (s: SocialPost["status"]) => s === "published"

  const visiblePosts = useMemo(() => {
    if (entityFilter === "stories") return []
    let out = showApproved
      ? posts.filter((p) => !isDone(p.status))
      : posts.filter((p) => isPending(p.status))
    if (formatFilter) out = out.filter((p) => p.format === formatFilter)
    if (pillarFilter) out = out.filter((p) => p.pillar === pillarFilter)
    return out
  }, [posts, showApproved, formatFilter, pillarFilter, entityFilter])
  const visibleStories = useMemo(() => {
    if (entityFilter === "posts") return []
    // Stories don't have pillar/format — only pending toggle + format filter hides them all
    if (formatFilter || pillarFilter) return []
    return showApproved
      ? stories.filter((s) => !isDone(s.status))
      : stories.filter((s) => isPending(s.status))
  }, [stories, showApproved, formatFilter, pillarFilter, entityFilter])

  // Counts used by the "Aprobar todos" button — always counts across the
  // full dataset, ignoring filters so the label matches what the button does.
  const totalPendingPosts = useMemo(
    () => posts.filter((p) => isPending(p.status)).length,
    [posts]
  )
  const totalPendingStories = useMemo(
    () => stories.filter((s) => isPending(s.status)).length,
    [stories]
  )
  const totalPending = totalPendingPosts + totalPendingStories

  // "Desaprobar todos" applies to every post/story currently in a positive
  // state — approved, scheduled, publishing excluded (too late), published
  // excluded (IG already has it). So just approved + failed get reset.
  const isResetable = (s: SocialPost["status"]) => s === "approved" || s === "failed"
  const totalResetablePosts = useMemo(
    () => posts.filter((p) => isResetable(p.status)).length,
    [posts]
  )
  const totalResetableStories = useMemo(
    () => stories.filter((s) => isResetable(s.status)).length,
    [stories]
  )
  const totalResetable = totalResetablePosts + totalResetableStories

  // "Programar hoy" — fires the same logic as the daily cron (runs at 06:00
  // VE automatically). This is the on-demand button for when the user wants
  // to kick it manually instead of waiting. Delegates to a single backend
  // call which handles the 10-item cap + failures itself.
  const todayVe = useMemo(() => {
    const now = new Date()
    const ve = new Date(now.getTime() - 4 * 3600 * 1000)
    return `${ve.getUTCFullYear()}-${String(ve.getUTCMonth() + 1).padStart(2, "0")}-${String(ve.getUTCDate()).padStart(2, "0")}`
  }, [])

  const approvedForToday = useMemo(() => {
    const start = new Date(`${todayVe}T04:00:00.000Z`).getTime()  // VE midnight in UTC
    const end = start + 24 * 3600 * 1000
    const postsToday = posts.filter(
      (p) =>
        p.status === "approved" &&
        p.scheduled_at &&
        new Date(p.scheduled_at).getTime() >= start &&
        new Date(p.scheduled_at).getTime() < end
    )
    const storiesToday = stories.filter(
      (s) =>
        s.status === "approved" &&
        s.scheduled_at &&
        new Date(s.scheduled_at).getTime() >= start &&
        new Date(s.scheduled_at).getTime() < end
    )
    return postsToday.length + storiesToday.length
  }, [posts, stories, todayVe])

  const [scheduling, setScheduling] = useState(false)
  const scheduleToday = async () => {
    if (approvedForToday === 0) {
      toast.info("No hay aprobados para hoy")
      return
    }
    if (
      !confirm(
        `¿Programar en Buffer los ${approvedForToday} aprobados de hoy (VE)? ` +
          `Máximo 10 por día (Free plan). Los posts del resto del mes se programan automáticamente ` +
          `cada día a las 06:00 VE.`
      )
    ) return

    setScheduling(true)
    try {
      const res = await fetch(`${API}/admin/social/schedule-today`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayVe, limit: 10 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)

      const { scheduled, failed, deferred } = data as {
        scheduled: number
        failed: Array<{ id: string; reason: string }>
        deferred: string[]
      }
      if (failed.length === 0) {
        toast.success(
          `${scheduled} programados en Buffer` +
            (deferred.length ? ` · ${deferred.length} diferidos al día siguiente` : "")
        )
      } else {
        toast.error(`${scheduled} ok · ${failed.length} fallaron`, {
          description: failed.slice(0, 2).map((f) => `${f.id}: ${f.reason}`).join(" · "),
          duration: 12000,
        })
        console.warn("[schedule-today] failures:", failed)
      }
      onRefresh()
    } catch (e) {
      toast.error("No se pudo programar hoy", { description: (e as Error).message })
    } finally {
      setScheduling(false)
    }
  }

  const unapproveAll = async () => {
    if (totalResetable === 0) {
      toast.info("No hay nada aprobado para reabrir")
      return
    }
    if (
      !confirm(
        `¿Reabrir TODOS los aprobados? ${totalResetablePosts} posts + ${totalResetableStories} stories vuelven a borrador.` +
          ` Los que ya están Programados requieren cancelar la programación primero (un click por card).`
      )
    ) return

    setBulkApproving(true)
    try {
      const pendingPosts = posts.filter((p) => isResetable(p.status))
      const pendingStories = stories.filter((s) => isResetable(s.status))
      await Promise.all([
        ...pendingPosts.map((p) =>
          fetch(`${API}/admin/social/posts/${p.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "draft" }),
          })
        ),
        ...pendingStories.map((s) =>
          fetch(`${API}/admin/social/stories/${s.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "draft" }),
          })
        ),
      ])
      toast.success(`${totalResetable} reabiertos`)
      onRefresh()
    } catch (e) {
      toast.error("Falló el unapprove all", { description: (e as Error).message })
    } finally {
      setBulkApproving(false)
    }
  }

  /**
   * Approve every pending post + story in the dataset (draft / in_review).
   * Deliberately ignores the currently-active filter chips — "aprobar todos"
   * means all, otherwise the button's label would be a lie.
   */
  const approveAll = async () => {
    if (totalPending === 0) {
      toast.info("No hay nada pendiente")
      return
    }
    if (
      !confirm(
        `¿Aprobar TODOS los pendientes? ${totalPendingPosts} posts + ${totalPendingStories} stories. ` +
          `Se puede deshacer uno por uno con el botón "↺ Reabrir" de cada card.`
      )
    ) return

    setBulkApproving(true)
    try {
      const pendingPosts = posts.filter((p) => isPending(p.status))
      const pendingStories = stories.filter((s) => isPending(s.status))
      await Promise.all([
        ...pendingPosts.map((p) =>
          fetch(`${API}/admin/social/posts/${p.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "approved" }),
          })
        ),
        ...pendingStories.map((s) =>
          fetch(`${API}/admin/social/stories/${s.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "approved" }),
          })
        ),
      ])
      toast.success(`${totalPending} aprobados`)
      onRefresh()
    } catch (e) {
      toast.error("Falló el approve all", { description: (e as Error).message })
    } finally {
      setBulkApproving(false)
    }
  }

  const exportCsv = () => {
    const rows: string[][] = [[
      "type", "number", "title", "format", "pillar", "date_label",
      "status", "scheduled_at", "link", "caption",
    ]]
    for (const p of posts) {
      rows.push([
        "post", p.number, p.title, p.format, p.pillar ?? "",
        p.date_label ?? "", p.status, p.scheduled_at ?? "",
        "", (p.caption ?? "").replace(/\n/g, " ⏎ "),
      ])
    }
    for (const s of stories) {
      rows.push([
        "story", String(s.slot), s.type, "story", "",
        s.date, s.status, s.scheduled_at ?? "",
        s.link_url ?? "", "",
      ])
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `enrola-social-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const approvedPostsCount = posts.length - posts.filter((p) => isPending(p.status)).length
  const approvedStoriesCount =
    stories.length - stories.filter((s) => isPending(s.status)).length

  // Group stories by date
  const storiesByDate = useMemo(() => {
    const map: Record<string, SocialStory[]> = {}
    for (const s of visibleStories) {
      ;(map[s.date] = map[s.date] ?? []).push(s)
    }
    for (const date of Object.keys(map)) {
      map[date].sort((a, b) => a.slot - b.slot)
    }
    return map
  }, [visibleStories])

  const storyDates = useMemo(() => Object.keys(storiesByDate).sort(), [storiesByDate])

  if (posts.length === 0 && stories.length === 0) {
    return (
      <Container className="p-8 text-center">
        <Heading level="h3">Todavía no hay contenido</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          Ejecutá <strong>Sync desde creación</strong> arriba para importar el calendario del mes.
        </Text>
      </Container>
    )
  }

  const totalApproved = approvedPostsCount + approvedStoriesCount
  const allApprovedAndHidden = visiblePosts.length === 0 && visibleStories.length === 0

  return (
    <div className="flex flex-col gap-6">
      {/* Month stats — dashboard-at-a-glance */}
      <MonthStats posts={posts} stories={stories} />

      {/* Retrospective — what did we publish vs what the brief suggested */}
      <RetrospectiveWidget posts={posts} />

      {/* Suggestions — new content ideas before they become real posts.
          The section has its own internal collapse toggle (default collapsed)
          following the same pattern as RetrospectiveWidget below. */}
      <SuggestionsSection onPromoted={onRefresh} />

      {/* Filters + bulk actions toolbar */}
      <div className="flex flex-col gap-2 -mt-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Text size="small" className="text-ui-fg-subtle">
            Mostrando <strong>{visiblePosts.length}</strong> posts ·{" "}
            <strong>{visibleStories.length}</strong> stories
            {totalApproved > 0 && !showApproved && (
              <> · <span className="text-ui-fg-muted">{totalApproved} aprobados ocultos</span></>
            )}
          </Text>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="small"
              onClick={() => {
                // Stream the server-rendered markdown to a file download.
                // Using an anchor + fetch keeps credentials="include".
                fetch(`${API}/admin/social/export-brief`, {
                  credentials: "include",
                })
                  .then((r) => r.blob())
                  .then((blob) => {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `enrola-social-brief-${new Date()
                      .toISOString()
                      .slice(0, 10)}.md`
                    a.click()
                    URL.revokeObjectURL(url)
                  })
                  .catch((e) =>
                    toast.error("No se pudo exportar", {
                      description: (e as Error).message,
                    })
                  )
              }}
            >
              📨 Exportar para Claude
            </Button>
            <Button size="small" variant="secondary" onClick={exportCsv}>
              📤 Exportar CSV
            </Button>
            <Button
              size="small"
              disabled={bulkApproving || totalPending === 0}
              onClick={approveAll}
              title={totalPending === 0 ? "No hay pendientes" : "Aprobar los 100 % pendientes"}
            >
              {bulkApproving ? "…" : `✓ Aprobar todos (${totalPending})`}
            </Button>
            <Button
              size="small"
              disabled={scheduling || approvedForToday === 0}
              onClick={scheduleToday}
              title={
                approvedForToday === 0
                  ? "Ningún aprobado para hoy"
                  : "Manda a Buffer los aprobados de hoy (respeta el límite del plan)"
              }
            >
              {scheduling ? "Programando…" : `🗓 Programar hoy (${approvedForToday})`}
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={bulkApproving || totalResetable === 0}
              onClick={unapproveAll}
              title={
                totalResetable === 0
                  ? "Nada aprobado para reabrir"
                  : "Reabre aprobados y fallidos · no toca los ya programados"
              }
            >
              {bulkApproving ? "…" : `↺ Desaprobar todos (${totalResetable})`}
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setShowApproved((v) => !v)}
            >
              {showApproved ? "Ocultar aprobados" : "Mostrar aprobados"}
            </Button>
          </div>
        </div>

        {/* Entity scope toggle — Todo / Posts / Stories */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide shrink-0">
            Mostrar:
          </Text>
          {(["all", "posts", "stories"] as const).map((k) => (
            <FilterChip
              key={`e-${k}`}
              label={k === "all" ? "Todo" : k === "posts" ? "Solo posts" : "Solo stories"}
              active={entityFilter === k}
              onClick={() => setEntityFilter(k)}
            />
          ))}
        </div>

        {/* Filter chips */}
        {(formats.length > 0 || pillars.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide shrink-0">
              Filtrar:
            </Text>
            {formats.map((f) => (
              <FilterChip
                key={`f-${f}`}
                label={f}
                active={formatFilter === f}
                onClick={() => setFormatFilter(formatFilter === f ? null : f)}
              />
            ))}
            {pillars.length > 0 && <span className="mx-1 h-4 w-px bg-ui-border-base" />}
            {pillars.map((p) => (
              <FilterChip
                key={`p-${p}`}
                label={p}
                active={pillarFilter === p}
                onClick={() => setPillarFilter(pillarFilter === p ? null : p)}
              />
            ))}
            {(formatFilter || pillarFilter) && (
              <button
                onClick={() => { setFormatFilter(null); setPillarFilter(null) }}
                className="text-xs text-ui-fg-interactive hover:underline ml-1"
              >
                limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {allApprovedAndHidden ? (
        <Container className="p-8 text-center">
          <Heading level="h3">¡Todo aprobado!</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            No queda contenido pendiente. Tocá <strong>Mostrar aprobados</strong> para verlo.
          </Text>
        </Container>
      ) : (
        <>
          {/* Posts section */}
          {visiblePosts.length > 0 && (
            <section>
              <Heading level="h2" className="mb-4">
                Posts · {visiblePosts.length}
              </Heading>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {visiblePosts.map((p) => (
                  <PostCard key={p.id} post={p} onChange={onRefresh} />
                ))}
              </div>
            </section>
          )}

          {/* Stories section */}
          {visibleStories.length > 0 && (
            <section>
              <Heading level="h2" className="mb-4">
                Stories · {visibleStories.length}
              </Heading>
              <div className="flex flex-col gap-6">
                {storyDates.map((date) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-2">
                      <Text weight="plus" size="small">
                        {date}
                      </Text>
                      <Badge size="2xsmall" color="grey">
                        {storiesByDate[date].length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {storiesByDate[date].map((s) => (
                        <StoryCard key={s.id} story={s} onChange={onRefresh} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ─── Filter chip atom (shared within ListaView) ──────────────────
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
        active
          ? "bg-ui-bg-component border-ui-fg-base text-ui-fg-on-inverted"
          : "bg-ui-bg-subtle border-ui-border-base text-ui-fg-subtle hover:text-ui-fg-base"
      }`}
    >
      {label}
    </button>
  )
}

// ─── Sidebar config ───────────────────────────────────────────────
export const config = defineRouteConfig({
  label: "Social",
  icon: Photo,
})
