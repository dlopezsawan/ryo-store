# CLAUDE.md — Project Context for AI Sessions

> **You are working on the Enrola Shop / RYO Store monorepo.** This file is
> the single source of truth that AI sessions should read first when joining
> this repository. It supersedes any context dump from a previous chat.

## What this repo is

Multi-product e-commerce + operations platform for **enrola.shop** (Venezuela
+ Spain). Built on Medusa v2 with significant custom modules. The same repo
also houses sibling projects (operator panel, mini-game, mailserver config)
that share brand identity, deploy infra, and customer data.

**Primary URL**: https://enrola.shop (storefront) · https://api.enrola.shop (API + admin)
**VPS**: Hostinger srv977695 · `72.60.114.242` · 1 instance, Docker Compose
**Stack**: Medusa v2.13 · PostgreSQL 16 · Next.js 15 (storefront + panel) ·
React + Vite (admin widgets) · Python (instagrapi-worker) · TypeScript everywhere
**Single dev**: dlopezsawan@gmail.com · Spanish (Venezuela) is the primary language

## Repository layout (top level)

```
backend/        → Medusa v2 backend (API + admin SDK widgets)
storefront/     → Next.js storefront (consumer-facing)
panel/          → Next.js operator panel (separate from Medusa admin,
                  for non-technical staff: warehouse, customer service)
admin/          → Vite + React quick-and-dirty admin (one-off tools)
mail/           → Postfix + Dovecot dockerized mailserver (hola@enrola.shop)
game/           → "Enrola Legends" pixel-art mini-game (TypeScript canvas)
stitch/         → design experiments (HTML mocks from Google Stitch)
scripts/        → top-level operational scripts (rebrand, backups, etc.)
docs/           → architecture, audits, runbooks (READ THESE on join)
```

For deeper context per area, look for area-specific `CLAUDE.md` files
(e.g. `backend/CLAUDE.md` if present).

## Critical context: what makes this codebase non-standard

**Read these before assuming defaults.**

1. **Spanish-first product**: customer-facing copy, error messages, admin
   UI labels, and bot responses are all in Spanish (Venezuela / LATAM
   tone). Default to Spanish unless explicitly working on something
   English-facing. Source code, comments, and commit messages are English.

2. **Medusa is patched, not pristine**: we have custom modules on top of
   Medusa v2 (`finanzas`, `social`, `loyalty`, `seo-analytics`) and many
   admin overrides. Don't assume vanilla Medusa behavior — check the
   `backend/medusa-config.ts` and `backend/src/modules/` first.

3. **Venezuela networking constraints**: this product operates in a country
   where many global services are blocked or unavailable. Notable:
   - `mrw.com.ve` (the courier) returns NXDOMAIN from non-VE IPs. We can't
     scrape it from the Lithuania VPS. MRW tracking is currently
     operator-driven, not auto-polled.
   - `cne.gob.ve` (cédula validation) is similarly unreachable. We use the
     `cedula.com.ve` paid API + local Postgres cache fallback.
   - WhatsApp and Telegram are the dominant communication channels — heavy
     investment in WaSenderAPI integration + Telegram bot.

4. **Custom money/currency**: Venezuela uses Bs (bolívares) but the rate
   floats wildly against EUR/USD. Order totals are in EUR; payment is in
   Bs at runtime BCV rate; reconciliation goes through "pago_movil" rows
   in the `finanzas` module. Never display "$" or assume USD as default.

5. **Manual sales matter**: a meaningful chunk of revenue comes from
   manual sales via Telegram/WhatsApp/in-person, NOT the website. The
   `metadata.manual_sale` flag and the `graduation_rate` metric exist
   because we track conversion of these customers to the web. Don't
   filter manual sales out of analytics by default — they're real.

## How to deploy

**Production deploys are automatic from `main`**. Source of truth = GitHub.

- Open a PR → review → merge to main → GitHub Actions runs
  `.github/workflows/deploy.yml` → SSH into VPS → `git pull` → `docker
  compose build` + `up -d`
- Manual re-deploy without a code change: `gh workflow run deploy.yml`
  (or click "Run workflow" on the Actions tab)
- VPS path: `/root/ryo-store` is a real git clone of `dlopezsawan/ryo-store`
  on the `main` branch. Customer data (receipt photos, payment proofs)
  lives in **Docker volumes**, not in the repo, so `git pull` is safe.

**Direct manual deploy is allowed only for emergencies** (e.g. CI broken).
Process: SSH, `cd /root/ryo-store`, `git pull`, `docker compose build`,
`docker compose up -d`. Always document the bypass in a follow-up PR.

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full runbook.

## How to contribute (the rules of engagement)

**Every change goes through a PR.** No direct commits to `main`.

1. Branch from up-to-date `main`: `git checkout main && git pull && git
   checkout -b <type>/<short-description>` where `<type>` is `feat`, `fix`,
   `chore`, `docs`, `refactor`.
2. Conventional commits: `<type>(<scope>): <imperative description>`.
   Bodies welcome and encouraged for non-trivial changes — explain *why*,
   not *what* (the diff shows what).
3. Keep PRs focused — one feature or fix per PR. The PR template guides
   the description; fill it in seriously.
4. CI must pass. Branch protection on `main` enforces this.

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the long version.

## Where to find things

| If you need... | Look at... |
|---|---|
| Architecture decisions | `docs/ARCHITECTURE.md` |
| How a feature was built | git log + the relevant docs/ entry |
| How to deploy | `docs/DEPLOY.md` + `.github/workflows/deploy.yml` |
| What's broken / planned | GitHub Issues + Notion (RYO Shop workspace) |
| Customer data layout | `backend/src/modules/finanzas/models/` and friends |
| Bot logic | `backend/src/api/webhooks/{telegram,whatsapp}/` |
| Email templates | `backend/src/lib/email-service.ts` |
| Cron jobs | `backend/src/jobs/` (24 of them; one file = one job) |

## Conventions for AI sessions specifically

When working on this repo as an AI agent:

- **Read this file first.** Don't assume context from a previous chat —
  start fresh from the docs.
- **Spanish > English for user-facing text.** Even when the user asks in
  English, customer-facing strings stay in Spanish.
- **Don't push to `main` directly.** Use feature branches + PRs. The
  branch protection rule will reject force pushes anyway.
- **Don't commit secrets.** `.env*` is gitignored; `.claude/` is
  gitignored; password-bearing strings in any settings file are
  gitignored. If you generate temp credentials (deploy keys, etc.), put
  them in `.deploy-keys/` which is also ignored.
- **Don't delete customer data.** Receipt photos, comprobantes, and
  WhatsApp media live in Docker volumes on the VPS. They're not in the
  repo and don't show up in `git status`. Treat them as untouchable.
- **Test plans are not optional.** Every PR's test plan should be
  specific (URLs, endpoints, expected behavior), not "manual testing".
- **Prefer adding to existing files over creating new ones** unless the
  new concept genuinely doesn't fit. The repo has natural homes for most
  things; use them.

## Quick smoke tests after deploys

```bash
# Backend health
curl -sI https://api.enrola.shop/health | head -3

# Storefront
curl -sI https://enrola.shop | head -3

# Admin login page
curl -sI https://api.enrola.shop/app | head -3
```

If any of these return 5xx for more than 30s, check `docker compose logs
medusa storefront` on the VPS.

---

_Last updated: 2026-05-04 (initial GitHub-flow migration). Update this file
whenever a new architectural decision lands; it's the first thing AI agents
read._
