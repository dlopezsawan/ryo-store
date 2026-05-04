#!/usr/bin/env bash
# =============================================================================
# Enrola Blueprint — Automated Rebrand Script
# =============================================================================
# Reads blueprint.config.yml, does find/replace across the codebase to rebrand
# from "Enrola" to your new brand, regenerates storefront/src/config/brand.ts
# from the config, and logs all changes to docs/REBRAND-LOG.md.
#
# Usage:
#   ./scripts/rebrand.sh blueprint.config.yml
#
# Requirements: bash 4+, python3 with pyyaml, GNU sed (macOS: brew install gnu-sed)
# =============================================================================

set -euo pipefail

# ─── Args ─────────────────────────────────────────────────────────────────────
CONFIG_FILE="${1:-blueprint.config.yml}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "❌ Config file not found: $CONFIG_FILE"
  echo "   Copy docs/blueprint.config.example.yml to blueprint.config.yml first"
  exit 1
fi

# ─── Tooling detection ────────────────────────────────────────────────────────
if command -v gsed >/dev/null 2>&1; then
  SED="gsed"
elif sed --version 2>/dev/null | grep -q "GNU"; then
  SED="sed"
else
  echo "❌ GNU sed required (macOS: brew install gnu-sed)"
  exit 1
fi

if ! python3 -c "import yaml" 2>/dev/null; then
  echo "❌ Python yaml required: pip3 install pyyaml"
  exit 1
fi

# ─── Parse config with python ────────────────────────────────────────────────
export CONFIG_FILE
load_field() {
  python3 -c "
import yaml, sys, os
with open(os.environ['CONFIG_FILE']) as f: c = yaml.safe_load(f)
keys = '$1'.split('.')
v = c
for k in keys: v = v.get(k) if v else None
print(v if v is not None else '')
"
}

BRAND_NAME=$(load_field "brand.name")
BRAND_NAME_UPPER=$(load_field "brand.nameUpper")
BRAND_SLUG=$(load_field "brand.slug")
BRAND_FULL_NAME=$(load_field "brand.fullName")
DOMAIN=$(load_field "brand.domain")
BASE_URL=$(load_field "brand.baseUrl")
API_URL=$(load_field "brand.apiUrl")
ANALYTICS_URL=$(load_field "brand.analyticsUrl")
EMAIL_CONTACT=$(load_field "brand.email.contact")
EMAIL_NOREPLY=$(load_field "brand.email.noreply")
IG_HANDLE=$(load_field "brand.social.instagram")
TIKTOK_HANDLE=$(load_field "brand.social.tiktok")

# Validation
for var in BRAND_NAME BRAND_SLUG DOMAIN BASE_URL API_URL EMAIL_CONTACT; do
  if [[ -z "${!var}" ]]; then
    echo "❌ Missing required field in config: $var"
    exit 1
  fi
done

# ─── Confirm with user ───────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  Rebrand summary (from $CONFIG_FILE)"
echo "══════════════════════════════════════════════════════════════════════"
printf "  %-25s %s\n" "Brand name:"         "$BRAND_NAME"
printf "  %-25s %s\n" "Brand slug:"         "$BRAND_SLUG"
printf "  %-25s %s\n" "Full name:"          "$BRAND_FULL_NAME"
printf "  %-25s %s\n" "Domain:"             "$DOMAIN"
printf "  %-25s %s\n" "Base URL:"           "$BASE_URL"
printf "  %-25s %s\n" "API URL:"            "$API_URL"
printf "  %-25s %s\n" "Analytics URL:"      "$ANALYTICS_URL"
printf "  %-25s %s\n" "Contact email:"      "$EMAIL_CONTACT"
echo "══════════════════════════════════════════════════════════════════════"
echo ""
echo "⚠️  This will modify ~200 files in the current directory."
echo "⚠️  Make sure you have committed or backed up your changes."
echo ""
read -p "Proceed? (type 'yes' to continue): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# ─── Backup git state ─────────────────────────────────────────────────────────
if [[ -d .git ]]; then
  BACKUP_TAG="pre-rebrand-$(date +%Y%m%d-%H%M%S)"
  git tag "$BACKUP_TAG" 2>/dev/null || echo "ℹ️  Could not create git tag (uncommitted changes OK)"
  echo "✓ Backup tag: $BACKUP_TAG (restore with: git reset --hard $BACKUP_TAG)"
fi

# ─── Find/replace helpers ────────────────────────────────────────────────────
FILES_TO_PROCESS=(
  "*.ts" "*.tsx" "*.js" "*.jsx" "*.mjs" "*.json" "*.yml" "*.yaml"
  "*.md" "*.env" "*.env.example" "*.env.template"
  "*.html" "*.svg" "*.css"
  "Dockerfile*" "docker-compose*"
)

