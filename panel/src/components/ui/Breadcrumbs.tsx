import Link from "next/link"
import { ChevronRight } from "lucide-react"

export interface BreadcrumbItem {
  label: string
  /** Si se omite, el item es "current" (no clickable, sin link). */
  href?: string
}

/**
 * Breadcrumbs minimalistas para páginas con depth ≥ 2.
 *
 * Ejemplo:
 *   <Breadcrumbs items={[
 *     { label: "Marketing", href: "/marketing" },
 *     { label: "User 360", href: "/marketing/user360" },
 *     { label: customer.email },
 *   ]} />
 *
 * Rendering: pequeño, gris, sobre el PageHeader. No interfiere con la jerarquía
 * tipográfica del título principal.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider text-ink-3">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-orange transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-ink" : ""}>{item.label}</span>
              )}
              {!isLast && <ChevronRight size={10} className="text-ink-3/50" strokeWidth={2.5} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
