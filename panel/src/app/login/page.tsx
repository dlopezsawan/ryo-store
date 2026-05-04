"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const reason = params.get("reason")
  const from = params.get("from") || "/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(
    reason === "expired" ? "Tu sesión expiró. Vuelve a iniciar sesión." : null
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.error === "invalid_credentials") {
          setError("Credenciales incorrectas. Verifica email y contraseña.")
        } else if (data.error === "missing_credentials") {
          setError("Email y contraseña requeridos.")
        } else {
          setError("Error al iniciar sesión. Revisa que el backend esté disponible.")
        }
        return
      }
      router.replace(from)
      router.refresh()
    } catch (err) {
      setError(`Error de red: ${err instanceof Error ? err.message : "desconocido"}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative ampersand watermark */}
      <div className="watermark-amp text-[640px] -top-32 -right-32 select-none">&amp;</div>

      <div className="w-full max-w-md relative">
        {/* Top brand block */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-cream mb-4 p-3"
               style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}>
            <Image src="/logo.svg" alt="Enrola" width={48} height={48} className="w-full h-full object-contain" priority />
          </div>
          <h1 className="font-display font-black text-[32px] text-ink leading-none tracking-tight">ENROLA</h1>
          <p className="text-[10px] text-orange uppercase tracking-[0.3em] mt-2 font-bold">Panel · Producción</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="stamp-card p-7 space-y-4">
          <div>
            <label htmlFor="email" className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@enrola.shop"
              className="w-full px-3 py-2.5 bg-page border-[1.5px] rounded-md text-[14px] focus:outline-none transition-colors font-mono"
              style={{ borderColor: "var(--border)" }}
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 bg-page border-[1.5px] rounded-md text-[14px] focus:outline-none transition-colors font-mono"
                style={{ borderColor: "var(--border)" }}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink p-1"
                aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPw ? <EyeOff size={16} strokeWidth={2.2} /> : <Eye size={16} strokeWidth={2.2} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-primary/5" style={{ border: "1.5px solid #BB3B2E", borderRadius: 2 }}>
              <AlertCircle size={16} strokeWidth={2.2} className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-ink font-medium leading-snug">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full px-4 py-3 bg-orange text-dark rounded-md text-[12px] font-display font-bold uppercase tracking-[0.12em] transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            style={{ border: "2px solid #1A1A1A", boxShadow: submitting ? "1px 1px 0 0 var(--shadow-color)" : "4px 4px 0 0 var(--shadow-color)" }}
          >
            {submitting ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>

          <div className="dotted-div my-1" />

          <div className="flex items-center gap-2 text-[10px] text-ink-3 font-mono">
            <ShieldCheck size={12} strokeWidth={2.2} />
            <span>Sesión cifrada · cookie httpOnly · 8h TTL</span>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-[9px] text-ink-3 font-mono uppercase tracking-[0.3em]">
            Enrola Shop · Panel v1.0 · Made in Caracas
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
