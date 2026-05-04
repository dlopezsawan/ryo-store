"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Megaphone, Tag, Users, Send, GitBranch, Target,
  Activity, Mail, BarChart3, Brain, UserSearch, LineChart,
} from "lucide-react"
import { ScrollableTabs } from "@/components/ui/ScrollableTabs"

// Tabs agrupados por familia: ACTION (operar campañas) · INSIGHT (entender)
// Loyalty vive en su propio top-level (sidebar) — no duplicar acá.
const TABS = [
  { href: "/marketing",              label: "Resumen",     icon: Megaphone, group: "main" },
  // Action
  { href: "/marketing/promotions",   label: "Promos",      icon: Tag,      group: "action" },
  { href: "/marketing/segments",     label: "Segmentos",   icon: Users,    group: "action" },
  { href: "/marketing/rules",        label: "Reglas",      icon: Activity, group: "action" },
  { href: "/marketing/fires",        label: "Envíos",      icon: Mail,     group: "action" },
  { href: "/marketing/campaigns",    label: "Campañas",    icon: Send,     group: "action" },
  // Insight
  { href: "/marketing/analytics",    label: "Analytics",   icon: LineChart, group: "insight" },
  { href: "/marketing/patterns",     label: "Patrones",    icon: BarChart3, group: "insight" },
  { href: "/marketing/funnels",      label: "Funnels",     icon: GitBranch, group: "insight" },
  { href: "/marketing/attribution",  label: "Attribution", icon: Target,    group: "insight" },
  { href: "/marketing/intelligence", label: "Intel",       icon: Brain,     group: "insight" },
  { href: "/marketing/user360",      label: "User 360",    icon: UserSearch, group: "insight" },
] as const

export function MarketingNav() {
  const pathname = usePathname()

  // Render tab + un divider sutil entre grupos (action / insight)
  // para que el usuario vea visualmente la diferencia "qué hago" vs "qué entiendo".
  return (
    <ScrollableTabs className="pb-1" >
      <div className="flex items-center gap-1" style={{ borderBottom: "2px dashed var(--border)" }}>
        {TABS.map((t, i) => {
          const active = pathname === t.href || (t.href !== "/marketing" && pathname.startsWith(t.href))
          const Icon = t.icon
          const prevGroup = i > 0 ? TABS[i - 1].group : null
          const showDivider = prevGroup && prevGroup !== t.group
          return (
            <span key={t.href} className="flex items-center gap-1">
              {showDivider && (
                <span className="mx-1 h-4 w-px bg-warm-200" aria-hidden />
              )}
              <Link
                href={t.href}
                data-tab-active={active ? "true" : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors rounded-md ${
                  active ? "bg-dark text-cream" : "text-ink-3 hover:bg-cream-2"
                }`}>
                <Icon size={11} strokeWidth={2.5} /> {t.label}
              </Link>
            </span>
          )
        })}
      </div>
    </ScrollableTabs>
  )
}
