import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { CommandPalette } from "@/components/layout/CommandPalette"
import {
  listOrders, listProducts, listInventoryItems, listReturns, listSocialPosts,
} from "@/lib/medusa"

/**
 * Layout autenticado. El middleware ya bloquea acceso sin cookie, pero
 * acá hacemos un check extra server-side por defensa en profundidad +
 * para tener acceso a datos del usuario sin un fetch al endpoint /me.
 *
 * Carga badges del sidebar en paralelo. Cada count es fail-soft (silent
 * 0 si su endpoint falla) para no romper el layout entero.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const [pendingOrdersR, draftProductsR, inventoryR, returnsR, socialR] = await Promise.allSettled([
    listOrders({ limit: 1, payment_status: ["awaiting", "not_paid"], fields: "id" }),
    listProducts({ limit: 1, status: ["draft"] }),
    listInventoryItems({ limit: 100, q: undefined }),
    listReturns({ limit: 50 }),
    listSocialPosts(),
  ])

  const pendingOrders = pendingOrdersR.status === "fulfilled" ? pendingOrdersR.value.count : 0
  const draftProducts = draftProductsR.status === "fulfilled" ? draftProductsR.value.count : 0

  // Inventory: count de items con disponible <= 10 (low/critical)
  let lowStockItems = 0
  if (inventoryR.status === "fulfilled") {
    for (const it of inventoryR.value.inventory_items) {
      const stocked = typeof it.stocked_quantity === "number"
        ? it.stocked_quantity
        : (it.location_levels ?? []).reduce((s, l) => s + (l.stocked_quantity ?? 0), 0)
      const reserved = typeof it.reserved_quantity === "number"
        ? it.reserved_quantity
        : (it.location_levels ?? []).reduce((s, l) => s + (l.reserved_quantity ?? 0), 0)
      const available = Math.max(0, stocked - reserved)
      if (available < 10) lowStockItems += 1
    }
  }

  // Returns pendientes de recibir (status requested o partial)
  const pendingReturns = returnsR.status === "fulfilled"
    ? returnsR.value.returns.filter((r) => r.status !== "received" && r.status !== "canceled").length
    : 0

  // Social posts en review
  const postsInReview = socialR.status === "fulfilled"
    ? socialR.value.posts.filter((p) => p.status === "in_review" || p.status === "draft").length
    : 0

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{ email: session.email }}
        badges={{
          pendingOrders,
          draftProducts,
          lowStockItems,
          pendingReturns,
          postsInReview,
        }}
      />
      <main className="panel-main flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
      <CommandPalette />
    </div>
  )
}
