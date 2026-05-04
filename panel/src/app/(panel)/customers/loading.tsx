import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"

export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />
      <PageHeader title="CLIENTES" description="Cargando clientes…" />
      <div className="stamp-card p-3">
        <div className="h-9 bg-cream-2 rounded-md animate-pulse" />
      </div>
      <div className="stamp-card p-0 overflow-hidden">
        <div className="h-12 bg-dark" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-3 py-3 border-b border-warm-200/50 flex items-center gap-3">
            <div className="w-9 h-9 bg-cream-2 rounded-md animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-cream-2 rounded-md animate-pulse w-32" />
              <div className="h-2 bg-cream-2 rounded-md animate-pulse w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
