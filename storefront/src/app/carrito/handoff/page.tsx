/**
 * Cart handoff endpoint.
 *
 * Used by the WhatsApp bot (Dana) when a customer who's been building a
 * cart over chat turns out to be in `nacional` (outside Valencia) — we
 * can't ship inmediato so the rest of the order has to finish via the
 * web checkout. Instead of asking the customer to rebuild the cart by
 * hand on the site (the original behavior, which was a real friction
 * point — see GitHub issue + chat with +584243354235), Dana now passes
 * the existing cart_id through this endpoint, which:
 *
 *   1. Validates the cart_id loosely (presence + safe shape)
 *   2. Writes it to the same localStorage key the storefront uses
 *      (`ryo_cart_id`) so the cart shows up on the next page
 *   3. Redirects to /carrito where the customer can review + checkout
 *
 * Why localStorage and not a cookie: the storefront's existing cart
 * client (storefront/src/lib/cart.ts) reads/writes localStorage, not
 * cookies, so the cookie wouldn't be picked up. Setting it server-side
 * isn't possible from a Next route handler — we have to render a page
 * that runs JS in the browser.
 *
 * Hardening:
 *   - cart_id format must match Medusa's standard (\`cart_xxx\` text);
 *     anything that doesn't smells like an injection attempt and we
 *     bounce to /carrito with no localStorage write.
 *   - The localStorage write happens before any redirect so even if
 *     the redirect is blocked, the cart is already attached.
 *   - Inline script is the only way to do this in a server component;
 *     it's clearly attributed and CSP-allowed via the existing
 *     storefront config.
 */

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cargando tu carrito… — Enrola",
  // Don't index this — it's a one-shot redirect page.
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ cart_id?: string }>
}

const CART_ID_RE = /^cart_[A-Za-z0-9]{20,}$/

export default async function CartHandoffPage({ searchParams }: PageProps) {
  const params = await searchParams
  const raw = (params.cart_id || "").trim()
  const safeCartId = CART_ID_RE.test(raw) ? raw : ""

  // The script runs once on hydration. We pre-encode the cart id as a
  // JSON string so we don't have to think about quoting. If safeCartId
  // is empty (missing or invalid input), we skip the localStorage write
  // and just redirect to /carrito where the user gets the empty cart.
  const inlineScript = `
    (function () {
      var id = ${JSON.stringify(safeCartId)};
      try {
        if (id) localStorage.setItem("ryo_cart_id", id);
      } catch (e) {
        // localStorage blocked (Safari private mode etc.) — fall through.
      }
      window.location.replace(id ? "/carrito" : "/carrito");
    })();
  `

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
        Cargando tu carrito…
      </p>
      <p style={{ fontSize: "0.9rem", color: "#666" }}>
        Si no se redirige automáticamente,{" "}
        <a href="/carrito" style={{ color: "#FF3B27" }}>
          haz click aquí
        </a>
        .
      </p>
      <script
        // dangerouslySetInnerHTML is the documented Next.js pattern for
        // inline scripts in server components.
        dangerouslySetInnerHTML={{ __html: inlineScript }}
      />
    </main>
  )
}
