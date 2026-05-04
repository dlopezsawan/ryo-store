import { Container, Heading, Text, Button, Input, Label } from "@medusajs/ui"
import { useState } from "react"

type Props = {
  onLogin: (email: string, password: string) => Promise<void>
  loading: boolean
  error: string
}

export function LoginScreen({ onLogin, loading, error }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    try {
      await onLogin(email, password)
    } catch { /* error handled by parent */ }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
      <Container className="w-full max-w-[400px] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 text-center">
            <Heading level="h1">Webmail</Heading>
            <Text className="text-ui-fg-muted">
              Inicia sesión con tu cuenta de correo
            </Text>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="tu@enrola.shop"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <Text className="text-ui-fg-error text-center text-sm">
              {error === "Credenciales inválidas"
                ? "Email o contraseña incorrectos"
                : error}
            </Text>
          )}

          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full"
          >
            {loading ? "Conectando..." : "Iniciar sesión"}
          </Button>
        </form>
      </Container>
    </div>
  )
}
