import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"

export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />
      <PageHeader title="PEDIDOS" description="Cargando pedidos…" />
      <div className="stamp-card p-3">
        <div className="h-8 bg-cream-2 rounded-md animate-pulse" />
      </div>
      <div className="stamp-card p-0 overflow-hidden">
        <div className="h-12 bg-dark" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-3 py-3 border-b border-warm-200/50">
            <div className="flex items-center gap-3">
              <div className="w-32 h-4 bg-cream-2 rounded-md animate-pulse" />
              <div className="flex-1 h-3 bg-cream-2 rounded-md animate-pulse" />
              <div className="w-20 h-5 bg-cream-2 rounded-md animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
