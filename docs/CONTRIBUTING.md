# Contributing

How to make changes to this repo without breaking things.

## The rules

1. **`main` is sacred.** No direct pushes. Branch protection enforces
   this. All changes via PR.
2. **One feature per PR.** Small, focused, reviewable.
3. **Conventional Commits** for commit messages.
4. **Test plan in every PR.** Specific scenarios, not "manual testing".
5. **CI must pass.** Don't merge red.
6. **Don't commit secrets.** `.env*`, `.claude/`, `.deploy-keys/` are
   gitignored. If something else looks risky, gitignore it.

## Branch naming

`<type>/<short-kebab-description>`

| Type | When to use |
|---|---|
| `feat/` | New feature, new endpoint, new module |
| `fix/` | Bug fix |
| `chore/` | Dependency bumps, gitignore tweaks, infra |
| `docs/` | Docs-only changes |
| `refactor/` | Code reorganization, no behavior change |
| `perf/` | Performance improvement |
| `test/` | Test additions/fixes only |

Examples:
- `feat/mrw-auto-tracking-via-vpn-proxy`
- `fix/cedula-cache-stale-after-30d`
- `chore/bump-medusa-to-2-14`

## Commit messages

Conventional Commits format:

```
<type>(<scope>): <imperative description>

<longer body — optional but encouraged for non-trivial changes>

<optional footer: BREAKING CHANGE: ..., Closes #123, etc.>
```

The body is for the **why**. The diff already shows the what.

Good:

```
feat(orders): MRW shipment tracking with QR auto-decode

QR-decoding the receipt photo from Telegram is more reliable than asking
operators to type tracking numbers — they were skipping that step ~40%
of the time, leaving us blind to delivery status.

Uses jsqr+jimp (pure JS, no native deps). Falls back to a manual entry
field in the admin widget when the QR can't be read (5-10% of photos
based on smoke testing).
```

Bad:

```
add stuff
```

## PR guidelines

Before opening:

- [ ] Branch is up to date with `main` (`git fetch && git rebase main`)
- [ ] Local TS check passes: `cd backend && npx tsc --noEmit`
- [ ] Local build passes (if you modified anything that affects build):
      `cd backend && npx medusa build`
- [ ] Smoke-tested locally OR documented why local testing wasn't possible

The PR description should fill in the [PR template](../.github/PULL_REQUEST_TEMPLATE.md):

- **Summary**: 1-3 sentences. The reader is busy.
- **Changes**: bulleted list of meaningful changes (not "fixed typo").
- **Why this approach**: for non-obvious decisions only.
- **Test plan**: specific scenarios with expected behavior.
- **Deploy notes**: env vars, migrations, feature flags, anything special.
- **Follow-ups**: TODOs explicitly NOT in this PR.

## Code style

- TypeScript strict mode is on. Don't disable it for individual files
  without a comment explaining why.
- Prefer adding to existing files over creating new ones. The repo has
  natural homes for most concepts.
- Comments explain **why**, not what. The code shows what.
- For large data flows (orders, payments, inventory), trace the path
  carefully — there are subtle assumptions baked in (e.g. `pago_movil`
  is the source of truth for revenue, not `order.total`). Read
  `docs/ARCHITECTURE.md` first.

## Adding a new module

If you're adding a new domain (e.g. `inventory-v2`), follow this pattern:

1. Create `backend/src/modules/<name>/` with:
   - `index.ts` — module definition
   - `service.ts` — business logic
   - `models/` — entities
   - `migrations/` — schema migrations
   - `lib/` — internal helpers
2. Register the module in `backend/medusa-config.ts`.
3. Add admin API endpoints under `backend/src/api/admin/<name>/`.
4. Add admin UI under `backend/src/admin/routes/<name>/page.tsx` or as
   widgets under `backend/src/admin/widgets/`.
5. Document the module in `docs/ARCHITECTURE.md`.
6. Open a PR titled `feat(<name>): introduce <name> module — <short desc>`.

## Adding a new cron job

1. New file: `backend/src/jobs/<job-name>.ts`
2. Export `default async function ({ container })` and `export const config = { name, schedule }`.
3. Test locally by manually invoking via the dev admin's "Run job" button
   (`/admin/dev` panel).
4. Document in `docs/ARCHITECTURE.md` if the job is non-obvious.

## Working with AI agents

This repo is set up for AI-assisted dev (Claude Code, Cursor, Codex).
Read [`CLAUDE.md`](../CLAUDE.md) at the repo root for project context that
agents should ingest at session start.

When working with an AI agent on a PR:

- Let the agent read `CLAUDE.md` and the relevant `docs/` first.
- Don't paste old conversation logs as "context" — they go stale and
  pollute. The repo files are canon.
- The agent should follow the same PR rules as a human: no direct main
  pushes, focused PRs, real test plans.

## Reporting issues

GitHub Issues for anything code-related. Tag with the relevant area
label (`area/finanzas`, `area/social`, `area/storefront`, etc.).

For private/sensitive reports (credentials accidentally exposed,
customer data leaks): email dlopezsawan@gmail.com directly.

---

_Last updated: 2026-05-04 — initial GitHub-flow migration._
