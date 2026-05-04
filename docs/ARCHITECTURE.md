# Architecture

This document captures the **why** of the major architectural decisions in
this repo. The how is in code; the what is in `README.md` / `CLAUDE.md`.

If you make a non-trivial architectural decision, update this file in the
same PR. Future-you (and future AI sessions) will thank you.

---

## High level

```
                                 ┌──────────────┐
                                 │  Cloudflare  │ (DNS, WAF, cache)
                                 └──────┬───────┘
                                        │
                          ┌─────────────┴─────────────┐
                          │                           │
                  enrola.shop                 api.enrola.shop
                  (storefront)              (medusa backend +
                          │                  embedded admin)
                          │                           │
                          └────────────┬──────────────┘
                                       │
                              ┌────────┴────────┐
                              │                 │
                          ┌───┴────┐       ┌────┴────┐
                          │ Hostinger VPS  │  Docker │
                          │  72.60.114.242 │ Compose │
                          └────────┬───────┴────┬────┘
                                   │            │
                          ┌────────┴───┐  ┌─────┴──────┐
                          │ PostgreSQL │  │ instagrapi │
                          │     16     │  │   worker   │
                          └────────────┘  └────────────┘
```

Single VPS, single Docker Compose stack. Not built for high availability —
built for a 1-dev shop running a regional Venezuelan storefront. The
trade-offs that follow flow from that constraint.

---

## Backend: Medusa v2 + custom modules

We use [Medusa v2.13](https://docs.medusajs.com) as the e-commerce core.
Why Medusa over the alternatives:

- **Headless**: lets us run a fully custom Next.js storefront and admin UI
  without fighting the framework.
- **Module system**: easy to bolt on domain-specific modules (`finanzas`,
  `social`, `loyalty`, `seo-analytics`) without forking Medusa itself.
- **PostgreSQL native**: matches the rest of the stack, no extra services.
- **Active dev**: Medusa is well-maintained, frequent releases, good docs.

### Custom modules

Each module owns its tables, services, and admin endpoints.

#### `finanzas` (`backend/src/modules/finanzas/`)

The financial heart of the operation. Tracks every euro/bolívar/USDT that
flows through the business — not just orders, but expenses, conversions
between currencies, wallet balances, monthly closes.

Models:
- `pago_movil` (+ `pago_movil_line`): each customer payment, with COGS,
  margin, and per-line breakdown
- `expense` (+ `expense_category`): operational expenses, classified into
  buckets (restock / gastos_fijos / marketing / ganancia)
- `conversion`: explicit Bs → USDT conversions with rate snapshots
- `wallet` (+ `wallet_entry`): per-account balance ledger
- `split_rule`: how to distribute incoming revenue across buckets
- `product_cost` (+ `product_cost_history`): cost basis per variant
- `rate_snapshot`: BCV / CADIVI / parallel rate captures
- `transfer`: inter-wallet transfers
- `month_close`: archived monthly P&L

Why a custom module instead of using Medusa's built-in financial:
- Medusa's financial model is order-centric. Ours has to handle
  off-platform transfers, VE-specific currency dynamics, and a
  bucketed-budget mindset.
- The `pago_movil` row is the source of truth for revenue, NOT the order's
  total. Orders can change post-checkout (refunds, partial fulfillments);
  the pago_movil captures the actual money received.

#### `social` (`backend/src/modules/social/`)

Manages the Instagram + TikTok content pipeline: posts, stories,
suggestions, trends, feedback, activity log. Drives the `/admin/social`
panel and the daily-scheduler cron job.

#### `loyalty` (`backend/src/modules/loyalty/`)

Points-based loyalty program (Club Enrola). Awards on purchase + manual,
spendable on rewards. Includes a referral system (referral codes →
rewards on first purchase by referee).

#### `seo-analytics` (`backend/src/modules/seo-analytics/`)

Houses GSC/GA4/CrUX/CWV/Umami snapshots, tracked keywords, competitor
rankings, sitemap audits, and crawl errors. Driven by a battery of cron
jobs that pull from Google APIs daily.

### Conventions for adding modules

1. New module folder under `backend/src/modules/<name>/`.
2. Register in `backend/medusa-config.ts`.
3. Migration files in `<name>/migrations/Migration<YYYYMMDDHHMMSS>.ts`.
4. Service in `<name>/service.ts` extending `MedusaService(...)` with the
   models. Keep methods focused — one DB op per public method when possible.
5. Admin API routes in `backend/src/api/admin/<name>/`. One file per
   verb-noun (e.g. `expenses/[id]/mark-paid/route.ts`).
6. Admin UI in `backend/src/admin/routes/<name>/page.tsx` (full panel) or
   `backend/src/admin/widgets/<name>.tsx` (single-page widget).

---

## Storefront: Next.js 15 (App Router)

Standard Next.js storefront talking to the Medusa Store API. Notable
customizations:

- **No client-side cart**: Medusa handles the cart on the server; we use
  cookies to persist `cart_id`. Avoids most hydration drift issues.
- **Combo discount system**: a custom system for "buy X different products,
  get N% off" that bypasses Medusa's promotion module (those rules don't
  express what we need). Discounts are applied as line-item adjustments
  via `POST /store/carts/:id/recalculate-combos` and recomputed on every
  cart mutation.
- **Cédula validation**: Venezuelan customers identify by national ID
  (cédula). The storefront calls our `/store/cedula-cache` proxy which
  hits `cedula.com.ve` with a local DB cache fallback, since the official
  CNE site (`cne.gob.ve`) isn't reachable from outside Venezuela.

