import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Secretos de firma de tokens. NUNCA caer a un literal público ("supersecret"):
// con ese fallback cualquiera podía forjar JWTs admin/customer válidos. En
// producción fallamos al arrancar si faltan, en vez de arrancar inseguros.
const IS_PROD = (process.env.NODE_ENV || 'development') === 'production'
const JWT_SECRET = process.env.JWT_SECRET
const COOKIE_SECRET = process.env.COOKIE_SECRET
if (IS_PROD && (!JWT_SECRET || !COOKIE_SECRET)) {
  throw new Error(
    '[medusa-config] JWT_SECRET y COOKIE_SECRET son obligatorios en producción. ' +
      'Genera valores fuertes (openssl rand -hex 32) y setéalos en el .env del VPS.'
  )
}

module.exports = defineConfig({
  admin: {
    path: "/dashboard",
    backendUrl: "https://api.enrola.shop",
    vite: (config) => ({ ...config, base: "/dashboard/" }),
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      // En dev caemos a un valor local explícito (no secreto en prod por el guard de arriba).
      jwtSecret: JWT_SECRET || "dev-only-insecure-jwt-secret",
      cookieSecret: COOKIE_SECRET || "dev-only-insecure-cookie-secret",
    }
  },
  modules: [
    {
      // The finanzas module owns 16 tables (pago_movil, expenses, wallets,
      // conversions, rate snapshots, monthly closes, audit log, etc.) and
      // is the data layer for everything under /admin/finanzas/* and the
      // panel's Finanzas section.
      //
      // The module + its migrations existed for months, but at some point
      // the resolve entry got dropped from this config — leaving the
      // tables in place but the service unregistered. Result:
      // every endpoint that did `container.resolve(FINANZAS_MODULE)`
      // returned 500 ("Could not resolve 'finanzasModuleService'") and
      // the panel's Finanzas tab showed "ERROR WALLETS / medusa GET
      // /finanzas/* failed (500)" across the board.
      resolve: "./src/modules/finanzas",
    },
    {
      resolve: "./src/modules/loyalty",
    },
    {
      resolve: "./src/modules/seo-analytics",
    },
    {
      resolve: "./src/modules/social",
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: `${process.env.BACKEND_PUBLIC_URL || "https://api.enrola.shop"}/static`,
            },
          },
        ],
      },
    },
  ],
})
