import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"

export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />
      <PageHeader title="MARKETING" description="Cargando promos y referidos…" />
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
          <div className="h-14 bg-dark" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 border-b border-warm-200/50">
              <div className="w-12 h-12 bg-cream-2 rounded-md animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-cream-2 rounded-md animate-pulse w-1/3" />
                <div className="h-2 bg-cream-2 rounded-md animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="col-span-5 space-y-5">
          <div className="stamp-card p-5">
            <div className="h-32 bg-cream-2 rounded-md animate-pulse" />
          </div>
          <div className="stamp-card p-5">
            <div className="h-24 bg-cream-2 rounded-md animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
