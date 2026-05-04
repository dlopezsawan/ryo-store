"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Search, ArrowRight, Loader2,
  LayoutGrid, ShoppingBag, Package, Layers, Users, Tag, MapPin, Truck, Activity, BarChart3,
  Coins, Megaphone, Star, Calendar, Mail, Settings, ExternalLink, LogOut,
  CreditCard, Percent, Network, KeyRound, Globe2,
} from "lucide-react"

interface Command {
  id: string
  label: string
  hint?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  href?: string
  action?: () => void | Promise<void>
  keywords?: string[]
  group: "Navegación" | "Acciones" | "Externos" | "Settings"
}

interface SearchResults {
  orders: Array<{ id: string; display_id: number; email: string; total: number; currency: string; status: string; payment_status?: string | null }>
  products: Array<{ id: string; title: string; handle: string; status: string; thumbnail: string | null }>
  customers: Array<{ id: string; email: string; name: string }>
}

const EMPTY: SearchResults = { orders: [], products: [], customers: [] }

/**
 * Cmd+K palette global. Combina:
 *  - Comandos estáticos (navegación, settings, externos, logout)
 *  - Búsqueda live de entidades (orders / products / customers) vía /api/search
 *
 * Debounced 200ms. Cada resultado linkea al detail. Cmd+K abre/cierra,
 * ESC cierra, ↑↓ navega, ↵ ejecuta.
 */
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const commands: Command[] = [
    // Navegación principal
    { id: "nav-dashboard",  label: "Hoy",             icon: LayoutGrid,  href: "/dashboard",  keywords: ["dashboard", "home", "inicio", "kpi"], group: "Navegación" },
    { id: "nav-reports",    label: "KPIs",            icon: BarChart3,   href: "/reports",    keywords: ["reports", "reportes", "stats", "analytics", "ltv", "metricas"], group: "Navegación" },
    { id: "nav-activity",   label: "Bitácora",        icon: Activity,    href: "/activity",   keywords: ["actividad", "feed", "log", "historial", "audit"], group: "Navegación" },
    { id: "nav-orders",     label: "Pedidos",         icon: ShoppingBag, href: "/orders",     keywords: ["orders", "ventas"], group: "Navegación" },
    { id: "nav-orders-live", label: "Pedidos · LIVE", icon: ShoppingBag, href: "/orders/live", keywords: ["live", "tiempo real", "kanban", "feed", "vivo"], group: "Navegación" },
    { id: "nav-products",   label: "Productos",       icon: Package,     href: "/products",   keywords: ["catalog", "items"], group: "Navegación" },
    { id: "nav-catalog",    label: "Categorías",      icon: Tag,         href: "/catalog",    keywords: ["catálogo", "catalog", "categorias", "colecciones"], group: "Navegación" },
    { id: "nav-inventory",  label: "Inventario",      icon: Layers,      href: "/inventory",  keywords: ["stock"], group: "Navegación" },
    { id: "nav-customers",  label: "Clientes",        icon: Users,       href: "/customers",  keywords: ["users"], group: "Navegación" },
    { id: "nav-groups",     label: "Grupos",          icon: Users,       href: "/customer-groups", keywords: ["segmentos", "customer groups", "vip"], group: "Navegación" },
    { id: "nav-locations",  label: "Ubicaciones",     icon: MapPin,      href: "/locations",  keywords: ["warehouse", "locations"], group: "Navegación" },
    { id: "nav-shipping",   label: "Envíos",          icon: Truck,       href: "/shipping",   keywords: ["shipping", "delivery"], group: "Navegación" },
    { id: "nav-returns",    label: "Devoluciones",    icon: Truck,       href: "/returns",    keywords: ["returns", "refund", "claim", "rma"], group: "Navegación" },
    { id: "nav-finanzas",   label: "Finanzas",        icon: Coins,       href: "/finanzas",   keywords: ["money", "treasury", "runway", "margin"], group: "Navegación" },
    { id: "nav-marketing",  label: "Marketing",       icon: Megaphone,   href: "/marketing",  keywords: ["promos", "discount", "referrals"], group: "Navegación" },
    { id: "nav-loyalty",    label: "Loyalty",         icon: Star,        href: "/loyalty",    keywords: ["puntos", "rewards"], group: "Navegación" },
    { id: "nav-social",     label: "Social",          icon: Calendar,    href: "/social",     keywords: ["instagram", "tiktok", "calendar"], group: "Navegación" },
    { id: "nav-webmail",    label: "Webmail",         icon: Mail,        href: "/webmail",    keywords: ["email", "campaigns", "resend"], group: "Navegación" },

    // Settings
    { id: "set-settings",   label: "Configuración",   icon: Settings,    href: "/settings",          keywords: ["setup", "config"], group: "Settings" },
    { id: "set-store",      label: "Tienda",          icon: Settings,    href: "/settings/store",    keywords: ["store info"], group: "Settings" },
    { id: "set-regions",    label: "Regiones",        icon: Globe2,      href: "/settings/regions",  keywords: ["region", "countries"], group: "Settings" },
    { id: "set-tax",        label: "Tax regions",     icon: Percent,     href: "/settings/tax",      keywords: ["impuestos", "iva", "tax rates"], group: "Settings" },
    { id: "set-payments",   label: "Pagos",           icon: CreditCard,  href: "/settings/payments", keywords: ["payment providers"], group: "Settings" },
    { id: "set-channels",   label: "Sales channels",  icon: Network,     href: "/settings/sales-channels", keywords: ["sales channels"], group: "Settings" },
    { id: "set-keys",       label: "API keys",        icon: KeyRound,    href: "/settings/api-keys", keywords: ["api keys", "tokens"], group: "Settings" },
    { id: "set-team",       label: "Equipo",          icon: Users,       href: "/settings/team",     keywords: ["users", "team", "invites"], group: "Settings" },

    // External
    { id: "ext-store",      label: "Ver tienda",                icon: ExternalLink, action: () => { window.open("https://enrola.shop", "_blank") },                       group: "Externos" },
    { id: "ext-medusa",     label: "Medusa admin (legacy)",     icon: ExternalLink, action: () => { window.open("https://api.enrola.shop/dashboard", "_blank") },         group: "Externos" },
    { id: "ext-resend",     label: "Resend dashboard",          icon: ExternalLink, action: () => { window.open("https://resend.com/emails", "_blank") },                 group: "Externos" },

    // Acciones
    { id: "act-logout",     label: "Cerrar sesión",   icon: LogOut, action: async () => {
      await fetch("/api/auth/logout", { method: "POST" })
      router.replace("/login")
      router.refresh()
    }, keywords: ["logout", "salir"], group: "Acciones" },
  ]

  // Filtrar comandos estáticos
  const filteredCommands = commands.filter((c) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    if (c.label.toLowerCase().includes(q)) return true
    if (c.keywords?.some((k) => k.toLowerCase().includes(q))) return true
    return false
  })

  // Group por sección
  const grouped = filteredCommands.reduce<Record<string, Command[]>>((acc, c) => {
    if (!acc[c.group]) acc[c.group] = []
    acc[c.group].push(c)
    return acc
  }, {})

  // Construir flat-list completa (entities arriba, comandos debajo)
  // para keyboard nav con índices únicos
  type Entry =
    | { kind: "entity"; type: "order" | "product" | "customer"; id: string; label: string; sub: string; href: string }
    | { kind: "command"; cmd: Command }

  const entityEntries: Entry[] = [
    ...results.orders.map<Entry>((o) => ({
      kind: "entity",
      type: "order",
      id: o.id,
      label: `#${o.display_id} · ${o.email || "guest"}`,
      sub: `${o.currency.toUpperCase()} ${o.total.toFixed(2)} · ${o.payment_status ?? o.status}`,
      href: `/orders/${o.id}`,
    })),
    ...results.products.map<Entry>((p) => ({
      kind: "entity",
      type: "product",
      id: p.id,
      label: p.title,
      sub: p.handle ? `/${p.handle} · ${p.status}` : p.status,
      href: `/products/${p.id}`,
    })),
    ...results.customers.map<Entry>((c) => ({
      kind: "entity",
      type: "customer",
      id: c.id,
      label: c.name || c.email,
      sub: c.email,
      href: `/customers/${c.id}`,
    })),
  ]
  const flat: Entry[] = [
    ...entityEntries,
    ...filteredCommands.map<Entry>((cmd) => ({ kind: "command", cmd })),
  ]

  useEffect(() => { setActiveIdx(0) }, [debouncedQuery, query])

  // Listen Cmd+K / Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  // Auto-focus + reset al abrir
  useEffect(() => {
    if (open) {
      setQuery("")
      setDebouncedQuery("")
      setResults(EMPTY)
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounce 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(t)
  }, [query])

  // Fetch entidades cuando cambia debouncedQuery
  useEffect(() => {
    if (!open) return
    const q = debouncedQuery.trim()
    if (q.length < 2) {
      setResults(EMPTY)
      setLoading(false)
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.ok ? r.json() : EMPTY)
      .then((data: SearchResults) => {
        setResults(data ?? EMPTY)
        setLoading(false)
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setLoading(false)
      })
  }, [debouncedQuery, open])

  const runEntry = useCallback(async (entry: Entry) => {
    setOpen(false)
    if (entry.kind === "entity") {
      router.push(entry.href)
    } else {
      const c = entry.cmd
      if (c.href) router.push(c.href)
      else if (c.action) await c.action()
    }
  }, [router])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const target = flat[activeIdx]
      if (target) runEntry(target)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-dark/70" />
      <div
        className="relative w-full max-w-[640px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bg-page text-ink"
          style={{ border: "2.5px solid var(--border)", borderRadius: 4, boxShadow: "5px 5px 0 0 #FF3B27" }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            {loading ? (
              <Loader2 size={16} className="text-orange flex-shrink-0 animate-spin" />
            ) : (
              <Search size={16} strokeWidth={2.2} className="text-ink-3 flex-shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar pedido, producto, cliente o página…"
              className="flex-1 bg-transparent outline-none text-[14px] font-medium placeholder:text-ink-3"
            />
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 text-ink-3" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>
              ESC
            </kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-2">
            {flat.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-ink-3">
                {query.trim() ? `Sin resultados para "${query}"` : "Empieza a escribir…"}
              </div>
            ) : (
              <>
                {/* Entity results agrupados */}
                {results.orders.length > 0 && (
                  <Group title={`Pedidos (${results.orders.length})`}>
                    {results.orders.map((o) => {
                      const idx = entityEntries.findIndex((e) => e.kind === "entity" && e.type === "order" && e.id === o.id)
                      const active = idx === activeIdx
                      return (
                        <ResultRow
                          key={o.id}
                          active={active}
                          onClick={() => runEntry(entityEntries[idx])}
                          onMouseEnter={() => setActiveIdx(idx)}
                          icon={<ShoppingBag size={15} className={active ? "text-orange" : "text-ink-3"} />}
                          label={`#${o.display_id}`}
                          sub={`${o.email || "guest"} · ${o.currency.toUpperCase()} ${o.total.toFixed(2)}`}
                          tag={o.payment_status === "captured" ? { label: "Pagado", tone: "secondary" } : { label: o.status, tone: "orange" }}
                        />
                      )
                    })}
                  </Group>
                )}

                {results.products.length > 0 && (
                  <Group title={`Productos (${results.products.length})`}>
                    {results.products.map((p) => {
                      const idx = entityEntries.findIndex((e) => e.kind === "entity" && e.type === "product" && e.id === p.id)
                      const active = idx === activeIdx
                      return (
                        <ResultRow
                          key={p.id}
                          active={active}
                          onClick={() => runEntry(entityEntries[idx])}
                          onMouseEnter={() => setActiveIdx(idx)}
                          icon={
                            p.thumbnail ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={p.thumbnail} alt="" className="w-4 h-4 object-cover rounded-sm" />
                            ) : (
                              <Package size={15} className={active ? "text-orange" : "text-ink-3"} />
                            )
                          }
                          label={p.title}
                          sub={p.handle ? `/${p.handle}` : ""}
                          tag={{ label: p.status, tone: p.status === "published" ? "secondary" : "muted" }}
                        />
                      )
                    })}
                  </Group>
                )}

                {results.customers.length > 0 && (
                  <Group title={`Clientes (${results.customers.length})`}>
                    {results.customers.map((c) => {
                      const idx = entityEntries.findIndex((e) => e.kind === "entity" && e.type === "customer" && e.id === c.id)
                      const active = idx === activeIdx
                      return (
                        <ResultRow
                          key={c.id}
                          active={active}
                          onClick={() => runEntry(entityEntries[idx])}
                          onMouseEnter={() => setActiveIdx(idx)}
                          icon={<Users size={15} className={active ? "text-orange" : "text-ink-3"} />}
                          label={c.name || c.email}
                          sub={c.email}
                        />
                      )
                    })}
                  </Group>
                )}

                {/* Static commands */}
                {Object.entries(grouped).map(([groupName, items]) => (
                  <Group key={groupName} title={groupName}>
                    {items.map((c) => {
                      const flatIdx = flat.findIndex((e) => e.kind === "command" && e.cmd.id === c.id)
                      const active = flatIdx === activeIdx
                      const Icon = c.icon
                      return (
                        <ResultRow
                          key={c.id}
                          active={active}
                          onClick={() => runEntry({ kind: "command", cmd: c })}
                          onMouseEnter={() => setActiveIdx(flatIdx)}
                          icon={<Icon size={15} className={active ? "text-orange" : "text-ink-3"} />}
                          label={c.label}
                        />
                      )
                    })}
                  </Group>
                ))}
              </>
            )}
          </div>

          <div
            className="flex items-center justify-between px-4 py-2 text-[10px] font-mono text-ink-3"
            style={{ borderTop: "1px solid var(--border-soft)", background: "rgb(var(--surface-2))" }}
          >
            <div className="flex items-center gap-3">
              <span><kbd className="px-1 py-0 bg-page" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>↑↓</kbd> navegar</span>
              <span><kbd className="px-1 py-0 bg-page" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>↵</kbd> abrir</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1 py-0 bg-page font-bold" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>⌘</kbd>
              <kbd className="px-1 py-0 bg-page font-bold" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>K</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="px-4 py-1 text-[9px] font-display font-bold uppercase tracking-[0.18em] text-ink-3">
        {title}
      </div>
      {children}
    </div>
  )
}

function ResultRow({
  active, onClick, onMouseEnter, icon, label, sub, tag,
}: {
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
  icon: React.ReactNode
  label: string
  sub?: string
  tag?: { label: string; tone: "secondary" | "orange" | "muted" }
}) {
  const tagCls = tag?.tone === "secondary"
    ? "text-secondary bg-secondary/10"
    : tag?.tone === "orange"
      ? "text-orange bg-orange/10"
      : "text-ink-3 bg-cream-2"
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] text-left transition-colors ${
        active ? "bg-orange/15 text-ink" : "text-ink-2 hover:bg-cream-2"
      }`}
    >
      <span className="w-4 flex-shrink-0 flex items-center justify-center">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="font-medium truncate block">{label}</span>
        {sub && <span className="text-[10px] text-ink-3 font-mono truncate block">{sub}</span>}
      </span>
      {tag && (
        <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0 ${tagCls}`}>
          {tag.label}
        </span>
      )}
      {active && <ArrowRight size={12} className="text-orange flex-shrink-0" />}
    </button>
  )
}
