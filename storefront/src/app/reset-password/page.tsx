"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
      return;
    }
    if (password !== password2) {
      setError("Las contrasenas no coinciden");
      return;
    }
    if (!token) {
      setError("Token invalido. Solicita un nuevo enlace de recuperacion.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al actualizar la contrasena");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 2000);
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
                Nueva Contrasena
              </h1>
              <p className="text-sm text-dark/60">
                Ingresa tu nueva contrasena
              </p>
            </div>

            {success ? (
              <div className="text-center space-y-4">
                <div className="bg-green-50 border-2 border-green-300 px-4 py-3">
                  <p className="text-green-800 font-medium text-sm">
                    Contrasena actualizada! Redirigiendo al login...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">
                      Nueva Contrasena
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="vintage-input w-full"
                      placeholder="Minimo 8 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">
                      Repetir Contrasena
                    </label>
                    <input
                      type="password"
                      required
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      className="vintage-input w-full"
                      placeholder="Repite la contrasena"
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
                    {loading ? "Actualizando..." : "Actualizar contrasena"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex flex-col">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-orange border-t-transparent rounded-full animate-spin" />
          </main>
          <Footer />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
