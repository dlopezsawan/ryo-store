import { Shield, Truck, RotateCcw } from "lucide-react";

const badges = [
  { icon: Shield, label: "Pago 100% Seguro" },
  { icon: Truck, label: "Envio nacional via MRW" },
  { icon: RotateCcw, label: "Garantia de calidad" },
];

export default function TrustBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {badges.map((badge) => (
        <div key={badge.label} className="flex items-center gap-1.5">
          <badge.icon className="w-3.5 h-3.5 text-muted flex-shrink-0" strokeWidth={2.5} />
          <span className="text-xs text-muted font-medium">{badge.label}</span>
        </div>
      ))}
    </div>
  );
}
