"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutGrid, ShoppingBag, Package, Layers, Users, Tag, Activity, BarChart3,
  Coins, Megaphone, Star, Calendar, Mail, Settings,
  ChevronDown, LogOut, ExternalLink, MapPin, Truck, Undo2,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./ThemeToggle"
import { BcvTicker } from "./BcvTicker"

interface SidebarUser {
  email: string
  name?: string | null
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  badge?: { count: number; tone: "orange" | "primary" }
}

interface NavSection {
  title: string
  /** Sub-divisor opcional dentro de la sección — partís items en grupos visuales. */
  items: NavItem[]
  subgroups?: Array<{ title?: string; items: NavItem[] }>
}

const STORAGE_KEY = "panel_sidebar_collapsed"

function buildSections(badges?: SidebarBadges): NavSection[] {
  const productsBadge = badges?.draftProducts ? { count: badges.draftProducts, tone: "orange" as const } : undefined
  const inventoryBadge = badges?.lowStockItems ? { count: badges.lowStockItems, tone: "primary" as const } : undefined
  const socialBadge = badges?.postsInReview ? { count: badges.postsInReview, tone: "orange" as const } : undefined
  const ordersTotal = (badges?.pendingOrders ?? 0) + (badges?.pendingReturns ?? 0)
  const ordersBadgeMerged = ordersTotal > 0
    ? { count: ordersTotal, tone: (badges?.pendingReturns ? "primary" : "orange") as "primary" | "orange" }
    : undefined

  return [
    {
      title: "Operativo",
      items: [],
      subgroups: [
        {
          title: "Resumen",
          items: [
            { href: "/dashboard", label: "Hoy", icon: LayoutGrid },
            { href: "/reports", label: "KPIs", icon: BarChart3 },
            { href: "/activity", label: "Bitácora", icon: Activity },
          ],
        },
        {
          title: "Gestión",
          items: [
            { href: "/orders", label: "Pedidos", icon: ShoppingBag, badge: ordersBadgeMerged },
            { href: "/products", label: "Productos", icon: Package, badge: productsBadge },
            { href: "/catalog", label: "Categorías", icon: Tag },
            { href: "/inventory", label: "Inventario", icon: Layers, badge: inventoryBadge },
            { href: "/customers", label: "Clientes", icon: Users },
            { href: "/customer-groups", label: "Grupos", icon: Users },
          ],
        },
      ],
    },
    {
      title: "Logística",
      items: [
        { href: "/locations", label: "Ubicaciones", icon: MapPin },
        { href: "/shipping", label: "Envíos", icon: Truck },
        { href: "/returns", label: "Devoluciones", icon: Undo2 },
      ],
    },
    {
      title: "Negocio",
      items: [
        { href: "/finanzas", label: "Finanzas", icon: Coins },
        { href: "/marketing", label: "Marketing", icon: Megaphone },
        { href: "/loyalty", label: "Loyalty", icon: Star },
      ],
    },
    {
      title: "Comunicación",
      items: [
        { href: "/social", label: "Social", icon: Calendar, badge: socialBadge },
        { href: "/webmail", label: "Webmail", icon: Mail },
      ],
    },
    {
      title: "Setup",
      items: [{ href: "/settings", label: "Configuración", icon: Settings }],
    },
  ]
}

export interface SidebarBadges {
  pendingOrders?: number
  draftProducts?: number
  lowStockItems?: number
  pendingReturns?: number
  postsInReview?: number
}

/** Render helper para una lista plana de NavItems. Se usa tanto para items
 *  directos de una section como para items dentro de subgroups. */
function renderItems(
  items: NavItem[],
  { collapsed, isActive }: { collapsed: boolean; isActive: (href: string) => boolean },
) {
  return items.map((item) => {
    const Icon = item.icon
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "nav-link flex items-center rounded-md font-medium transition-colors relative",
          collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2",
          active ? "nav-active" : "sidebar-nav-item",
        )}
      >
        <Icon size={16} strokeWidth={2.2} className="flex-shrink-0" />
        {!collapsed && <span className="truncate flex-1">{item.label}</span>}
        {item.badge &&
          (collapsed ? (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 text-[8px] font-display font-bold px-1 py-0 rounded-full min-w-[14px] text-center",
                item.badge.tone === "orange" ? "bg-orange text-dark" : "bg-primary text-white",
              )}
            >
              {item.badge.count > 9 ? "9+" : item.badge.count}
            </span>
          ) : (
            <span
              className={cn(
                "ml-auto text-[9px] font-display font-bold px-1.5 py-0.5 rounded-md",
                item.badge.tone === "orange" ? "bg-orange text-dark" : "bg-primary text-white",
              )}
            >
              {item.badge.count}
            </span>
          ))}
      </Link>
    )
  })
}

