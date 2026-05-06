"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

function LoginForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/cuenta";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email o contraseña incorrectos");
    } else {
      router.push(callbackUrl);
    }
  };

  const handleGoogle = () => signIn("google", { callbackUrl });

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="border-[3px] border-dark bg-white shadow-[8px_8px_0px_0px_#1A1A1A] p-8">
            <div className="text-center mb-8">
              <h1 className="font-black text-2xl uppercase tracking-widest text-dark mb-1">
                Iniciar Sesión
              </h1>
              <p className="text-sm text-dark/60">Accede a tu cuenta Enrola</p>
            </div>

            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 border-2 border-dark bg-white py-3 font-bold text-sm uppercase tracking-widest hover:bg-cream transition-colors mb-6 shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-dark/20" />
              <span className="text-xs text-dark/40 font-bold uppercase">O</span>
              <div className="flex-1 h-px bg-dark/20" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="vintage-input w-full" placeholder="tu@email.com" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Contraseña</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="vintage-input w-full" placeholder="••••••••" />
                <Link href="/recuperar" className="block text-right mt-1.5 text-xs font-bold text-orange hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {error && (
                <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 px-3 py-2">{error}</p>
              )}

              <button type="submit" disabled={loading} className="w-full bg-orange text-white py-3.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-60 mt-2">
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className="text-center text-sm text-dark/60 mt-6">
              ¿No tienes cuenta?{" "}
              <Link href={`/registro${callbackUrl !== "/cuenta" ? `?redirect=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-bold text-orange hover:underline">
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