# Collect all target files
echo ""
echo "🔍 Scanning files..."
MAPFILE_ARGS=()
while IFS= read -r f; do
  MAPFILE_ARGS+=("$f")
done < <(
  find . -type f \
    \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
    -o -name "*.mjs" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" \
    -o -name "*.md" -o -name ".env*" -o -name "Dockerfile*" \
    -o -name "docker-compose*" -o -name "*.html" -o -name "*.css" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.next/*" \
    ! -path "*/.medusa/*" \
    ! -path "*/.git/*" \
    ! -path "*/.claude/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/docs/BLUEPRINT*" \
    ! -path "*/docs/blueprint.config.example.yml" \
    ! -path "*/docs/REBRAND-LOG.md" \
    ! -path "./blueprint.config.yml" \
    ! -path "./scripts/rebrand.sh"
)
echo "  → ${#MAPFILE_ARGS[@]} files will be scanned"

# ─── Run replacements ────────────────────────────────────────────────────────
# Order matters: longest/most-specific strings first to avoid partial matches
declare -a REPLACEMENTS=(
  # Domains (most specific first)
  "analytics.enrola.shop|$ANALYTICS_URL"
  "https://analytics.enrola.shop|$ANALYTICS_URL"
  "api.enrola.shop|${API_URL#https://}"
  "https://api.enrola.shop|$API_URL"
  "enrola.shop|$DOMAIN"
  "https://enrola.shop|$BASE_URL"
  "enrola\\.shop|${DOMAIN//./\\.}"

  # Emails
  "hola@enrola.shop|$EMAIL_CONTACT"
  "noreply@enrola.shop|$EMAIL_NOREPLY"

  # Social handles
  "@ryo.smoke|@${IG_HANDLE:-yourbrand}"
  "@paralamata|@${IG_HANDLE:-yourbrand}"

  # Store name variants
  "Enrola Shop|$BRAND_FULL_NAME"
  "Enrola shop|$BRAND_FULL_NAME"
  "enrola shop|$BRAND_FULL_NAME"
  "ENROLA SHOP|$(echo "$BRAND_FULL_NAME" | tr '[:lower:]' '[:upper:]')"

  # Brand name (various cases)
  "Enrola|$BRAND_NAME"
  "ENROLA|${BRAND_NAME_UPPER:-$(echo "$BRAND_NAME" | tr '[:lower:]' '[:upper:]')}"
  "enrola|$BRAND_SLUG"

  # Legacy RYO references
  "RYO Store|$BRAND_FULL_NAME"
  "Ryo Store|$BRAND_FULL_NAME"
  "ryo-store|${BRAND_SLUG}-store"
  "ryostore|${BRAND_SLUG}store"
  "ryoshop|${BRAND_SLUG}shop"
  "ryoSmoke|${BRAND_SLUG}Smoke"
  "RYO|${BRAND_NAME_UPPER:-$(echo "$BRAND_NAME" | tr '[:lower:]' '[:upper:]')}"
  "Ryo|$BRAND_NAME"
  "ryo\\.smoke|${IG_HANDLE:-yourbrand}"
  "ryo|$BRAND_SLUG"
)

echo ""
echo "🔁 Running replacements..."

LOG_FILE="docs/REBRAND-LOG.md"
mkdir -p docs
cat > "$LOG_FILE" <<EOF
# Rebrand Log — $(date)

