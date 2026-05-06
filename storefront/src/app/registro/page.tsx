"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Star } from "lucide-react";
import WhatsAppPhoneInput from "@/components/form/WhatsAppPhoneInput";

function RegistroForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/cuenta";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(redirect);
    }
  }, [status, router, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: whatsapp || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al registrarse");
        setLoading(false);
        return;
      }
      // Auto-login after register
      const login = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (login?.error) {
        setError("Registro exitoso, pero error al entrar. Intenta iniciar sesión.");
      } else {
        router.push(redirect);
      }
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  };

  const handleGoogle = () => signIn("google", { callbackUrl: redirect });

  const isCheckoutRedirect = redirect === "/checkout";

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Club Enrola incentive — shown when coming from checkout */}
          {isCheckoutRedirect && (
            <div className="border-[3px] border-dark bg-orange text-white p-5 mb-6 shadow-[6px_6px_0px_0px_#1A1A1A]">
              <div className="flex items-center gap-3 mb-2">
                <Star size={20} strokeWidth={3} fill="white" />
                <span className="font-black text-sm uppercase tracking-widest">Club Enrola</span>
              </div>
              <p className="font-black text-lg leading-snug">
                ¡Gana puntos con esta compra!
              </p>
              <p className="text-white/85 text-sm mt-1">
                Regístrate ahora y acumula <strong>10 puntos por cada €1</strong> de compra.
                Al terminar volverás automáticamente al checkout con tus datos.
              </p>
            </div>
          )}

          <div className="border-[3px] border-dark bg-white shadow-[8px_8px_0px_0px_#1A1A1A] p-8">
            <div className="text-center mb-8">
              <h1 className="font-black text-2xl uppercase tracking-widest text-dark mb-1">
                Crear Cuenta
              </h1>
              <p className="text-sm text-dark/60">
                {isCheckoutRedirect
                  ? "Regístrate para ganar puntos y continuar"
                  : "Únete a la comunidad Enrola"}
              </p>
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
              Registrarse con Google
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-dark/20" />
              <span className="text-xs text-dark/40 font-bold uppercase">O</span>
              <div className="flex-1 h-px bg-dark/20" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Nombre</label>
                  <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="vintage-input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Apellido</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="vintage-input w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="vintage-input w-full" placeholder="tu@email.com" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Contraseña</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="vintage-input w-full" placeholder="Mínimo 8 caracteres" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Repetir Contraseña</label>
                <input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} className="vintage-input w-full" placeholder="••••••••" />
              </div>

              <div>
                <WhatsAppPhoneInput
                  value={whatsapp}
                  onChange={setWhatsapp}
                  showHelper
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange text-white py-3.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-60 mt-2"
              >
                {loading
                  ? "Registrando..."
                  : isCheckoutRedirect
                  ? "Crear Cuenta y Continuar Compra"
                  : "Crear Cuenta"}
              </button>
            </form>

            <p className="text-center text-sm text-dark/60 mt-6">
              ¿Ya tienes cuenta?{" "}
              <Link href={`/login?callbackUrl=${encodeURIComponent(redirect)}`} className="font-bold text-orange hover:underline">
                Iniciar Sesión
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function RegistroPage() {
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
      <RegistroForm />
    </Suspense>
  );
}
