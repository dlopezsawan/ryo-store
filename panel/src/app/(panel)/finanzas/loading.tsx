import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"

export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="€" />
      <PageHeader title="FINANZAS" description="Cargando finanzas…" />
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 stamp-card p-5">
          <div className="h-4 bg-cream-2 rounded-md animate-pulse w-32 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-cream-2 rounded-md animate-pulse" />
            ))}
          </div>
        </div>
        <div className="col-span-5 stamp-card p-5">
          <div className="h-4 bg-cream-2 rounded-md animate-pulse w-24 mb-4" />
          <div className="h-12 bg-cream-2 rounded-md animate-pulse mb-3" />
          <div className="h-32 bg-cream-2 rounded-md animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8 stamp-card p-0 overflow-hidden">
          <div className="h-12 bg-dark" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-warm-200/50 flex items-center gap-3">
              <div className="w-10 h-10 bg-cream-2 rounded-md animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-cream-2 rounded-md animate-pulse w-3/4" />
                <div className="h-2 bg-cream-2 rounded-md animate-pulse w-1/2" />
              </div>
              <div className="w-20 h-4 bg-cream-2 rounded-md animate-pulse" />
            </div>
          ))}
        </div>
        <div className="col-span-4 stamp-card p-5">
          <div className="h-4 bg-cream-2 rounded-md animate-pulse w-24 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-cream-2 rounded-md animate-pulse mb-2" />
          ))}
        </div>
      </div>
    </div>
  )
}
