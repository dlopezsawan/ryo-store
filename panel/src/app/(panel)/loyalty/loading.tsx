import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"

export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="★" />
      <PageHeader title="LOYALTY" description="Cargando recompensas y referidos…" />
      <div className="grid grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stamp-card p-4">
            <div className="h-3 bg-cream-2 rounded-md animate-pulse w-32" />
            <div className="h-8 bg-cream-2 rounded-md animate-pulse mt-3" />
            <div className="h-2 bg-cream-2 rounded-md animate-pulse mt-2 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 stamp-card p-0 overflow-hidden">
          <div className="h-12 bg-dark" />
          <div className="grid grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-3 border-b border-warm-200/50">
                <div className="w-14 h-14 bg-cream-2 rounded-md animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-cream-2 rounded-md animate-pulse w-3/4" />
                  <div className="h-2 bg-cream-2 rounded-md animate-pulse w-1/2" />
                  <div className="h-3 bg-cream-2 rounded-md animate-pulse w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-5 stamp-card p-0 overflow-hidden">
          <div className="h-12 bg-dark" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 flex items-center gap-2.5 border-b border-warm-200/50">
              <div className="w-7 h-7 bg-cream-2 rounded-md animate-pulse" />
              <div className="flex-1 h-3 bg-cream-2 rounded-md animate-pulse" />
              <div className="w-16 h-3 bg-cream-2 rounded-md animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
