"use client";

import { Flame } from "lucide-react";

interface CostCalculatorProps {
  price: number;
  unitsPerPack?: number;
}

export default function CostCalculator({ price, unitsPerPack = 1 }: CostCalculatorProps) {
  const costPerSession = price / unitsPerPack;
  const formatted = costPerSession.toFixed(2);

  return (
    <div className="border-2 border-secondary/30 bg-cream/50 p-4 mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Flame size={18} className="text-orange" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-secondary">
          Costo por sesion
        </h3>
      </div>
      {unitsPerPack > 1 ? (
        <p className="text-dark text-sm font-medium">
          Pack de {unitsPerPack} unidades ={" "}
          <span className="font-black text-primary text-base">€{formatted}</span>{" "}
          <span className="text-[10px] font-bold text-dark/40">BCV</span>{" "}
          por sesion
        </p>
      ) : (
        <p className="text-dark text-sm font-medium">
          Una sesion premium por solo{" "}
          <span className="font-black text-primary text-base">€{formatted}</span> <span className="text-[10px] font-bold text-dark/40">BCV</span>
        </p>
      )}
    </div>
  );
}
