/**
 * Job registry — canonical list of all scheduled jobs in the backend.
 *
 * Used by the DEV dashboard to show:
 *   - which jobs SHOULD be running (even if never executed yet)
 *   - human-readable name + description + category
 *   - expected schedule for "last run > N × interval" stale detection
 *
 * Keep in sync with `backend/src/jobs/*.ts` config exports.
 */

export type JobCategory = "seo" | "remarketing" | "whatsapp" | "telegram" | "system"

export type JobRegistryEntry = {
  name: string
  schedule: string // cron expression
  description: string
  category: JobCategory
  /** If the job is feature-gated (e.g. SEO_SYNC_ENABLED), list the env var here */
  gatedBy?: string
}

export const JOB_REGISTRY: JobRegistryEntry[] = [
  // ─── SEO Analytics ──────────────────────────────────────────────────
  { name: "seo-gsc-sync", schedule: "0 3 * * *", description: "Sync últimos 3 días de Google Search Console", category: "seo", gatedBy: "SEO_SYNC_ENABLED" },
  { name: "seo-ga4-sync", schedule: "15 3 * * *", description: "Sync últimos 3 días de Google Analytics 4", category: "seo", gatedBy: "SEO_SYNC_ENABLED" },
  { name: "seo-cwv-sync", schedule: "0 4 * * *", description: "Sync Core Web Vitals (CrUX) de URLs clave", category: "seo", gatedBy: "SEO_SYNC_ENABLED" },
  { name: "seo-sitemap-check", schedule: "30 4 * * *", description: "Parse sitemap.xml + guardar snapshot", category: "seo", gatedBy: "SEO_SYNC_ENABLED" },
  { name: "seo-alerts-compute", schedule: "0 * * * *", description: "Ejecutar 6 reglas de alertas SEO", category: "seo", gatedBy: "SEO_SYNC_ENABLED" },
  { name: "seo-monthly-snapshot", schedule: "0 7 * * *", description: "Recalcular snapshot mensual SEO (mes actual + mes anterior)", category: "seo", gatedBy: "SEO_SYNC_ENABLED" },
  // ─── Remarketing ─────────────────────────────────────────────────────
  { name: "abandoned-cart", schedule: "0 */2 * * *", description: "Detectar carritos abandonados + enviar email", category: "remarketing" },
  { name: "birthday-emails", schedule: "0 9 * * *", description: "Email de cumpleaños a clientes", category: "remarketing" },
  { name: "graduation", schedule: "0 10 * * *", description: "Graduar clientes manuales a compradores web", category: "remarketing" },
  { name: "pending-payment", schedule: "0 * * * *", description: "Recordatorio de pago pendiente (cada hora)", category: "remarketing" },
  { name: "post-purchase", schedule: "0 11 * * *", description: "Follow-up post-compra", category: "remarketing" },
  { name: "restock", schedule: "0 12 * * *", description: "Recordatorio de reposición a clientes recurrentes", category: "remarketing" },
  { name: "stockout-alert", schedule: "30 9 * * *", description: "Alerta preventiva de stockout a cohorte de compradores", category: "remarketing" },
  { name: "win-back", schedule: "0 10 * * 1", description: "Campaña semanal de recuperación (Lunes)", category: "remarketing" },
  // ─── WhatsApp ────────────────────────────────────────────────────────
  { name: "whatsapp-session-cleanup", schedule: "*/5 * * * *", description: "Cerrar sesiones WhatsApp inactivas (cada 5 min)", category: "whatsapp" },
]

export function findJobInRegistry(name: string): JobRegistryEntry | undefined {
  return JOB_REGISTRY.find((j) => j.name === name)
}
