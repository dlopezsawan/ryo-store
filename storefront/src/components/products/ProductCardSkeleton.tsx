export default function ProductCardSkeleton() {
  return (
    <div
      className="flex flex-col bg-cream border-dark"
      style={{
        borderWidth: "3px",
        borderStyle: "solid",
        boxShadow: "6px 6px 0px 0px var(--dark)",
      }}
    >
      {/* Image placeholder */}
      <div className="relative overflow-hidden bg-white aspect-square">
        <div className="w-full h-full retro-skeleton" />
      </div>

      {/* Info area */}
      <div
        className="p-3 md:p-4 border-dark flex flex-col gap-2"
        style={{ borderTopWidth: "3px", borderTopStyle: "solid" }}
      >
        {/* Category label */}
        <div className="h-3 w-16 retro-skeleton rounded-sm" />

        {/* Product name line 1 */}
        <div className="h-4 w-full retro-skeleton rounded-sm" />
        {/* Product name line 2 */}
        <div className="h-4 w-3/4 retro-skeleton rounded-sm" />

        {/* Price */}
        <div className="mt-1 h-6 w-20 retro-skeleton rounded-sm" />
      </div>
    </div>
  );
}
