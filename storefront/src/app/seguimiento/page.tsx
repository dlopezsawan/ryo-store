"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import {
  ShoppingCart,
  Package,
  Truck,
  Flame,
  Check,
  Search,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TrackingStep {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const TRACKING_STEPS: TrackingStep[] = [
  {
    key: "recibido",
    icon: <ShoppingCart size={24} strokeWidth={2.5} />,
    title: "Pedido Recibido",
    description: "Tu pedido fue recibido!",
  },
  {
    key: "preparando",
    icon: <Package size={24} strokeWidth={2.5} />,
    title: "Preparando tu Pack",
    description: "Estamos armando tu pedido con mucho cuidado",
  },
  {
    key: "en-camino",
    icon: <Truck size={24} strokeWidth={2.5} />,
    title: "En Camino",
    description: "Tu paquete esta viajando hacia ti",
  },
  {
    key: "entregado",
    icon: <Flame size={24} strokeWidth={2.5} />,
    title: "Listo para Rolear!",
    description: "Tu pedido llego! A disfrutar",
  },
];

// ─── Tracking Stepper ──────────────────────────────────────────────────────────

function TrackingStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full">
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-start justify-between relative">
        {TRACKING_STEPS.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isFuture = i > currentStep;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 relative z-10">
              {/* Connector line (before icon, except first) */}
              {i > 0 && (
                <div
                  className="absolute top-7 right-1/2 w-full h-[3px] -z-10"
                  style={{
                    background: i <= currentStep ? "var(--orange)" : "transparent",
                    borderBottom: i <= currentStep ? "none" : "3px dashed rgba(26,26,26,0.2)",
                  }}
                />
              )}

              {/* Icon circle */}
              <div
                className={`relative w-14 h-14 border-[3px] border-dark flex items-center justify-center flex-shrink-0 transition-all ${
                  isCompleted
                    ? "bg-orange text-white"
                    : isCurrent
                    ? "bg-orange text-white"
                    : "bg-dark/10 text-dark/40"
                }`}
                style={{
                  boxShadow: isCurrent ? "4px 4px 0px 0px #1A1A1A" : isCompleted ? "2px 2px 0px 0px #1A1A1A" : "none",
                  animation: isCurrent ? "tracker-pulse 2s ease-in-out infinite" : "none",
                }}
              >
                {isCompleted ? <Check size={24} strokeWidth={3} /> : step.icon}
              </div>

              {/* Text */}
              <div className="mt-3 text-center">
                <p
                  className={`font-black text-xs uppercase tracking-widest ${
                    isCurrent ? "text-orange" : isCompleted ? "text-dark" : "text-dark/30"
                  }`}
                >
                  {step.title}
                </p>
                <p
                  className={`text-xs mt-0.5 max-w-[140px] mx-auto ${
                    isCurrent ? "text-dark/70 font-medium" : isCompleted ? "text-dark/50" : "text-dark/20"
                  }`}
                >
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="md:hidden space-y-0">
        {TRACKING_STEPS.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isFuture = i > currentStep;
          const isLast = i === TRACKING_STEPS.length - 1;

          return (
            <div key={step.key} className="flex gap-4">
              {/* Left column: icon + connector */}
              <div className="flex flex-col items-center">
                <div
                  className={`relative w-12 h-12 border-[3px] border-dark flex items-center justify-center flex-shrink-0 ${
                    isCompleted
                      ? "bg-orange text-white"
                      : isCurrent
                      ? "bg-orange text-white"
                      : "bg-dark/10 text-dark/40"
                  }`}
                  style={{
                    boxShadow: isCurrent ? "3px 3px 0px 0px #1A1A1A" : isCompleted ? "2px 2px 0px 0px #1A1A1A" : "none",
                    animation: isCurrent ? "tracker-pulse 2s ease-in-out infinite" : "none",
                  }}
                >
                  {isCompleted ? <Check size={20} strokeWidth={3} /> : step.icon}
                </div>
                {/* Vertical connector line */}
                {!isLast && (
                  <div
                    className="w-[3px] flex-1 min-h-[32px]"
                    style={{
                      background: i < currentStep ? "var(--orange)" : "transparent",
                      borderLeft: i < currentStep ? "none" : "3px dashed rgba(26,26,26,0.2)",
                    }}
                  />
                )}
              </div>

              {/* Right column: text */}
              <div className={`pt-2 pb-6 ${isLast ? "pb-0" : ""}`}>
                <p
                  className={`font-black text-sm uppercase tracking-widest ${
                    isCurrent ? "text-orange" : isCompleted ? "text-dark" : "text-dark/30"
                  }`}
                >
                  {step.title}
                </p>
                <p
                  className={`text-sm mt-0.5 ${
                    isCurrent ? "text-dark/70 font-medium" : isCompleted ? "text-dark/50" : "text-dark/20"
                  }`}
                >
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SeguimientoPage() {
  const [orderId, setOrderId] = useState("");
  const [searched, setSearched] = useState(false);
  const [demoStep] = useState(1); // Default: "Preparando tu Pack"

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />

      <main className="flex-1 max-w-[800px] mx-auto w-full px-4 py-10 md:py-16">
        {/* Page title */}
        <div className="text-center mb-8 md:mb-10">
          <h1 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight">
            Rastrea Tu Pedido
          </h1>
          <p className="text-muted text-sm md:text-base mt-2 max-w-md mx-auto">
            Ingresa tu numero de pedido o correo para ver el estado de tu envio
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="mb-10">
          <div
            className="border-[3px] border-dark bg-white p-4 md:p-5 flex flex-col sm:flex-row gap-3"
            style={{ boxShadow: "6px 6px 0px 0px #1A1A1A" }}
          >
            <div className="flex-1 relative">
              <Search
                size={18}
                strokeWidth={2.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-dark/30 pointer-events-none"
              />
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Numero de pedido o correo..."
                className="vintage-input w-full pl-10"
              />
            </div>
            <button
              type="submit"
              className="bg-orange text-white px-6 py-2.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all flex-shrink-0"
            >
              Buscar
            </button>
          </div>
        </form>

        {/* Tracking result */}
        {searched && (
          <div className="space-y-8 animate-in">
            {/* Order info bar */}
            <div
              className="border-[3px] border-dark bg-dark text-cream p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              style={{ boxShadow: "6px 6px 0px 0px var(--primary)" }}
            >
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-cream/60">Pedido</span>
                <p className="font-mono font-black text-xl tracking-wider mt-0.5">
                  #{orderId ? orderId.slice(-6).toUpperCase().padStart(6, "0") : "DEMO01"}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs font-black uppercase tracking-widest text-cream/60">Estado</span>
                <p className="font-black text-orange text-sm uppercase tracking-widest mt-0.5">
                  {TRACKING_STEPS[demoStep].title}
                </p>
              </div>
            </div>

            {/* Stepper */}
            <div
              className="border-[3px] border-dark bg-white p-6 md:p-8"
              style={{ boxShadow: "6px 6px 0px 0px #1A1A1A" }}
            >
              <TrackingStepper currentStep={demoStep} />
            </div>

            {/* Estimated delivery */}
            <div
              className="border-[3px] border-dark bg-cream p-5 text-center"
              style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
            >
              <p className="font-black text-dark text-base md:text-lg uppercase tracking-wider">
                Tu pack llega en ~2-3 dias
              </p>
              <p className="text-dark/60 text-sm mt-2">
                Mientras tanto, que tal explorar mas productos?
              </p>
              <Link
                href="/tienda"
                className="inline-flex items-center gap-2 mt-4 bg-orange text-white px-6 py-3 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
              >
                <ShoppingCart size={16} strokeWidth={2.5} />
                Seguir Comprando
              </Link>
            </div>
          </div>
        )}

        {/* Default state - show demo prompt */}
        {!searched && (
          <div className="text-center">
            <div
              className="border-[3px] border-dark bg-white p-8 md:p-10 inline-block"
              style={{ boxShadow: "6px 6px 0px 0px #1A1A1A" }}
            >
              <Package size={48} strokeWidth={1.5} className="text-dark/20 mx-auto mb-4" />
              <p className="text-dark/50 text-sm font-medium max-w-xs mx-auto">
                Ingresa tu numero de pedido arriba para ver el estado de tu envio en tiempo real
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Pulse animation for tracker */}
      <style jsx global>{`
        @keyframes tracker-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .animate-in {
          animation: fadeSlideIn 0.4s ease-out;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
