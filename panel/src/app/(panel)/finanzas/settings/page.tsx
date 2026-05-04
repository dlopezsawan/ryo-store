import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { FinanzasNav } from "../FinanzasNav"
import { SettingsClient } from "./SettingsClient"
import { listFinanzasWallets, MedusaError, type FinanzasWallet } from "@/lib/medusa"

export default async function FinanzasSettingsPage() {
  let wallets: FinanzasWallet[] = []
  let walletsError: string | null = null
  try {
    const r = await listFinanzasWallets()
    wallets = r.wallets
  } catch (e) {
    if (e instanceof MedusaError) {
      walletsError = e.status === 401 ? "Sesión expirada" : `Backend ${e.status}: ${e.message}`
    } else {
      walletsError = e instanceof Error ? e.message : "error desconocido"
    }
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="⚙" />

      <Link href="/finanzas" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Finanzas
      </Link>

      <PageHeader
        title="CONFIGURACIÓN"
        stamp={`${wallets.length} WALLETS`}
        stampTone="orange"
        description="Wallets reales del backend · preferencias UI · categorías de gastos · todo persistido en Medusa"
      />

      <FinanzasNav />

      <SettingsClient initialWallets={wallets} walletsError={walletsError} />
    </div>
  )
}
