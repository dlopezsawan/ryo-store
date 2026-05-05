# WHITELABEL — Onboarding Script for a New Project Based on This Stack

> **For the human reading this:** drop this file into a fresh Claude session
> and ask it to "begin the whitelabel onboarding." Claude will follow the
> protocol below: ask you a structured set of questions about the new
> project, then produce a tailored plan to fork and customize this stack.
>
> **For Claude reading this:** this file is your operating manual. It tells
> you what stack you're working with, what to ask, and how to translate
> the answers into a concrete migration plan. Follow Section 0 strictly.

---

## Section 0 — Claude, start here

You have just been handed a **whitelabel onboarding** for a project based
on the **Enrola Shop / RYO Store** stack (a Medusa v2 + Next.js
e-commerce + operations platform; full architecture in
`docs/ARCHITECTURE.md` of the source repo).

Your job is **not** to start writing code. Your job is to:

1. **Acknowledge** the user's intent in 1-2 lines (don't summarize this
   whole file back to them — they wrote it).
2. **Run the interview** in Section 3, one question at a time. Wait for
   answers between groups; do not dump all questions at once.
3. **Build a tailored plan** using Sections 4 and 5. Show it to the user
   for confirmation before any forking / cloning / writing.
4. Only after confirmation, execute the steps in Section 6.

Do **not**:

- Assume the new project is also e-commerce — ask.
- Assume the new project is in Spanish or Venezuela — ask.
- Recommend keeping every module by default. The default is **strip
  down**, then add back only what the user explicitly wants.
- Skip the interview. Even if the user says "just set it up," ask the
  minimum-viable questions (project name, country, what they sell,
  payment methods).

---

## Section 1 — What's actually in this stack

This is honest inventory. Some of it is generic and reusable; some of it
is hard-baked for Venezuelan operations and will be useless or
counter-productive in another context.

### 1.1 Top-level repository layout

```
backend/        Medusa v2 backend (the e-commerce + ops engine)
storefront/     Next.js 15 customer-facing site
panel/          Next.js operator panel (separate from Medusa admin)
admin/          Vite + React minimal admin (one-off ops tools)
mail/           Postfix + Dovecot dockerized mailserver config
game/           Side project: pixel-art mini-game (skip for new projects)
docs/           Architecture, runbooks, audits
.github/        CI workflow + Dependabot + PR template
docker-compose.yml
```

For a brand new project most of this is reusable. **`game/` is
project-specific and should be deleted on fork.** `mail/` is optional —
keep only if the new project genuinely wants self-hosted IMAP/SMTP.

### 1.2 Backend custom modules (`backend/src/modules/`)

Four custom Medusa modules sit on top of stock Medusa:

| Module | What it does | Generic? |
|---|---|---|
| `finanzas` | Custom multi-currency P&L, expenses, wallets, monthly closes, BCV/parallel rate snapshots, pago_movil bookkeeping. **Designed for Venezuela's EUR/Bs/USDT triple-currency reality.** | **No.** Strip unless the new project needs the same triple-currency complexity. |
| `loyalty` | Points-based loyalty program, referrals, rewards catalog. | **Yes.** Reusable for any retail/F&B/services project. |
| `social` | Instagram + TikTok content pipeline (kanban, suggestions, trends, scheduled publish via Buffer + instagrapi). | **Yes**, but heavy. Strip if the new project doesn't actively manage social. |
| `seo-analytics` | GSC + GA4 + CrUX + Umami snapshots, keyword tracking, competitor rankings. | **Yes**, but only valuable if the new project takes SEO seriously. |

### 1.3 Cron jobs (`backend/src/jobs/`) — 25+ scheduled tasks

Grouped by purpose:

- **Customer lifecycle (universal):** abandoned-cart, post-purchase,
  birthday-emails, win-back, graduation, pending-payment,
  fulfillment-delay, restock, stockout-alert
- **Finanzas (VE-specific):** finanzas-rate-snapshot,
  finanzas-recurring-expenses
