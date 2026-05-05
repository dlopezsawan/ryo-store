import { getProductCategories } from "@/lib/medusa";

export default async function CategoryTicker() {
  const cats = await getProductCategories();
  const names = cats.length > 0 ? cats.map((c) => c.name.toUpperCase()) : [
    "PAPELILLOS", "GRINDERS", "FILTROS", "CONOS", "PIPAS", "CELULOSA", "ACCESORIOS", "COMBOS",
  ];
  const items = [...names, ...names];

  return (
    <div className="border-y-3 border-dark bg-dark py-3 overflow-hidden" style={{ borderWidth: "3px 0" }}>
      <div className="ticker-content">
        {items.map((cat, i) => (
          <span key={i} className="flex items-center gap-6 px-6">
            <span className="font-black text-cream text-lg md:text-xl tracking-[0.12em] whitespace-nowrap">
              {cat}
            </span>
            <span className="text-orange font-black text-xl">&bull;</span>
          </span>
        ))}
      </div>
    </div>
  );
}
