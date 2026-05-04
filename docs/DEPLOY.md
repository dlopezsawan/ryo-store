# Deploy runbook

How code gets from your laptop to https://api.enrola.shop.

> **TL;DR**: merge a PR to `main` → GitHub Actions → VPS rebuilds → live.
> Time: ~5 minutes end-to-end. Manual ops: zero.

---

## The standard flow

```
local            GitHub                    VPS (srv977695)
───────         ─────────                 ─────────────────

git push    →  PR created
git pr review  PR reviewed                
gh pr merge →  main updated         
                ↓
                Actions: deploy.yml triggered
                ↓
                ssh ──────────────────────→  cd /root/ryo-store
                                              git pull --hard
                                              docker compose build
                                              docker compose up -d
                                              docker image prune
                                              health check
                ↓
                workflow run finishes (✓ or ✗)
                ↓
                Slack notification (when configured)
```

Workflow file: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

## Triggers

| Trigger | Source | When |
|---|---|---|
| `push` to `main` | merging a PR | normal happy path |
| `workflow_dispatch` | `gh workflow run deploy.yml` or the Actions UI | hot-fix, re-deploy without code change, post-VPS-restart |

## What the workflow does

1. **Stash uncommitted work on the VPS.** If an operator was hand-editing
   files on the box (we strongly discourage this, but it happens), the
   stash preserves their work. Recoverable via `git stash list`.
2. **Hard reset to `origin/main`.** No merge dance — the deployed state
   should always be exactly what's on `main`. If the VPS has diverged,
   we treat that as a problem to investigate later, not a rebase to
   resolve in CI.
3. **Build the Docker images.** Uses BuildKit cache when possible. Cold
   builds take ~5 min (npm install dominates); warm builds 30-90s.
4. **Recreate containers.** `docker compose up -d` triggers a rolling
   restart of `medusa` and `storefront`. PostgreSQL and the mailserver
   stay up.
5. **Prune dangling images.** Keeps VPS disk usage bounded.
6. **Health probe.** Polls `localhost:9000/health` for up to 60s and
   reports the result. Doesn't fail the workflow on a missing health
   endpoint (Medusa returns 404 there but the process is still alive).

## Required GitHub secrets

| Name | Value | Purpose |
|---|---|---|
| `VPS_HOST` | `72.60.114.242` | VPS IPv4 |
| `VPS_USER` | `root` | SSH user |
| `VPS_SSH_KEY` | ed25519 private key | private half of the deploy key (paired with the public key in `/root/.ssh/authorized_keys` on the VPS) |

To rotate the deploy key:

```bash
# Local
ssh-keygen -t ed25519 -f .deploy-keys/ryo-store-deploy -N "" -C "github-actions-deploy@ryo-store"

# Add public key to VPS
cat .deploy-keys/ryo-store-deploy.pub | \
  ssh root@72.60.114.242 'cat >> ~/.ssh/authorized_keys'

# Replace GitHub secret
gh secret set VPS_SSH_KEY < .deploy-keys/ryo-store-deploy --repo dlopezsawan/ryo-store

# Remove old key from VPS authorized_keys (manually: edit and delete the
# old line that doesn't match this new one)

# Cleanup local
rm -rf .deploy-keys/
```

## Manually triggering a deploy

```bash
# From any branch (the workflow always uses main):
gh workflow run deploy.yml --repo dlopezsawan/ryo-store

# Watch the run
gh run watch --repo dlopezsawan/ryo-store
```

## When the deploy fails

Most failures fall into 3 buckets:

### 1. Build failure (TS errors, missing deps, npm install hang)

Symptoms: workflow stops at the "build" step. Logs show TS errors or
`npm install` timing out.

Fix: pull the relevant change locally, run `npx medusa build` to
reproduce, fix, push a new commit. Don't push directly to main; create a
PR even if it's a one-line fix.

### 2. Container won't start

Symptoms: build succeeds but health check fails. `docker compose ps`
shows the service in restart loop.

Investigate on the VPS:

```bash
ssh root@72.60.114.242
cd /root/ryo-store
docker compose logs --tail 100 medusa
docker compose ps
```

Common causes:
- Missing migration: `docker exec ryo-store-medusa-1 npx medusa db:migrate`
- Missing env var: check `/root/ryo-store/.env` and `/root/ryo-store/backend/.env`
- Port conflict: `docker compose down && docker compose up -d`

### 3. SSH/auth failure

Symptoms: workflow fails immediately at the SSH step with "Permission
denied".

Likely causes:
- Deploy key was rotated on the VPS but not in GitHub secrets (or vice
  versa). Re-run the rotation steps above.
- VPS firewall is blocking GitHub Actions IP ranges. Check
  `ufw status` on the VPS; port 22 should be open.

## Manual deploy (emergency only)

If GitHub Actions is down or you need to deploy something faster than
the PR cycle allows:

```bash
ssh root@72.60.114.242
cd /root/ryo-store
git fetch origin
git log origin/main..HEAD          # see if you have unpushed local changes
git reset --hard origin/main       # destructive — be sure
docker compose build medusa storefront
docker compose up -d medusa storefront
docker compose ps
```

**After an emergency manual deploy, file a follow-up PR** documenting
what happened and why CI was bypassed. We never want this to become the
norm.

## Rollback

If a deploy causes a production issue:

```bash
# Option A: revert the merge commit on main, push, let CI redeploy
git checkout main
git revert -m 1 <merge-commit-sha>
git push origin main

# Option B (faster): on the VPS, pin to the previous commit
ssh root@72.60.114.242
cd /root/ryo-store
git log --oneline -5             # find the last good commit
git reset --hard <good-sha>
docker compose build medusa storefront
docker compose up -d
# then file a revert PR on GitHub so main reflects reality
```

Option A is correct in 99% of cases. Option B is for "site is on fire"
moments where the 5-minute CI cycle is too slow.

## Smoke tests after every deploy

```bash
curl -sI https://api.enrola.shop/health | head -3   # backend
curl -sI https://enrola.shop | head -3              # storefront
curl -sI https://api.enrola.shop/app | head -3      # admin
```

A healthy deploy returns 200 (or 404 for `/health` since we don't have a
real one) on all three. A 5xx for >30s means roll back.

---

_Last updated: 2026-05-04 — initial GitHub-flow migration._