- **SEO:** seo-alerts-compute, seo-cwv-sync, seo-gsc-sync,
  seo-ga4-sync, seo-monthly-snapshot, seo-sitemap-check
- **Social:** social-daily-scheduler, social-trends-refresh
- **WhatsApp bot:** whatsapp-cross-sell-rebuild,
  whatsapp-health-check, whatsapp-post-purchase-followup,
  whatsapp-recovery, whatsapp-restock-reminder, whatsapp-session-cleanup
- **Remarketing:** remarketing-engine

For a new project, **delete all of these on fork** and only restore the
ones explicitly chosen during the interview. Cron jobs that fire in
production with stale logic are a tax.

### 1.4 Operator panel (`panel/`) — 19 sections

`activity, catalog, customer-groups, customers, dashboard, finanzas,
inventory, locations, loyalty, marketing, orders, products, reports,
returns, settings, shipping, social, webmail`

Most of these are useful for any e-commerce or services business.
Sections that are project-specific:

- **`finanzas`** — Venezuela-specific currency tracking. Strip unless
  needed.
- **`webmail`** — only useful with the self-hosted mailserver. Skip if
  the new project uses Resend/SendGrid for outbound only.
- **`social`** — strip unless the new project actively needs to manage
  Instagram/TikTok.

### 1.5 Storefront (`storefront/`) — Spanish-first, VE-customized

The storefront is a Next.js 15 site. Generic e-commerce flow (catalog,
cart, checkout, account) wraps a lot of VE-specific behavior:

- **Cédula validation** during checkout (Venezuelan national ID)
- **BCV rate display** in checkout (Bs equivalents)
- **Pago Móvil checkout flow** (custom payment method)
- **MRW shipping integration** (Venezuelan courier)
- **Spanish-only copy throughout**

If the new project is in another country or speaks another language,
treat the storefront as a **reference**, not a fork. Better to clone the
boilerplate Next.js + Medusa storefront from Medusa's official template
and only port the bits the new project genuinely needs.

### 1.6 Integrations / external dependencies

| Service | Used for | Cost |
|---|---|---|
| Resend | Outbound transactional email | Free tier ok for low volume |
| WaSenderAPI | WhatsApp messages (unofficial gateway) | ~$10/mo |
| Telegram Bot API | Manual sale flow + receipt photos | Free |
| Buffer | Social scheduling | Paid plan |
| instagrapi | Instagram private API (Python worker) | Free, unofficial |
| Listmonk | Email marketing campaigns (self-hosted) | Free, self-hosted |
| PostHog | Product analytics + feature flags | Free tier or paid |
| cedula.com.ve | Venezuelan ID lookup | Paid (~$20/mo) |
| alcambio.app | EUR/USD/USDT rate snapshots | Free GraphQL |

For a new project, **default to dropping all of these** and add back
based on interview answers.

### 1.7 Infrastructure pattern

- Single VPS, Docker Compose
- Traefik for routing + Let's Encrypt TLS
- PostgreSQL 16 + (fake) Redis
- GitHub Actions auto-deploy on merge to `main`
- Branch protection requires CI green before merge
- Dependabot for weekly dep updates

This pattern **scales perfectly to a new project** — it's the simplest
solid setup for a 1-3 dev team running a single-VPS workload. Fork
`.github/workflows/`, the Dockerfile, and docker-compose.yml as-is, then
strip services the new project doesn't use.

---

## Section 2 — Reusable vs strip-out decision summary

Before the interview, internalize this triage:

