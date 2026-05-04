"use client"

import { Search, Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBell } from "./NotificationBell"
import { TopBarLiveKpis } from "./TopBarLiveKpis"

/** Mapa de pathname → breadcrumb structure (label + parent). */
const crumbMap: Record<string, { label: string; parent?: string }> = {
  "/dashboard":       { label: "Hoy" },
  "/reports":         { label: "KPIs" },
  "/activity":        { label: "Bitácora" },
  "/orders":          { label: "Pedidos" },
  "/products":        { label: "Productos" },
  "/catalog":         { label: "Categorías" },
  "/inventory":       { label: "Inventario" },
  "/customers":       { label: "Clientes" },
  "/customer-groups": { label: "Grupos" },
  "/finanzas":        { label: "Finanzas" },
  "/marketing":       { label: "Marketing" },
  "/loyalty":         { label: "Loyalty" },
  "/social":          { label: "Social" },
  "/webmail":         { label: "Webmail" },
  "/locations":       { label: "Ubicaciones" },
  "/shipping":        { label: "Envíos" },
  "/returns":         { label: "Devoluciones" },
  "/settings":        { label: "Configuración" },
}

interface Crumb {
  label: string
  href?: string
  mono?: boolean
}

function buildBreadcrumbs(pathname: string): Crumb[] {
  // /orders/abc123 → [{label: "Pedidos", href: "/orders"}, {label: "#abc123", mono: true}]
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "Dashboard" }]
  const root = `/${segments[0]}`
  const rootMeta = crumbMap[root]
  if (!rootMeta) return [{ label: segments[0] }]
  if (segments.length === 1) return [{ label: rootMeta.label }]
  return [
    { label: rootMeta.label, href: root },
    { label: `#${segments[1]}`, mono: true },
  ]
}

export function TopBar() {
  const pathname = usePathname()
  const crumbs = buildBreadcrumbs(pathname)
  const today = new Date().toLocaleDateString("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).toUpperCase().replace(/\./g, "")

  return (
    <header
      className="h-[60px] flex items-center px-4 md:px-7 sticky top-0 z-10 gap-3"
      style={{ background: "rgb(var(--page))", borderBottom: "2px solid var(--border)" }}
    >
      {/* Hamburger (mobile only) */}
      <button
        type="button"
        data-mobile-toggle
        onClick={() => window.dispatchEvent(new CustomEvent("panel:toggle-mobile-sidebar"))}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0"
        style={{ background: "rgb(var(--surface))", border: "1.5px solid var(--border)", boxShadow: "2px 2px 0 0 var(--shadow-color)" }}
        aria-label="Abrir menú"
      >
        <Menu size={16} strokeWidth={2.4} />
      </button>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[13px] min-w-0 truncate">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          const className = `font-display font-bold uppercase tracking-wider ${
            c.mono ? "font-mono text-orange" : isLast ? "text-ink" : "text-ink-3"
          }`
          return (
            <span key={i} className="flex items-center gap-2">
              {c.href && !isLast ? (
                <Link href={c.href} className={`${className} hover:text-ink`}>{c.label}</Link>
              ) : (
                <span className={className}>{c.label}</span>
              )}
              {!isLast && <span className="text-warm-300 font-bold">/</span>}
            </span>
          )
        })}
      </div>

      {/* Search trigger (Cmd+K) — dispara CommandPalette via keyboard event */}
      <button
        className="hidden md:flex ml-10 items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
        style={{
          background: "rgb(var(--surface))",
          border: "1.5px solid var(--border)",
          color: "rgb(var(--ink-3))",
          boxShadow: "2px 2px 0 0 var(--shadow-color)",
          minWidth: 320,
        }}
        type="button"
        onClick={() => {
          // Dispatch keyboard event que la palette escucha
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
        }}
      >
        <Search size={14} strokeWidth={2} />
        <span className="font-medium">Buscar comandos, páginas…</span>
        <span className="ml-auto flex items-center gap-0.5">
          <kbd
            className="px-1 py-0 rounded-md text-[10px] font-mono font-bold"
            style={{ background: "rgb(var(--page))", border: "1px solid var(--border-soft)" }}
          >
            ⌘
          </kbd>
          <kbd
            className="px-1 py-0 rounded-md text-[10px] font-mono font-bold"
            style={{ background: "rgb(var(--page))", border: "1px solid var(--border-soft)" }}
          >
            K
          </kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Live KPIs (clickable → /orders/live) */}
        <TopBarLiveKpis />

        {/* Date stamp */}
        <div
          className="vintage-stamp text-secondary mr-2 hidden lg:inline-flex"
          style={{ background: "rgb(var(--surface))" }}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          {today}
        </div>

        {/* Theme toggle compact (cycle light/dark/system) */}
        <div
          className="hidden md:flex items-center"
          style={{ border: "1px solid var(--border-soft)", borderRadius: 6 }}
        >
          <CompactToggleWrapper />
        </div>

        {/* Notifications — polling cada 60s a /api/notifications */}
        <NotificationBell />
      </div>
    </header>
  )
}

/** Wrapper para usar ThemeToggle compact con tema apropiado en topbar.
 *  El componente original se diseñó para el sidebar dark — aquí en
 *  topbar (light en light mode), reescribimos los hovers/colors. */
function CompactToggleWrapper() {
  return (
    <div className="topbar-theme-toggle">
      <ThemeToggle compact />
      {/* Override del compact ThemeToggle que asume sidebar dark.
          En topbar queremos colores semánticos (ink-3 → ink en hover). */}
      <style>{`
        .topbar-theme-toggle button {
          color: rgb(var(--ink-3)) !important;
        }
        .topbar-theme-toggle button:hover {
          color: #FF3B27 !important;
          background: rgb(var(--surface-2)) !important;
        }
      `}</style>
    </div>
  )
}
