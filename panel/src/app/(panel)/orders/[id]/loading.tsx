export default function Loading() {
  return (
    <div className="p-7 space-y-5 relative">
      <div className="watermark-amp text-[400px] -top-32 right-0 select-none italic">&amp;</div>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-cream-2 animate-pulse" style={{ border: "1.5px solid var(--border)", borderRadius: 3 }} />
        <div className="space-y-2">
          <div className="h-9 bg-cream-2 rounded-md animate-pulse w-32" />
          <div className="h-3 bg-cream-2 rounded-md animate-pulse w-64" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8 stamp-card p-5 space-y-4">
          <div className="h-12 bg-cream-2 rounded-md animate-pulse" />
          <div className="h-12 bg-cream-2 rounded-md animate-pulse" />
          <div className="h-12 bg-cream-2 rounded-md animate-pulse" />
        </div>
        <div className="col-span-4 stamp-card p-5">
          <div className="h-32 bg-cream-2 rounded-md animate-pulse" />
        </div>
      </div>
    </div>
  )
}
