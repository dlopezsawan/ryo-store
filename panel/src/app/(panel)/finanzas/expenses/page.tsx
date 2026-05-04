import Link from "next/link"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { FinanzasNav } from "../FinanzasNav"
import {
  listFinanzasExpenses, listFinanzasExpenseCategories, listFinanzasWallets,
  MedusaError,
  type FinanzasExpense, type FinanzasExpenseCategory, type FinanzasWallet,
} from "@/lib/medusa"
import { ExpensesClient } from "./ExpensesClient"

interface SearchParams {
  status?: string
  category_id?: string
}

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams

  const [expR, catR, walletR] = await Promise.allSettled([
    listFinanzasExpenses({ limit: 200, status: params.status, category_id: params.category_id }),
    listFinanzasExpenseCategories(),
    listFinanzasWallets(),
  ])

  let errorMsg: string | null = null
  const expenses: FinanzasExpense[] = expR.status === "fulfilled" ? expR.value.expenses : []
  const categories: FinanzasExpenseCategory[] = catR.status === "fulfilled" ? catR.value.categories : []
  const wallets: FinanzasWallet[] = walletR.status === "fulfilled" ? walletR.value.wallets : []

  if ([expR, catR, walletR].some((r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401)) {
    errorMsg = "Sesión expirada. Recarga la página."
  } else if (expR.status === "rejected") {
    errorMsg = `No se pudieron cargar gastos: ${expR.reason instanceof Error ? expR.reason.message : "error"}`
  }

  // KPIs
  const totalUsdt = expenses.reduce((s, e) => s + (Number(e.amount_usdt) || 0), 0)
  const paidCount = expenses.filter((e) => e.status === "paid").length
  const pendingCount = expenses.filter((e) => e.status === "pending_payment").length
  const totalPending = expenses
    .filter((e) => e.status === "pending_payment")
    .reduce((s, e) => s + (Number(e.amount_usdt) || 0), 0)

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="↓" />

      <Link href="/finanzas" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Finanzas
      </Link>

      <PageHeader
        title="GASTOS"
        stamp={`${expenses.length} REGISTRADOS`}
        stampTone={pendingCount > 0 ? "orange" : "primary"}
        description={`$${totalUsdt.toFixed(2)} total · ${paidCount} pagados · ${pendingCount} pendientes ($${totalPending.toFixed(2)})`}
      />

      <FinanzasNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-primary" strokeWidth={2.5} />
            <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
          </div>
        </div>
      )}

      <ExpensesClient
        expenses={expenses}
        categories={categories}
        wallets={wallets}
        currentFilter={params}
      />
    </div>
  )
}