### Always keep (universal value)
- Medusa v2 core + admin
- Next.js storefront skeleton (fork-then-strip, don't rewrite)
- Operator panel skeleton + auth + sidebar + topbar
- Customer / order / product / inventory CRUD
- Loyalty module (points + referrals)
- Customer-lifecycle cron jobs (abandoned-cart, post-purchase,
  birthday, win-back, etc.)
- Auto-deploy CI/CD pattern
- Email service abstraction (Resend wrapper)
- Branch protection + PR template + Dependabot config

### Conditionally keep (depends on project)
- Social module + Buffer + instagrapi worker
- SEO module (GSC, GA4, CrUX integration)
- WhatsApp bot
- Telegram bot (manual sale flow)
- Self-hosted mailserver
- Listmonk email marketing
- Multi-warehouse / locations
- Operator panel sections beyond the basics

### Always strip (Venezuela-specific or one-off)
- `finanzas` module (triple-currency, BCV, pago_movil)
- Cédula validation
- MRW shipping integration
- BCV rate displays in storefront
- `game/` directory
- Spanish-only copy hardcoded (the i18n approach is not yet
  multi-language-clean — the new project will need to either fork
  Spanish-only or do an i18n pass)
- `cedula-cache` lib
- `fx-rates` lib (Venezuela exchange rate fetching)

---

## Section 3 — The interview (ask one group at a time)

Ask these in order. Wait for answers between groups. **Do not dump all
groups in one message.** The user is a human; respect their typing time.

### Group A — The basics

1. **Project name** + **brand colors** (or a quick description of the
   visual identity, e.g. "warm earthy, like a specialty coffee shop")
2. **What does the business sell or do?** One paragraph is enough.
3. **What country / region?** (drives currency, language, shipping,
   payment method choices)
4. **What language for customer-facing copy?**

### Group B — Order flow

5. **How do customers order?** (web, in-person, phone, all of the above)
6. **What payment methods?** (card, cash on delivery, bank transfer,
   crypto, etc.)
7. **How are orders fulfilled?** (delivery, pickup, dine-in, mix)
8. **Do you ship physical goods?** If yes, **what courier**? If no
   (services, dine-in, pickup), much of the shipping module can be
   stripped.

### Group C — Operations

9. **Single location or multi-location?** (drives whether to keep the
   `locations` panel section + warehouse logic)
10. **Inventory tracking?** (yes / no / per-location / global)
11. **Team size on operator side?** (1 person / small team / larger
   team affects panel UX choices)
12. **Loyalty program needed?** If yes, points-based or punch-card-style
    or referral-only?

### Group D — Marketing / channels

13. **Social media management in-app?** (Instagram, TikTok, both,
    neither)
14. **WhatsApp ordering channel?**
15. **Email marketing campaigns?** If yes, **scale**: a few hundred
    contacts (Resend is fine) or thousands+ (Listmonk needed)?
16. **SEO importance?** (low — local business / medium — niche brand /
    high — content-driven traffic)

### Group E — Tech & infra

17. **Where will it be hosted?** (Hostinger VPS like enrola, or other?)
18. **Domain ready?** (so we know what to substitute)
19. **Existing logo + brand assets?** (or do they need to be created)
20. **Single dev or team?** (drives branch protection strictness +
    CODEOWNERS)

After this group, summarize what you understood **before proposing the
plan**. Let the user correct misunderstandings.

---

## Section 4 — Decision matrix (apply after the interview)

Based on the interview answers, decide:

### Modules

| If user said... | Keep | Strip |
|---|---|---|
| Selling food / services / dine-in | loyalty | finanzas, complex shipping |
| Selling physical goods cross-border | shipping basic | finanzas (unless multi-currency) |
| No social channels in-app | — | social, instagrapi-worker |
| No WhatsApp orders | — | whatsapp/* jobs, WaSenderAPI integration |
| Single location | — | locations, multi-warehouse |
| Tiny team | — | webmail, complex panel sections |
| English-only | — | cédula, BCV, pago_movil |

### Cron jobs

By default delete ALL jobs from `backend/src/jobs/` and re-add ONLY the
ones backed by an explicit "yes" in the interview:

| Job | Triggered by |
|---|---|
| abandoned-cart, post-purchase, birthday, win-back, graduation | "yes, customer lifecycle emails" |
| pending-payment, fulfillment-delay, restock, stockout-alert | "yes, order ops automation" |
| seo-* (6 jobs) | SEO importance ≥ medium AND Google account ready |
| social-daily-scheduler, social-trends-refresh | social management = yes |
| whatsapp-* (6 jobs) | whatsapp ordering = yes |
| finanzas-* | only if Venezuela-style triple-currency |
| remarketing-engine | "yes, advanced remarketing" |

### Storefront / panel

- Always keep: catalog, cart, checkout, customer account, login/register
- Strip if not selling physical: shipping, returns, devoluciones
- Strip if no loyalty answer: `cuenta/loyalty`, panel `loyalty`
- Strip social references unless explicitly kept

### Branding & copy

- Replace **`RYO`**, **`Enrola`**, **`enrola.shop`** across the codebase
- Brand strings live in 143 files (search:
  `grep -rE "RYO|Enrola|enrola\.shop" backend/src panel/src storefront/src`)
- Storefront `config/brand.ts` is the central place for visible copy
- Replace logo files in `storefront/public/`, `panel/public/`,
  `backend/static/branding/`
- Update Tailwind theme in `storefront/tailwind.config.ts` and
  `panel/tailwind.config.ts`

### Spanish copy

If the new project is in another language, this is the single biggest
effort:

- ~3000-5000 lines of Spanish copy in components and emails
- Decision tree:
  - **Same language (Spanish):** straight rebrand, fastest path
  - **Different language but same script (English/Portuguese):** clone
    + manual rewrite is realistic for a small business (~1-2 weeks)
  - **Need real i18n:** plan a 2-3 week refactor pass to
    [next-intl](https://next-intl-docs.vercel.app) before any business
    logic changes

---

## Section 5 — Customization checklist (per fork)

After the interview, walk the user through these. Show progress as you
go; don't try to do all in one shot.

### Phase 1 — Repo setup (30 min)

1. Fork the source repo (`github.com/dlopezsawan/ryo-store`) into the
   user's GitHub account / org with the new project name.
2. Update `package.json` `name` fields in `backend/`, `storefront/`,
   `panel/`.
3. Generate fresh secrets: `JWT_SECRET`, `COOKIE_SECRET`,
   `PANEL_SESSION_SECRET` (each `openssl rand -base64 48`).
4. Replace `CLAUDE.md`, `README.md`, `docs/ARCHITECTURE.md` with
   project-specific copy. Strip Venezuela-specific notes.

### Phase 2 — Strip what's not used (1-2 hours)

5. Delete the `game/` directory (it's RYO-specific).
6. Delete unused backend modules (`backend/src/modules/<module>/`) +
   their migrations + their admin routes (`backend/src/admin/routes/`)
   + their API routes (`backend/src/api/admin/<module>/`).
7. Delete unused cron jobs from `backend/src/jobs/`.
8. Delete unused panel sections from `panel/src/app/(panel)/`.
9. Delete unused storefront pages from `storefront/src/app/`.
10. Strip `medusa-config.ts` to only register modules you kept.
11. Strip `docker-compose.yml` services not used (instagrapi-worker,
    listmonk, mailserver if not kept).

### Phase 3 — Rebrand (1-2 hours)

12. Global find-replace `RYO` → new brand, `Enrola` → new brand,
    `enrola.shop` → new domain. Be careful with case variations.
13. Replace logo + favicon files in all three apps.
14. Update Tailwind theme colors.
15. Update brand config in `storefront/src/config/brand.ts`.
16. Update SEO defaults in `storefront/src/app/layout.tsx` (title,
    description, OG image).

### Phase 4 — Adapt copy (variable)

17. Storefront copy: every `*.tsx` page — translate or rewrite.
18. Email templates in `backend/src/lib/email-service.ts` — adapt
    voice + brand.
19. Bot messages (if WhatsApp/Telegram kept) — rewrite.
20. Storefront FAQ, terms, privacy, returns pages.

### Phase 5 — Wire up integrations (variable)

21. Resend: add API key, verify sending domain.
22. PostHog (if kept): create new project, swap `NEXT_PUBLIC_POSTHOG_KEY`.
23. Whichever integrations the interview said yes to — set up
    accounts, add env vars.

### Phase 6 — Deploy (1 hour)

24. Set up VPS (Hostinger or other), install Docker + Compose.
25. Generate deploy SSH key, add to VPS `authorized_keys`.
26. Set GitHub secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.
27. Adapt `.github/workflows/deploy.yml` if VPS path differs.
28. Configure DNS for new domain.
29. First deploy: SSH manually clone the repo + create `.env`, then
    let CI take over.

### Phase 7 — Hand-off

30. Test the whole flow: customer signs up → orders → operator sees
    in panel → marks fulfilled → customer gets email.
31. Document anything project-specific in `CLAUDE.md` so future
    sessions inherit context.

---

## Section 6 — How Claude should execute

After the interview is done **and the user has confirmed the plan**:

1. **Don't do everything at once.** Break the work into PRs with the
   same conventional-commits rhythm as the source repo:
   - PR 1: fork setup + branding scaffold
   - PR 2: strip unused modules
   - PR 3: rebrand storefront + panel
   - PR 4: copy adaptation
   - PR 5: integrations
   - PR 6: deploy

2. **One feature branch per PR.** No direct pushes to `main`. Set up
   branch protection on the new repo too — this is part of the inherited
   discipline.

3. **Each PR uses the PR template** (`.github/PULL_REQUEST_TEMPLATE.md`)
   that comes with the fork. Real test plans, not "manual testing".

4. **At the end, hand the user back a one-page status doc** with:
   - What's deployed and where
   - What env vars exist
   - What integrations are wired
   - What's intentionally NOT built (so they're not surprised)

---

## Appendix A — Quick start commands (paste these to the user when they're ready)

```bash
# 1. Fork the source repo
gh repo fork dlopezsawan/ryo-store --clone --remote=false NEW_NAME

# 2. Clone the fork locally
git clone git@github.com:YOUR_USER/NEW_NAME.git
cd NEW_NAME

# 3. Read context first
cat CLAUDE.md docs/ARCHITECTURE.md docs/CONTRIBUTING.md

# 4. Local dev setup (each app)
cd backend && cp .env.template .env  # edit secrets
npm install && npm run dev

# 5. Set up the auto-deploy on the new repo (after VPS is ready)
gh secret set VPS_HOST --body 'NEW_VPS_IP'
gh secret set VPS_USER --body 'root'
gh secret set VPS_SSH_KEY < path/to/deploy_key

# 6. Enable branch protection
gh api -X PUT "/repos/YOUR_USER/NEW_NAME/branches/main/protection" \
  --input .github/branch-protection.json
```

---

## Appendix B — When to recommend NOT using this stack

Be honest with the user. This stack is **opinionated and heavy**. Tell
the user to look elsewhere if:

- They want a simple landing page + Stripe Checkout (use Vercel +
  Stripe directly)
- They have <10 SKUs and no real ops needs (Shopify Lite is faster)
- They want to manage everything from a phone with no laptop (this
  stack assumes a desktop operator panel)
- They need true multi-language i18n on day one (the storefront
  isn't structured for that without significant rework)
- They expect to scale beyond ~500 daily orders (single-VPS Docker
  Compose isn't the right shape; consider managed Postgres + multi-
  worker setup)

If any of those fit, **say so** and propose the alternative. The user's
time is more valuable than your tokens.

---

## Appendix C — File summary for Claude's quick reference

When asked "what's in the source repo", here's the cheat sheet:

```
backend/src/modules/         → 4 custom Medusa modules
backend/src/jobs/            → 27 cron job files
backend/src/lib/             → 35+ shared helpers (whatsapp, email, etc.)
backend/src/api/admin/       → 60+ admin API endpoints
backend/src/admin/widgets/   → 9 admin SDK widgets
panel/src/app/(panel)/       → 19 panel sections
storefront/src/app/          → ~25 customer-facing pages
docker-compose.yml           → 7 services
.github/workflows/           → CI build + auto-deploy
docs/                        → ARCHITECTURE, DEPLOY, CONTRIBUTING
```

That's the system. Now go interview the user.
