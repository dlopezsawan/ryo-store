import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function OrderNotFound() {
  return (
    <div className="p-7 flex items-center justify-center min-h-[60vh]">
      <div className="stamp-card p-10 text-center max-w-md">
        <div className="font-display font-black text-[64px] text-orange leading-none">404</div>
        <h1 className="font-display font-black text-[18px] uppercase tracking-tight mt-3">Pedido no encontrado</h1>
        <p className="text-[12px] text-ink-3 mt-2">El pedido que buscas no existe o fue archivado.</p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 mt-5 px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wide transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <ArrowLeft size={13} strokeWidth={2.5} /> Volver a pedidos
        </Link>
      </div>
    </div>
  )
}
