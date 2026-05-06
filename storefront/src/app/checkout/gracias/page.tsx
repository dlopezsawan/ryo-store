"use client";

import { Suspense } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function GraciasContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-16 text-center">
        <div className="border-3 border-dark bg-white p-10 md:p-16 max-w-2xl mx-auto"
          style={{ borderWidth: "3px", boxShadow: "8px 8px 0px 0px var(--primary)" }}>
          <div className="w-16 h-16 bg-secondary text-cream flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight mb-4">
            Gracias por tu compra!
          </h1>
          <p className="text-muted text-base mb-6 max-w-md mx-auto">
            Hemos recibido tu pedido. Verificaremos el pago y recibirás actualizaciones por correo.
          </p>
          {orderId && (
            <p className="text-dark font-bold mb-8">
              Pedido: <span className="font-mono bg-cream px-3 py-1 border border-dark/20">{orderId.slice(-6).toUpperCase()}</span>
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/tienda"
              className="bg-orange text-white px-8 py-3.5 font-black text-sm uppercase tracking-widest rounded-lg retro-border retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              SEGUIR COMPRANDO
            </Link>
            <Link
              href="/"
              className="bg-dark text-cream px-8 py-3.5 font-black text-sm uppercase tracking-widest rounded-lg retro-border retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              IR AL INICIO
            </Link>
          </div>

          {/* Tracking link */}
          <div className="mt-8 pt-6 border-t border-dark/10">
            <Link
              href="/seguimiento"
              className="inline-flex items-center gap-2 bg-secondary text-cream px-6 py-3 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              RASTREA TU PEDIDO
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function GraciasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-muted">Cargando...</p>
      </div>
    }>
      <GraciasContent />
    </Suspense>
  );
}
