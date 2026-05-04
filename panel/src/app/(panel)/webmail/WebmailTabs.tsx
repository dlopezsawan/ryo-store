"use client"

import Link from "next/link"
import { Inbox, Send, Megaphone } from "lucide-react"
import { ScrollableTabs } from "@/components/ui/ScrollableTabs"

export function WebmailTabs({ current }: { current: "inbox" | "marketing" | "send" }) {
  const tabs = [
    { key: "inbox", label: "Inbox", icon: Inbox },
    { key: "send", label: "Enviar", icon: Send },
    { key: "marketing", label: "Marketing", icon: Megaphone },
  ] as const

  return (
    <ScrollableTabs className="-mt-2">
      <nav className="flex items-center gap-1 border-b-[1.5px] border-warm-200/60">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = t.key === current
          return (
            <Link
              key={t.key}
              href={t.key === "inbox" ? "/webmail" : `/webmail?tab=${t.key}`}
              data-tab-active={isActive ? "true" : undefined}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-display font-bold uppercase tracking-wider whitespace-nowrap relative ${
                isActive
                  ? "text-orange after:content-[''] after:absolute after:bottom-[-1.5px] after:left-0 after:right-0 after:h-[2px] after:bg-orange"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              <Icon size={12} strokeWidth={2.5} /> {t.label}
            </Link>
          )
        })}
      </nav>
    </ScrollableTabs>
  )
}
