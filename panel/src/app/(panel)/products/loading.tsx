import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"

export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />
      <PageHeader title="PRODUCTOS" description="Cargando catálogo…" />
      <div className="stamp-card p-3">
        <div className="h-9 bg-cream-2 rounded-md animate-pulse" />
      </div>
      <div className="grid grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="stamp-card p-0 overflow-hidden">
            <div className="aspect-square bg-cream-2 animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-cream-2 rounded-md animate-pulse" />
              <div className="h-2 bg-cream-2 rounded-md animate-pulse w-32" />
              <div className="h-5 bg-cream-2 rounded-md animate-pulse w-20 mt-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
