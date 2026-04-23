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
import type { SocialPost, SocialStory } from "./types"

const API = ""  // same-origin; Medusa admin is served alongside /admin API

type Tab = "lista" | "calendario" | "kanban"

export default function SocialPage() {
  const [tab, setTab] = useState<Tab>("lista")
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [stories, setStories] = useState<SocialStory[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [postsRes, storiesRes] = await Promise.all([
        fetch(`${API}/admin/social/posts`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/admin/social/stories`, { credentials: "include" }).then((r) => r.json()),
      ])
      setPosts(postsRes.posts ?? [])
      setStories(storiesRes.stories ?? [])
    } catch (e) {
      toast.error("Error cargando contenido", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
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
        <div className="flex gap-2 items-center">
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
        {(["lista", "calendario", "kanban"] as Tab[]).map((t) => (
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
            <ListaView posts={posts} stories={stories} onRefresh={loadAll} />
          )}
          {tab === "calendario" && (
            <CalendarView posts={posts} stories={stories} onUpdate={loadAll} />
          )}
          {tab === "kanban" && <KanbanView posts={posts} onUpdate={loadAll} />}
        </>
      )}
    </Container>
  )
}

// ─── Lista view ────────────────────────────────────────────────────
function ListaView({
  posts,
  stories,
  onRefresh,
}: {
  posts: SocialPost[]
  stories: SocialStory[]
  onRefresh: () => void
}) {
  // Group stories by date
  const storiesByDate = useMemo(() => {
    const map: Record<string, SocialStory[]> = {}
    for (const s of stories) {
      ;(map[s.date] = map[s.date] ?? []).push(s)
    }
    for (const date of Object.keys(map)) {
      map[date].sort((a, b) => a.slot - b.slot)
    }
    return map
  }, [stories])

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

  return (
    <div className="flex flex-col gap-10">
      {/* Posts section */}
      <section>
        <Heading level="h2" className="mb-4">
          Posts · {posts.length}
        </Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onChange={onRefresh} />
          ))}
        </div>
      </section>

      {/* Stories section */}
      <section>
        <Heading level="h2" className="mb-4">
          Stories · {stories.length}
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
    </div>
  )
}

// ─── Sidebar config ───────────────────────────────────────────────
export const config = defineRouteConfig({
  label: "Social",
  icon: Photo,
})
