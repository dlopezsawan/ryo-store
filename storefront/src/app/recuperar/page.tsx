"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al enviar el enlace");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="border-[3px] border-dark bg-white shadow-[8px_8px_0px_0px_#1A1A1A] p-8">
            <div className="text-center mb-8">
              <h1 className="font-black text-2xl uppercase tracking-widest text-dark mb-1">
                Recuperar Contrasena
              </h1>
              <p className="text-sm text-dark/60">
                Te enviaremos un enlace para restablecer tu contrasena
              </p>
            </div>

            {success ? (
              <div className="text-center space-y-4">
                <div className="bg-green-50 border-2 border-green-300 px-4 py-3">
                  <p className="text-green-800 font-medium text-sm">
                    Te enviamos un email con instrucciones para restablecer tu contrasena. Revisa tu bandeja de entrada.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-block font-bold text-orange hover:underline text-sm"
                >
                  Volver a iniciar sesion
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="vintage-input w-full"
                      placeholder="tu@email.com"
                    />
                  </div>

                  {error && (
                    <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange text-white py-3.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-60 mt-2"
                  >
                    {loading ? "Enviando..." : "Enviar enlace"}
                  </button>
                </form>

                <p className="text-center text-sm text-dark/60 mt-6">
                  <Link
                    href="/login"
                    className="font-bold text-orange hover:underline"
                  >
                    Volver a iniciar sesion
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
