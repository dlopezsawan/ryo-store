export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-cream-2 rounded-md animate-pulse" />
        <div className="w-16 h-16 bg-cream-2 rounded-md animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 bg-cream-2 rounded-md animate-pulse w-48" />
          <div className="h-3 bg-cream-2 rounded-md animate-pulse w-32" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stamp-card p-4 space-y-2">
            <div className="h-2.5 bg-cream-2 rounded-md animate-pulse w-16" />
            <div className="h-7 bg-cream-2 rounded-md animate-pulse w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8 stamp-card p-0 overflow-hidden">
          <div className="h-14 bg-dark" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-3 py-4 border-b border-warm-200/50">
              <div className="h-4 bg-cream-2 rounded-md animate-pulse w-1/3" />
            </div>
          ))}
        </div>
        <div className="col-span-4 space-y-4">
          <div className="stamp-card p-5 h-32 animate-pulse bg-cream-2" />
          <div className="stamp-card p-5 h-24 animate-pulse bg-cream-2" />
        </div>
      </div>
    </div>
  )
}
