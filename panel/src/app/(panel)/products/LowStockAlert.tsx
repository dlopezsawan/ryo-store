import Link from "next/link"
import { AlertTriangle, Package } from "lucide-react"
import type { ProductRow } from "./ProductsGrid"

const LOW_STOCK_THRESHOLD = 10
const CRITICAL_THRESHOLD = 3

/**
 * Banner que aparece arriba del grid si hay productos con stock bajo o crítico.
 * No se muestra si el filtro actual de la página es status=draft (no relevante
 * porque drafts no se venden), pero el server lo decide via prop hasStockData.
 */
export function LowStockAlert({ rows }: { rows: ProductRow[] }) {
  // Solo productos publicados para considerarlos vendibles
  const lowStock = rows.filter((p) => p.status === "published" && p.totalStock > 0 && p.totalStock <= LOW_STOCK_THRESHOLD)
  const critical = lowStock.filter((p) => p.totalStock <= CRITICAL_THRESHOLD)
  const outOfStock = rows.filter((p) => p.status === "published" && p.totalStock === 0)

  if (lowStock.length === 0 && outOfStock.length === 0) return null

  const severity =
    critical.length > 0 || outOfStock.length > 0 ? "critical" :
    lowStock.length > 0 ? "warning" : "info"

  const meta = severity === "critical"
    ? { color: "#BB3B2E", bg: "bg-primary/5", textCls: "text-primary" }
    : { color: "#FF3B27", bg: "bg-orange/5", textCls: "text-orange" }

  return (
    <div className={`stamp-card p-3 ${meta.bg}`} style={{ borderColor: meta.color }}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className={`${meta.textCls} flex-shrink-0 mt-0.5`} strokeWidth={2.5} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`font-display font-black text-[12px] uppercase tracking-wider ${meta.textCls}`}>
              {severity === "critical" ? "Alerta de stock crítico" : "Stock bajo"}
            </span>
            <span className="text-[10px] font-mono text-ink-3">
              {outOfStock.length > 0 && <>{outOfStock.length} sin stock · </>}
              {critical.length > 0 && <>{critical.length} crítico (≤{CRITICAL_THRESHOLD}) · </>}
              {lowStock.length - critical.length > 0 && <>{lowStock.length - critical.length} bajo (≤{LOW_STOCK_THRESHOLD})</>}
            </span>
            <Link href="/inventory" className="ml-auto text-[10px] font-display font-bold uppercase tracking-wider text-ink-2 hover:text-orange flex items-center gap-1">
              <Package size={11} strokeWidth={2.5} /> Ver inventario completo →
            </Link>
          </div>
          {/* Top 5 productos con menor stock */}
          {(outOfStock.length > 0 || critical.length > 0) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {[...outOfStock.slice(0, 3), ...critical.filter((c) => !outOfStock.includes(c)).slice(0, 5 - Math.min(3, outOfStock.length))].map((p) => (
                <Link key={p.id} href={`/products/${p.id}`}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono hover:bg-page transition-colors flex items-center gap-1 ${
                    p.totalStock === 0 ? "bg-primary/15 text-primary" : "bg-orange/15 text-orange"
                  }`}>
                  <span className="font-display font-bold truncate max-w-[160px]">{p.title}</span>
                  <span className="font-display font-black num">{p.totalStock === 0 ? "0" : p.totalStock}</span>
                </Link>
              ))}
              {(outOfStock.length + critical.length) > 5 && (
                <span className="text-[10px] text-ink-3 font-mono">+ {(outOfStock.length + critical.length) - 5} más</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
