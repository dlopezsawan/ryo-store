import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"

export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />
      <PageHeader title="DASHBOARD" description="Cargando métricas…" />
      <div className="grid grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stamp-card p-5">
            <div className="h-3 bg-cream-2 rounded-md animate-pulse w-24" />
            <div className="h-10 bg-cream-2 rounded-md animate-pulse mt-4" />
            <div className="h-3 bg-cream-2 rounded-md animate-pulse mt-2 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 stamp-card p-5">
          <div className="h-4 bg-cream-2 rounded-md animate-pulse w-32" />
          <div className="h-[200px] bg-cream-2 rounded-md animate-pulse mt-4" />
        </div>
        <div className="col-span-5 stamp-card p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-cream-2 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