Config: \`$CONFIG_FILE\`
Target brand: **$BRAND_NAME** (slug: \`$BRAND_SLUG\`, domain: \`$DOMAIN\`)

## Replacements performed

| Pattern | Replaced with | Files touched |
|---|---|---|
EOF

TOTAL_TOUCHED=0
for replacement in "${REPLACEMENTS[@]}"; do
  FROM="${replacement%%|*}"
  TO="${replacement#*|}"
  FROM_ESC=$(printf '%s\n' "$FROM" | $SED -e 's/[\/&]/\\&/g')
  TO_ESC=$(printf '%s\n' "$TO" | $SED -e 's/[\/&]/\\&/g')

  # Count affected files before replacement
  COUNT=0
  for f in "${MAPFILE_ARGS[@]}"; do
    if grep -q "$FROM" "$f" 2>/dev/null; then
      COUNT=$((COUNT + 1))
    fi
  done

  if [[ "$COUNT" -gt 0 ]]; then
    echo "  [$COUNT files] $FROM → $TO"
    for f in "${MAPFILE_ARGS[@]}"; do
      $SED -i "s/$FROM_ESC/$TO_ESC/g" "$f" 2>/dev/null || true
    done
    echo "| \`$FROM\` | \`$TO\` | $COUNT |" >> "$LOG_FILE"
    TOTAL_TOUCHED=$((TOTAL_TOUCHED + COUNT))
  fi
done

echo ""
echo "✓ Replacements done — $TOTAL_TOUCHED total file-replacements logged"

# ─── Regenerate storefront/src/config/brand.ts ───────────────────────────────
echo ""
echo "📝 Regenerating storefront/src/config/brand.ts from config..."

BRAND_TS_PATH="storefront/src/config/brand.ts"
mkdir -p "$(dirname "$BRAND_TS_PATH")"

python3 <<PYEOF
import yaml, json
with open("$CONFIG_FILE") as f: c = yaml.safe_load(f)

ts = f"""/**
 * AUTO-GENERATED from blueprint.config.yml by scripts/rebrand.sh
 * Do not edit by hand — changes will be overwritten on next rebrand.
 * Edit blueprint.config.yml and re-run the script instead.
 */

export const BRAND = {json.dumps(c['brand'], indent=2, ensure_ascii=False)} as const

export const MARKET = {json.dumps(c['market'], indent=2, ensure_ascii=False)} as const

export const FEATURES = {json.dumps(c['features'], indent=2, ensure_ascii=False)} as const

export const COMBO_TIERS = {json.dumps(c.get('combo_tiers', []), indent=2, ensure_ascii=False)} as const

export const WHOLESALE = {json.dumps(c.get('wholesale', {{}}), indent=2, ensure_ascii=False)} as const

// Helpers
export function isFeatureEnabled(key: keyof typeof FEATURES): boolean {{
  return FEATURES[key] === true
}}

export function getSocialUrl(platform: keyof typeof BRAND.social): string | null {{
  const handle = BRAND.social[platform]
  if (!handle) return null
  const urls: Record<string, string> = {{
    instagram: `https://instagram.com/${{handle}}`,
    tiktok: `https://tiktok.com/@${{handle}}`,
    facebook: `https://facebook.com/${{handle}}`,
    twitter: `https://twitter.com/${{handle}}`,
    youtube: `https://youtube.com/@${{handle}}`,
    telegram: `https://t.me/${{handle}}`,
    whatsapp: `https://wa.me/${{handle}}`,
  }}
  return urls[platform] || null
}}
"""

with open("$BRAND_TS_PATH", "w") as f:
    f.write(ts)
print(f"✓ Wrote $BRAND_TS_PATH ({len(ts)} bytes)")
PYEOF

# ─── Append log ──────────────────────────────────────────────────────────────
cat >> "$LOG_FILE" <<EOF

## Generated files

- \`$BRAND_TS_PATH\` — regenerated from \`blueprint.config.yml\`

## Next steps (manual)

See \`docs/BLUEPRINT-REBRAND.md\` "Parte 2 — Manual" for what the script cannot auto-replace:

1. **Assets**: replace logo, favicon, icon.png, apple-icon.png in \`storefront/public/\` + \`storefront/src/app/\`
2. **Colors**: update Tailwind + CSS custom properties to match \`brand.colors\`
3. **External services**: create new accounts for Resend, PostHog, Clarity, Umami, GSC, GA4 + update \`.env\`
4. **Copy review**: hero, FAQ, terms, privacy, blog — all niche-specific
5. **Products/shipping/competitors**: specific to Enrola — review seeds in \`backend/src/scripts/\`
6. **Feature flags**: verify \`blueprint.config.yml\` → features match what you need

Verify with:

\`\`\`bash
# Should return empty (except this log)
grep -rln "enrola\\|Enrola\\|ENROLA\\|ryo-store\\|ryo\\.smoke" \\
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \\
  --exclude-dir=docs/BLUEPRINT .
\`\`\`

Git restore if needed:

\`\`\`bash
git reset --hard $BACKUP_TAG
\`\`\`
EOF

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "✅ Rebrand complete"
echo "══════════════════════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  • $TOTAL_TOUCHED file-replacements logged"
echo "  • Generated: $BRAND_TS_PATH"
echo "  • Log: $LOG_FILE"
echo "  • Backup tag: $BACKUP_TAG"
echo ""
echo "Next steps:"
echo "  1. Review docs/BLUEPRINT-REBRAND.md 'Parte 2 — Manual'"
echo "  2. Replace graphic assets (logos, favicons)"
echo "  3. Update colors in tailwind.config.js + globals.css"
echo "  4. Configure .env with new external service credentials"
echo "  5. Build + deploy"
echo ""
echo "Sanity check for residues:"
echo '  grep -rln "enrola\|Enrola\|ryo-store\|ryo\.smoke" --exclude-dir=node_modules .'
echo ""
