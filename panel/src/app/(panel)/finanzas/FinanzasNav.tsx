"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TrendingUp, Wallet, LineChart, AlertTriangle, FileSpreadsheet, Coins, Settings, FileDown } from "lucide-react"

const TABS = [
  { href: "/finanzas",            label: "Resumen",   icon: Coins },
  { href: "/finanzas/expenses",   label: "Gastos",    icon: FileDown },
  { href: "/finanzas/pl",         label: "P&L",       icon: TrendingUp },
  { href: "/finanzas/cashflow",   label: "Cashflow",  icon: Wallet },
  { href: "/finanzas/forecast",   label: "Forecast",  icon: LineChart },
  { href: "/finanzas/anomalies",  label: "Alertas",   icon: AlertTriangle },
  { href: "/finanzas/export",     label: "Export",    icon: FileSpreadsheet },
  { href: "/finanzas/settings",   label: "Config",    icon: Settings },
] as const

export function FinanzasNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ borderBottom: "2px dashed var(--border)" }}>
      {TABS.map((t) => {
        const active = pathname === t.href || (t.href !== "/finanzas" && pathname.startsWith(t.href))
        const Icon = t.icon
        return (
          <Link key={t.href} href={t.href}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors rounded-md ${
              active ? "bg-dark text-cream" : "text-ink-3 hover:bg-cream-2"
            }`}>
            <Icon size={11} strokeWidth={2.5} /> {t.label}
          </Link>
        )
      })}
    </div>
  )
}
