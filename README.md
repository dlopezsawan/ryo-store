# Enrola Shop / RYO Store

E-commerce + operations platform for **enrola.shop** (Venezuela / Spain).

| | |
|---|---|
| **Storefront** | https://enrola.shop |
| **API + Admin** | https://api.enrola.shop |
| **Stack** | Medusa v2 · PostgreSQL · Next.js · TypeScript |
| **Deploy** | Hostinger VPS · Docker Compose · GitHub Actions |

## Repository layout

```
backend/      Medusa v2 backend (custom modules: finanzas, social, loyalty, seo)
storefront/   Next.js 15 storefront
panel/        Next.js operator panel for non-technical staff
admin/        Vite + React quick-and-dirty admin
mail/         Postfix + Dovecot mailserver config
game/         Enrola Legends pixel-art mini-game
docs/         Architecture, audits, runbooks
.github/      CI workflows, PR template
```

## Getting started (local dev)

Prerequisites: Node 20+, Docker, PostgreSQL 16, `npm` (or `yarn`/`pnpm`).

```bash
# 1. Clone
git clone https://github.com/dlopezsawan/ryo-store.git
cd ryo-store

# 2. Copy env templates
cp backend/.env.template backend/.env       # then fill in secrets
cp storefront/.env.example storefront/.env.local

# 3. Start the database (Docker) + Medusa backend
cd backend
npm install
npm run db:migrate
npm run dev    # http://localhost:9000

# 4. In a second terminal, the storefront
cd ../storefront
npm install
npm run dev    # http://localhost:8000
```

For docs on the custom modules, env vars, and operational flows, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deploying

Push to `main` → GitHub Actions → VPS auto-redeploys. Manual:

```bash
gh workflow run deploy.yml
```

Full runbook: [docs/DEPLOY.md](docs/DEPLOY.md).

## Contributing

All changes via pull request. We use Conventional Commits. See
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the long version, or
the [PR template](.github/PULL_REQUEST_TEMPLATE.md) for the quick checklist.

## Working on this repo with AI agents

This repo is set up for AI-assisted development (Claude Code, Cursor,
Codex, etc.). Read [CLAUDE.md](CLAUDE.md) for the project context that
agents should ingest at session start. It's the single source of truth
for project conventions, deploy flows, and Venezuela-specific gotchas
that defaults won't cover.

## License

Proprietary — all rights reserved. Not for redistribution.
