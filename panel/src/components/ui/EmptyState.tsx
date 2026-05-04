import Link from "next/link"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  /** Icono lucide-react contextual al dominio (ej. ShoppingBag para orders vacío). */
  icon: LucideIcon
  /** Título corto, action-oriented. Ej: "Aún no hay recordings". */
  title: string
  /** Descripción opcional explicando POR QUÉ está vacío + qué falta. */
  description?: React.ReactNode
  /** CTA opcional — link interno o externo, o un button con onClick. */
  action?:
    | { kind: "link"; label: string; href: string; external?: boolean }
    | { kind: "button"; label: string; onClick: () => void }
  /** Variante visual: "muted" (gris discreto, default) o "warning" (naranja, llama atención). */
  tone?: "muted" | "warning"
  /** Padding wrapper. Default `p-10`. Pasale `p-6` en cards chicas. */
  padding?: string
}

/**
 * Empty state estandarizado.
 *
 * Reglas de diseño:
 *   - Siempre explicá la razón probable (no sólo "sin datos")
 *   - Si hay un CTA accionable (configurar algo, abrir un docs), mostralo
 *   - Tone "warning" sólo cuando el vacío es síntoma de un bug/setup faltante
 *
 * Ejemplo:
 *   <EmptyState
 *     icon={Video}
 *     title="Aún no hay recordings"
 *     description={<>PostHog necesita ≥5s de sesión válida. <a href="/dashboard">Configuralo</a>.</>}
 *     tone="warning"
 *     action={{ kind: "link", label: "Ver docs", href: "https://posthog.com/docs/session-recording" }}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "muted",
  padding = "p-10",
}: EmptyStateProps) {
  const wrapperBg = tone === "warning" ? "bg-orange/5" : ""
  const wrapperBorder = tone === "warning" ? { borderColor: "#FF3B27" } : undefined
  const iconColor = tone === "warning" ? "text-orange" : "text-ink-3"
  const titleColor = tone === "warning" ? "text-orange" : "text-ink-3"

  return (
    <div className={`stamp-card ${padding} text-center ${wrapperBg}`} style={wrapperBorder}>
      <Icon size={48} className={`${iconColor} mx-auto mb-3`} strokeWidth={1.5} />
      <p
        className={`font-display font-bold text-[14px] uppercase tracking-wider ${titleColor}`}
      >
        {title}
      </p>
      {description && (
        <div className="text-[12px] text-ink-3 mt-2 max-w-md mx-auto leading-relaxed">
          {description}
        </div>
      )}
      {action && (
        <div className="mt-4">
          {action.kind === "link" ? (
            <Link
              href={action.href}
              {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