---

## Operator panel: Next.js 15 (separate from Medusa admin)

`panel/` is a custom operator panel built specifically for the warehouse
team and customer service. They use it instead of the Medusa admin
because:

- Medusa admin assumes technical literacy. The team wanted simpler
  workflows: "show me today's orders", "click here to mark shipped".
- Mobile-first: warehouse staff use phones. Medusa admin doesn't render
  well on small screens.
- Spanish-only by design.

The panel reads/writes through the same Medusa Store + Admin APIs. It
shares auth via the Medusa user token (cookie-based).

---

## Communication channels

- **Email**: outbound via [Resend](https://resend.com) (`hola@enrola.shop`
  sender, configured by Resend domain). Inbound via the dockerized
  Postfix+Dovecot mailserver in `mail/`. Customers can reply to any
  transactional email and the operator sees it in `/admin/webmail`.
- **WhatsApp**: outbound via [WaSenderAPI](https://wasenderapi.com), an
  unofficial gateway that proxies a real WhatsApp account (the owner's).
  We use `@s.whatsapp.net` JID format, never `@lid` (caused silent
  delivery failures previously).
- **Telegram**: a bot listens at `/api/webhooks/telegram` and drives the
  manual-sale flow + MRW receipt upload. Operator sends commands like
  `/venta`, replies with photos for comprobantes.
- **Instagram + TikTok**: outbound publishing via Buffer.com integration
  + the `instagrapi-worker` Python container for actions Meta Graph API
  doesn't expose (insights for non-business accounts, trend detection).

---

## Deploy: Docker Compose on a single VPS

The whole stack runs on a single Hostinger VPS (`srv977695`,
`72.60.114.242`):

```yaml
services:
  postgres        → PostgreSQL 16
  redis           → fake redis (in-memory) — never enabled real redis,
                    Medusa works fine without it for our scale
  medusa          → Medusa backend (port 9000) + embedded admin
  storefront      → Next.js storefront (port 3000)
  instagrapi-worker → Python container for Instagram private API
  mailserver      → Postfix + Dovecot (ports 25/465/587/143/993)
```

Docker volumes hold:
- `medusa_uploads` — receipt photos (mrw-receipts, wa-proofs, payment-proofs)
- `postgres_data` — DB
- `mail_data` — IMAP mail storage

These volumes are **not in the repo** and never touched by `git pull`.
That's a deliberate decision — see `CLAUDE.md` and `.gitignore`.

### Why a single VPS

- Cost: ~$15/month vs ~$80+ for an equivalent multi-service AWS setup.
- Latency: Hostinger's Lithuania DC is faster to LATAM than US-East AWS
  (counterintuitive but verified).
- Operational simplicity: a 1-dev shop benefits more from "one place to
  log in" than from distributed-systems best practices.

### When to outgrow this

- When daily orders consistently exceed 200 → start splitting database
  to managed Postgres (RDS or Hostinger's managed offering).
- When the team grows past 3 → introduce branch protection in earnest +
  required reviews + a staging environment.
- When mailserver volume causes Postfix to queue → move to a dedicated
  email service (still keeping Resend for transactional outbound).

---

## Notable Venezuela-specific architectural decisions

### 1. We can't reach `mrw.com.ve` from the VPS

MRW Venezuela's website returns NXDOMAIN from any non-VE DNS resolver.
We tried Cloudflare DNS, Google DNS, the major public resolvers, and
direct queries to CANTV/Movistar VE DNS servers (those time out from
non-VE IPs). No combination works.

**Decision**: MRW shipment tracking is currently operator-driven (manual
"mark arrived" + "mark delivered" buttons in the admin). Auto-polling is
deferred until we set up a VE residential proxy (IPRoyal or similar).
The customer-facing notification flow (WhatsApp + email) is the value;
the polling is the convenience.

### 2. Cédula API must be cached locally

`cedula.com.ve` (paid API) has a 200/hour rate limit. We cache responses
in Postgres (`cedula_cache` table) so identical queries within 30 days
don't hit the upstream.

`cne.gob.ve` (free, official) is similarly geofenced — same problem as
MRW. We don't use it.

### 3. Currency is hard

Three currencies coexist:
- **EUR**: pricing currency on the site (because we sell into Spain too)
- **Bs (bolívares)**: actual payment currency for VE customers
- **USDT**: working capital currency for the operator

Conversion rates change daily and have a wide spread. The `finanzas`
module's `rate_snapshot` model captures BCV (official), CADIVI (parallel
1), and "paralelo" (parallel 2) rates several times per day via cron.
Order amounts are stored in EUR; payment captures (`pago_movil`) record
the actual Bs paid + the rate at the moment + the equivalent USDT.

Display logic must always be currency-aware. Hardcoded `$` symbols
should not exist anywhere.

---

## What's intentionally NOT in this repo

- **Customer data**: photos, KYC artifacts, payment proofs. These live in
  Docker volumes on the VPS. They're protected by VPS access control,
  not by git.
- **Production secrets**: env vars are configured directly on the VPS in
  `/root/ryo-store/.env` (gitignored). The local `.env.template` shows
  the keys but never the values.
- **Build artifacts**: `.next/`, `.medusa/`, `node_modules/` are
  regenerated on every deploy.
- **Conversation logs**: AI session dumps (CONTEXTO_*.md, RESUMEN-*.md)
  are useful as scratch but aren't in the repo. Future agents read
  `CLAUDE.md` and `docs/` instead.

---

_Last updated: 2026-05-04 — initial GitHub-flow migration._
