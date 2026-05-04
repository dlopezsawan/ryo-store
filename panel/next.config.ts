import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Standalone output for Docker — copia todo lo que el panel necesita
  // a .next/standalone (Node + node_modules tree-shaken). Permite imagen
  // final ~150MB en lugar de ~500MB con node_modules completo.
  output: "standalone",

  // NOTA sobre MEDUSA_ADMIN_URL:
  //   NO está en `env:` aquí porque Next inlinea esos valores en build-time
  //   y en producción (Docker) el build se ejecuta sin acceso al runtime
  //   network alias. El código lee `process.env.MEDUSA_ADMIN_URL` directo,
  //   que server-side se resuelve correctamente desde la env del container.

  // Hardening de headers — el panel es admin, no debe ser indexado ni
  // embedded en frames externos.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ]
  },
}

export default nextConfig
