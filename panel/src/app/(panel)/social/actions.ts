"use server"

import { revalidatePath } from "next/cache"
import {
  approveSocialPost, rejectSocialPost, deleteSocialPost,
  publishSocialEntity, cancelSocialSchedule,
  createSocialPost, updateSocialPost,
  createSocialFeedback, updateSocialFeedback, deleteSocialFeedback,
  syncSocial,
  refreshSocialTrends,
  createSocialSuggestion, updateSocialSuggestion, deleteSocialSuggestion,
  promoteSocialSuggestion, importSuggestionsFromTrends,
  createTrendSubscription, updateTrendSubscription, deleteTrendSubscription,
  MedusaError,
} from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    if (e.status === 404) return "Endpoint social no implementado en el backend"
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

/**
 * Publica AHORA via Buffer (sin programar a futuro).
 * Backend POST /admin/social/publish/:id con entity y sin `when`.
 */
export async function publishPostAction(id: string): Promise<ActionResult> {
  try {
    await publishSocialEntity(id, { entity: "post" })
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/**
 * Programa la publicación a futuro via Buffer.
 *  - scheduledFor: ISO8601
 * Backend POST /admin/social/publish/:id con `when` futuro.
 */
export async function schedulePostAction(id: string, scheduledFor: string): Promise<ActionResult> {
  try {
    if (!scheduledFor) return { ok: false, error: "Selecciona fecha y hora" }
    const when = new Date(scheduledFor).toISOString()
    if (new Date(when).getTime() <= Date.now()) {
      return { ok: false, error: "La fecha debe ser en el futuro" }
    }
    await publishSocialEntity(id, { entity: "post", when })
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/** Cancela un envío programado, vuelve a status approved. */
export async function cancelSchedulePostAction(id: string): Promise<ActionResult> {
  try {
    await cancelSocialSchedule(id, "post")
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function approvePostAction(id: string): Promise<ActionResult> {
  try {
    await approveSocialPost(id)
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function rejectPostAction(id: string): Promise<ActionResult> {
  try {
    await rejectSocialPost(id)
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deletePostAction(id: string): Promise<ActionResult> {
  try {
    await deleteSocialPost(id)
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── Feedback (threaded comments + timestamp anchored para video) ────

export async function createFeedbackAction(input: {
  entity_type: "post" | "story"
  entity_id: string
  text: string
  parent_id?: string
  timestamp_ms?: number
}): Promise<ActionResult & { id?: string }> {
  try {
    if (!input.text.trim()) return { ok: false, error: "Comentario vacío" }
    const res = await createSocialFeedback({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      text: input.text.trim(),
      parent_id: input.parent_id ?? null,
      timestamp_ms: input.timestamp_ms ?? null,
    })
    revalidatePath("/social")
    return { ok: true, id: res.feedback.id }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function resolveFeedbackAction(id: string, resolved: boolean): Promise<ActionResult> {
  try {
    await updateSocialFeedback(id, { resolved })
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteFeedbackAction(id: string): Promise<ActionResult> {
  try {
    await deleteSocialFeedback(id)
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function createPostAction(input: {
  channel: string
  title: string
  content?: string
  date_planned?: string
  status?: string
  media_urls?: string[]
  metadata?: Record<string, unknown>
}): Promise<ActionResult> {
  try {
    if (!input.channel.trim()) return { ok: false, error: "Canal requerido" }
    if (!input.title.trim()) return { ok: false, error: "Título requerido" }
    await createSocialPost({
      channel: input.channel.trim(),
      title: input.title.trim(),
      content: input.content?.trim() || undefined,
      date_planned: input.date_planned || undefined,
      status: input.status ?? "draft",
      media_urls: input.media_urls,
      metadata: input.metadata,
    })
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/** Multi-channel cross-post: crea un post por cada canal seleccionado. */
export async function crossPostAction(input: {
  channels: string[]
  title: string
  content?: string
  date_planned?: string
  status?: string
  media_urls?: string[]
  metadata?: Record<string, unknown>
}): Promise<{ ok: true; created: number; failed: Array<{ channel: string; error: string }> } | { ok: false; error: string }> {
  if (!input.channels.length) return { ok: false, error: "Selecciona al menos un canal" }
  if (!input.title.trim()) return { ok: false, error: "Título requerido" }

  const results = await Promise.allSettled(
    input.channels.map((ch) =>
      createSocialPost({
        channel: ch,
        title: input.title.trim(),
        content: input.content?.trim() || undefined,
        date_planned: input.date_planned || undefined,
        status: input.status ?? "draft",
        media_urls: input.media_urls,
        metadata: input.metadata,
      }),
    ),
  )

  const failed: Array<{ channel: string; error: string }> = []
  let created = 0
  results.forEach((r, i) => {
    if (r.status === "fulfilled") created += 1
    else failed.push({ channel: input.channels[i], error: toError(r.reason) })
  })

  revalidatePath("/social")
  return { ok: true, created, failed }
}

/** Update parcial de un post — usado por inline edit + drag&drop. */
export async function updatePostAction(id: string, body: Partial<{
  channel: string
  title: string
  content: string
  date_planned: string
  status: string
  media_urls: string[]
  metadata: Record<string, unknown>
}>): Promise<ActionResult> {
  try {
    await updateSocialPost(id, body)
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/** Reagendar un post (drag&drop entre días del calendario). */
export async function reschedulePostAction(id: string, newDate: string): Promise<ActionResult> {
  try {
    if (!newDate) return { ok: false, error: "Fecha inválida" }
    await updateSocialPost(id, { date_planned: newDate })
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/** Registra métricas de un post (manual). Se guarda en metadata.metrics. */
export async function recordPostMetricsAction(id: string, metrics: {
  reach?: number
  likes?: number
  comments?: number
  saves?: number
  shares?: number
}): Promise<ActionResult> {
  try {
    // Storage en metadata para no requerir backend nuevo
    await updateSocialPost(id, {
      metadata: { metrics: { ...metrics, recorded_at: new Date().toISOString() } },
    })
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/** Comment en el thread de aprobación (se acumula en metadata.comments). */
export async function addPostCommentAction(id: string, text: string, author: string, existingMeta?: Record<string, unknown>): Promise<ActionResult> {
  try {
    if (!text.trim()) return { ok: false, error: "Comentario vacío" }
    const prev = (existingMeta?.comments as Array<unknown>) ?? []
    const next = [
      ...prev,
      { id: `c_${Date.now()}`, text: text.trim(), author, at: new Date().toISOString() },
    ]
    await updateSocialPost(id, {
      metadata: { ...(existingMeta ?? {}), comments: next },
    })
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── Sync (refresca el contenido desde el pipeline storefront) ───────

export async function syncSocialAction(): Promise<
  { ok: true; posts: number; stories: number } | { ok: false; error: string }
> {
  try {
    const r = await syncSocial()
    revalidatePath("/social")
    return { ok: true, posts: r.posts_synced, stories: r.stories_synced }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── Trends ─────────────────────────────────────────────────────────

export async function refreshTrendsAction(includeBrief = true): Promise<
  { ok: true; upserted: number; brief: boolean } | { ok: false; error: string }
> {
  try {
    const r = await refreshSocialTrends({ brief: includeBrief })
    revalidatePath("/social")
    revalidatePath("/social/trends")
    return { ok: true, upserted: r.upserted, brief: r.brief_generated ?? false }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── Trend subscriptions ────────────────────────────────────────────

export async function addTrendSubscriptionAction(input: {
  kind: string
  source_id: string
  label: string
  active?: boolean
}): Promise<ActionResult> {
  try {
    if (!input.kind || !input.source_id || !input.label.trim()) {
      return { ok: false, error: "Kind, source_id y label son requeridos" }
    }
    await createTrendSubscription({
      kind: input.kind,
      source_id: input.source_id.trim(),
      label: input.label.trim(),
      active: input.active ?? true,
    })
    revalidatePath("/social")
    revalidatePath("/social/trends")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function toggleTrendSubscriptionAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await updateTrendSubscription(id, { active })
    revalidatePath("/social")
    revalidatePath("/social/trends")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteTrendSubscriptionAction(id: string): Promise<ActionResult> {
  try {
    await deleteTrendSubscription(id)
    revalidatePath("/social")
    revalidatePath("/social/trends")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── Suggestions ────────────────────────────────────────────────────

export async function createSuggestionAction(input: {
  kind?: "post" | "story"
  title: string
  body?: string
  pillar?: string
  format?: string
  suggested_date?: string
  source?: "manual" | "trend" | "feedback"
  source_ref?: string
}): Promise<ActionResult & { id?: string }> {
  try {
    if (!input.title.trim()) return { ok: false, error: "Título requerido" }
    const r = await createSocialSuggestion({
      kind: input.kind ?? "post",
      title: input.title.trim(),
      body: input.body?.trim(),
      pillar: input.pillar?.trim(),
      format: input.format,
      suggested_date: input.suggested_date,
      source: input.source ?? "manual",
      source_ref: input.source_ref,
    })
    revalidatePath("/social")
    return { ok: true, id: r.suggestion.id }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function updateSuggestionAction(id: string, input: Partial<{
  title: string
  body: string
  pillar: string
  format: string
  status: "idea" | "in_design" | "rejected" | "promoted"
  suggested_date: string | null
}>): Promise<ActionResult> {
  try {
    await updateSocialSuggestion(id, input)
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteSuggestionAction(id: string): Promise<ActionResult> {
  try {
    await deleteSocialSuggestion(id)
    revalidatePath("/social")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/** Convierte una sugerencia en social_post real (status=draft) */
export async function promoteSuggestionAction(id: string, overrides?: {
  title?: string
  caption?: string
  pillar?: string
  format?: "Single" | "Carrusel" | "Reel"
  date_planned?: string
}): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  try {
    const r = await promoteSocialSuggestion(id, overrides)
    revalidatePath("/social")
    return { ok: true, postId: r.post.id }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/** Importa themes + content_ideas del brief AI como suggestions */
export async function importFromTrendsAction(): Promise<
  { ok: true; imported: number; skipped: number; source: "brief" | "raw" } | { ok: false; error: string }
> {
  try {
    const r = await importSuggestionsFromTrends({ includeThemes: true, includeIdeas: true })
    revalidatePath("/social")
    return { ok: true, imported: r.imported, skipped: r.skipped, source: r.source }
  } catch (e) { return { ok: false, error: toError(e) } }
}