export function Sidebar({ user, badges }: { user: SidebarUser; badges?: SidebarBadges }) {
  const sections = buildSections(badges)
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Restaurar estado del localStorage en mount
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      setCollapsed(v === "true")
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  // Aplicar/persistir colapso → atributo en <html> para que el <main> ajuste margin via CSS
  useEffect(() => {
    if (!hydrated) return
    document.documentElement.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded")
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)) } catch { /* ignore */ }
  }, [collapsed, hydrated])

  // Mobile drawer: sincronizar con atributo en <html> + listener global del topbar
  useEffect(() => {
    document.documentElement.setAttribute("data-sidebar-mobile", mobileOpen ? "open" : "closed")
  }, [mobileOpen])

  useEffect(() => {
    function toggle() { setMobileOpen((v) => !v) }
    function close() { setMobileOpen(false) }
    window.addEventListener("panel:toggle-mobile-sidebar", toggle)
    window.addEventListener("panel:close-mobile-sidebar", close)
    return () => {
      window.removeEventListener("panel:toggle-mobile-sidebar", toggle)
      window.removeEventListener("panel:close-mobile-sidebar", close)
    }
  }, [])

  // Cerrar drawer al cambiar de ruta
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Cerrar drawer al click en el backdrop (CSS pseudo-element no captura clicks)
  useEffect(() => {
    if (!mobileOpen) return
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      // Si el click no es en el sidebar mismo, cerrar (sólo en mobile)
      if (window.innerWidth >= 768) return
      if (target?.closest("aside.sidebar-bg")) return
      if (target?.closest("[data-mobile-toggle]")) return
      setMobileOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [mobileOpen])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

  // Atajo Ctrl+B / Cmd+B para colapsar
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        const target = e.target as HTMLElement | null
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return
        e.preventDefault()
        setCollapsed((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  async function handleLogout() {
    setMenuOpen(false)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch { /* ignore — la cookie se limpia igual al volver al login */ }
    router.replace("/login")
    router.refresh()
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/"
    return pathname.startsWith(href)
  }

  const width = collapsed ? "w-[64px]" : "w-[244px]"

  return (
    <aside
      className={cn(
        "sidebar-bg flex flex-col fixed inset-y-0 left-0 z-30 transition-[width] duration-200 ease-out",
        width,
      )}
      style={{ color: "rgb(var(--sidebar-text))" }}
    >
      {/* Toggle global — siempre en el borde derecho del sidebar, vertical centro.
          Mitad fuera del sidebar (translate-x-1/2) para no chocar con nav items.
          Sin overflow-hidden alrededor (a diferencia del logo block) para que sea visible. */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? "Expandir (⌘B)" : "Colapsar (⌘B)"}
        aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        className="hidden md:flex absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 z-30 w-6 h-6 items-center justify-center bg-cream text-ink hover:bg-orange hover:text-dark transition-colors rounded-full"
        style={{ border: "1.5px solid #1A1A1A", boxShadow: "1.5px 1.5px 0 0 var(--shadow-color)" }}
      >
        {collapsed ? <ChevronRight size={12} strokeWidth={3} /> : <ChevronLeft size={12} strokeWidth={3} />}
      </button>

      {/* Logo block */}
      <div
        className={cn(
          "relative overflow-hidden",
          collapsed ? "px-2 pt-4 pb-3 flex items-center justify-center" : "px-5 pt-6 pb-5",
        )}
        style={{ borderBottom: "1px solid var(--sidebar-divider)" }}
      >
        {!collapsed && (
          <div
            className="watermark-amp text-[140px] -top-6 -right-4 select-none"
            style={{ color: "var(--sidebar-watermark)" }}
          >&amp;</div>
        )}
        <Link
          href="/dashboard"
          className={cn("flex items-center relative", collapsed ? "justify-center" : "gap-3")}
          title="Enrola"
        >
          <div
            className={cn(
              "bg-cream flex items-center justify-center p-1.5",
              collapsed ? "w-9 h-9" : "w-11 h-11",
            )}
            style={{ border: "2.5px solid #1A1A1A", boxShadow: "3px 3px 0 0 #1A1A1A", borderRadius: 4 }}
          >
            <Image src="/logo.svg" alt="Enrola" width={32} height={32} className="w-full h-full object-contain" priority />
          </div>
          {!collapsed && (
            <div>
              <div
                className="font-display font-black text-[20px] leading-none tracking-tight"
                style={{ color: "rgb(var(--sidebar-text))" }}
              >ENROLA</div>
              <div className="text-[9px] text-orange uppercase tracking-[0.2em] mt-1 font-bold">Panel · Producción</div>
            </div>
          )}
        </Link>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
          className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-cream text-ink hover:bg-orange rounded-md z-10"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          <ChevronLeft size={14} strokeWidth={3} />
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto nav-scroll py-4 text-[13px]", collapsed ? "px-1.5 space-y-3" : "px-2 space-y-5")}>
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="px-3 py-1.5 text-[9px] font-display font-bold uppercase tracking-[0.18em] text-orange/80">
                {section.title}
              </div>
            )}
            {/* Items sin subgroups */}
            {renderItems(section.items, { collapsed, isActive })}
            {/* Items con subgroups (mini sub-divider con label opcional) */}
            {section.subgroups?.map((sg, sgIdx) => (
              <div key={sg.title ?? sgIdx} className={collapsed ? "" : "mt-1"}>
                {!collapsed && sg.title && (
                  <div className="px-3 py-1 text-[8px] font-display font-bold uppercase tracking-[0.16em] text-ink-3/70">
                    {sg.title}
                  </div>
                )}
                {/* Mini-divider entre subgroups cuando está colapsado, así el usuario percibe el grupo */}
                {collapsed && sgIdx > 0 && (
                  <div className="h-px mx-2 my-1 bg-warm-200/40" aria-hidden />
                )}
                {renderItems(sg.items, { collapsed, isActive })}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* BCV ticker + Theme toggle */}
      {!collapsed ? (
        <div
          className="px-3 py-2 space-y-1"
          style={{ borderTop: "1px solid var(--sidebar-divider)" }}
        >
          <BcvTicker />
          <ThemeToggle />
        </div>
      ) : (
        <div className="py-2 flex justify-center" style={{ borderTop: "1px solid var(--sidebar-divider)" }}>
          <ThemeToggle compact />
        </div>
      )}

      {/* User card */}
      <div
        className={cn("relative", collapsed ? "px-1.5 pt-2 pb-2" : "px-3 pt-2 pb-3")}
        style={{ borderTop: "1px solid var(--sidebar-divider)" }}
        ref={menuRef}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title={collapsed ? user.email : undefined}
          className={cn(
            "flex items-center cursor-pointer transition-colors w-full sidebar-nav-item rounded-md",
            collapsed ? "justify-center px-1 py-1" : "gap-2.5 px-2 py-2",
          )}
          style={{ border: collapsed ? undefined : "1px solid var(--sidebar-divider)" }}
        >
          <div
            className="w-7 h-7 bg-orange flex items-center justify-center font-display font-black text-[12px] text-dark rounded-md flex-shrink-0"
            style={{ border: "1.5px solid #1A1A1A" }}
          >
            {(user.name?.[0] ?? user.email[0] ?? "?").toUpperCase()}
            {(user.name?.split(" ")[1]?.[0] ?? user.email[1] ?? "").toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[12px] truncate font-semibold" style={{ color: "rgb(var(--sidebar-text))" }}>
                  {user.name || user.email.split("@")[0]}
                </div>
                <div className="text-[10px] truncate" style={{ color: "rgb(var(--sidebar-text-soft))" }}>Owner</div>
              </div>
              <ChevronDown size={14} strokeWidth={2.2} className={cn("transition-transform", menuOpen && "rotate-180")} style={{ color: "rgb(var(--sidebar-text-soft))" }} />
            </>
          )}
        </button>

        {menuOpen && (
          <div
            className={cn(
              "absolute bottom-[calc(100%-8px)] py-1 z-50 rounded-md",
              collapsed ? "left-[60px] w-56" : "left-3 right-3",
            )}
            style={{
              background: "rgb(var(--sidebar-bg))",
              color: "rgb(var(--sidebar-text))",
              border: "2px solid #FF3B27",
              boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.15)",
            }}
          >
            {collapsed && (
              <div className="px-3 py-2 text-[11px] font-mono text-ink-3 border-b" style={{ borderColor: "var(--sidebar-divider)" }}>
                {user.email}
              </div>
            )}
            <a
              href="https://api.enrola.shop/dashboard"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-[12px] sidebar-nav-item rounded-md mx-1"
            >
              <ExternalLink size={13} strokeWidth={2.2} className="text-orange" />
              <span>Medusa admin (legacy)</span>
            </a>
            <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--sidebar-divider)" }} />
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-primary/15 transition-colors text-left rounded-md mx-1"
              style={{ color: "rgb(var(--sidebar-text))" }}
            >
              <LogOut size={13} strokeWidth={2.2} className="text-primary" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
