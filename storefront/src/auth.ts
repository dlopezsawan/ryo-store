import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { medusaLogin, medusaRegister, medusaGetMe, medusaRefreshToken } from "@/lib/medusaAuth";

const SECRET = process.env.NEXTAUTH_SECRET || "ryo-secret-change-in-prod";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const token = await medusaLogin(credentials.email, credentials.password);
        if (!token) return null;
        const customer = await medusaGetMe(token);
        if (!customer) return null;
        return {
          id: customer.id,
          email: customer.email,
          name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email,
          medusaToken: token,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email!;
        const parts = (user.name || "").split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";
        const googleId = account.providerAccountId;
        const BACKEND_URL =
          process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
          "http://localhost:9000";
        const BRIDGE_SECRET = process.env.GOOGLE_BRIDGE_SECRET || "";

        try {
          const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";
          const res = await fetch(`${BACKEND_URL}/store/auth/google-signin`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-publishable-api-key": PUB_KEY,
            },
            body: JSON.stringify({ email, firstName, lastName, googleId, bridgeSecret: BRIDGE_SECRET }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("[Google Auth] bridge failed:", res.status, err);
            return false;
          }
          const { token } = await res.json();
          (user as unknown as Record<string, unknown>).medusaToken = token;
        } catch (err) {
          console.error("[Google Auth] bridge error:", err);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.medusaToken = (user as unknown as Record<string, unknown>).medusaToken as string;
        token.medusaTokenIssuedAt = Date.now();
        token.sub = user.id;
        return token;
      }
      // Lecturas posteriores de la sesión: mantener fresco el token de Medusa.
      // Vive 24h, pero la sesión de NextAuth dura más → sin esto el token
      // embebido expira y CADA llamada a Medusa (perfil, órdenes, guardar)
      // devuelve 401 ("no aparecen los datos" / "error al guardar").
      const issuedAt = (token.medusaTokenIssuedAt as number) || 0;
      const ageMs = Date.now() - issuedAt;
      const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000; // 6h (el token vive 24h)
      if (token.medusaToken && ageMs > REFRESH_AFTER_MS) {
        const fresh = await medusaRefreshToken(token.medusaToken as string);
        if (fresh) {
          token.medusaToken = fresh;
          token.medusaTokenIssuedAt = Date.now();
        } else {
          // No se pudo refrescar (token ya expirado) → quitarlo para que la app
          // pida re-login en vez de fallar en silencio con 401.
          delete token.medusaToken;
        }
      }
      return token;
    },

    async session({ session, token }) {
      (session as unknown as Record<string, unknown>).medusaToken = token.medusaToken;
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = token.sub;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: { strategy: "jwt" },
  secret: SECRET,
};
