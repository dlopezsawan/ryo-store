#!/bin/bash
# ENROLA LEGENDS — Sprite Generation Script
# Generates ALL 150 creatures sequentially, one at a time
# Usage: OPENAI_API_KEY=sk-xxx bash generate-all.sh [start_batch]

set -euo pipefail

OUTDIR="/Users/daniellopez/Desktop/ryo store/game/sprites/creatures"
GEN="/Users/daniellopez/.claude/skills/openai-image-gen/scripts/gen.py"
STYLE="Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, 2-tone shading, NO anti-aliasing, NO dithering, chibi proportions, expressive eyes, transparent background, no text"
LOG="$OUTDIR/generation.log"

mkdir -p "$OUTDIR"

generate() {
  local NAME="$1"
  local PROMPT="$2"
  local FILE="$OUTDIR/${NAME}.png"

  # Skip if already exists
  if [ -f "$FILE" ]; then
    echo "SKIP $NAME (already exists)" | tee -a "$LOG"
    return 0
  fi

  local TMPDIR="$OUTDIR/tmp-${NAME}"
  echo "GEN  $NAME ..." | tee -a "$LOG"

  if python3 "$GEN" \
    --prompt "${PROMPT}. ${STYLE}" \
    --count 1 --model gpt-image-1 --background transparent \
    --output-format png --quality medium \
    --out-dir "$TMPDIR" 2>>"$LOG"; then

    local SRC
    SRC=$(find "$TMPDIR" -name "*.png" -not -name "index*" 2>/dev/null | head -1)
    if [ -n "$SRC" ]; then
      cp "$SRC" "$FILE"
      rm -rf "$TMPDIR"
      echo "  OK $NAME" | tee -a "$LOG"
    else
      rm -rf "$TMPDIR"
      echo "  FAIL $NAME (no png output)" | tee -a "$LOG"
    fi
  else
    rm -rf "$TMPDIR"
    echo "  FAIL $NAME (api error)" | tee -a "$LOG"
  fi

  sleep 2
}

START_BATCH="${1:-4}"
echo "=== Starting from batch $START_BATCH ===" | tee -a "$LOG"
echo "=== $(date) ===" | tee -a "$LOG"

# B04 — VIENTO: Jalita → Ventolero → Huracanal
if [ "$START_BATCH" -le 4 ]; then
echo "--- B04 VIENTO ---" | tee -a "$LOG"
generate "010-jalita" "Tiny playful breeze whirlwind creature with cute smiling face, baby chibi, mint green tones"
generate "011-ventolero" "Small tornado creature carrying leaves and scraps, medium chibi, mint green tones"
generate "012-huracanal" "Tropical storm creature with cyclone eyes and swirling rain, noble powerful, teal tones"
fi

# B05 — CRISTAL: Bonguito → Bonglass → Prismorfo
if [ "$START_BATCH" -le 5 ]; then
echo "--- B05 CRISTAL ---" | tee -a "$LOG"
generate "013-bonguito" "Small crystal flask creature with rising bubbles and cute face, baby chibi, ice blue tones"
generate "014-bonglass" "Elaborate iridescent crystal vessel creature with inner chambers, medium chibi, ice blue"
generate "015-prismorfo" "Pure crystal entity creature refracting light into rainbow beams, ethereal noble, ice blue"
fi

# B06 — TIERRA: Arepita → Arepaso → Arepaking
if [ "$START_BATCH" -le 6 ]; then
echo "--- B06 TIERRA ---" | tee -a "$LOG"
generate "016-arepita" "Tiny round corn cake creature with stubby legs and warm smile, baby chibi, sandy brown tones"
generate "017-arepaso" "Giant stuffed corn cake creature with corn-husk arms, medium chibi, sandy brown tones"
generate "018-arepaking" "Majestic corn cake king creature with golden corn crown and heat aura, noble, sandy gold"
fi

# B07 — METAL: Grindito → Grindark → Moledron
if [ "$START_BATCH" -le 7 ]; then
echo "--- B07 METAL ---" | tee -a "$LOG"
generate "019-grindito" "Small toothed gear mill creature with curious eyes, compact metallic body, baby chibi, steel gray"
generate "020-grindark" "Dark multi-chambered gear crusher creature with spinning blades, medium chibi, steel gray"
generate "021-moledron" "Giant crushing robot creature with plants growing between its gears, noble powerful, steel gray"
fi

# B08 — HUMO: Humito → Nebuloso → Fumantis
if [ "$START_BATCH" -le 8 ]; then
echo "--- B08 HUMO ---" | tee -a "$LOG"
generate "022-humito" "Tiny sleepy mist cloud creature with drowsy face and floating wisps, baby chibi, lavender gray"
generate "023-nebuloso" "Dense fog bank creature with glowing eyes peering through mist, medium chibi, lavender gray"
generate "024-fumantis" "Serene ancestral mist spirit creature floating peacefully, wise noble, lavender gray tones"
fi

# B09 — RESINA: Terpino → Terpenol → Dabmaster
if [ "$START_BATCH" -le 9 ]; then
echo "--- B09 RESINA ---" | tee -a "$LOG"
generate "025-terpino" "Tiny amber resin droplet creature with sweet fragrant glow, golden, baby chibi, amber gold"
generate "026-terpenol" "Golden translucent resin humanoid creature dripping amber, medium chibi, amber gold tones"
generate "027-dabmaster" "Regal molten golden resin master creature with vapor aura, noble stance, amber gold tones"
fi

# B10 — ESPIRITU: Calmita → Serenox → Nirvanol
if [ "$START_BATCH" -le 10 ]; then
echo "--- B10 ESPIRITU ---" | tee -a "$LOG"
generate "028-calmita" "Small floating violet light orb creature with peaceful gentle glow, baby chibi, lavender purple"
generate "029-serenox" "Meditative figure creature wrapped in violet aura, calm expression, medium chibi, purple"
generate "030-nirvanol" "Enlightened transcendent being creature surrounded by sacred mist, noble serene, purple"
fi

# B11 — HIERBA/TIERRA: Cachapín → Cachapote → Maizotán
if [ "$START_BATCH" -le 11 ]; then
echo "--- B11 HIERBA ---" | tee -a "$LOG"
generate "031-cachapin" "Small rolled corn pancake creature with cute sweet eyes, golden green, baby chibi"
generate "032-cachapote" "Giant corn pancake creature overflowing with melted cheese, medium chibi, golden green"
generate "033-maizotan" "Corn titan creature with corn-cob arms and palm leaf crown, noble powerful, green gold"
fi

# B12 — VIENTO/HIERBA: Turpial → Turpialar
if [ "$START_BATCH" -le 12 ]; then
echo "--- B12 VIENTO ---" | tee -a "$LOG"
generate "034-turpial" "Baby orange and black songbird creature, fluffy and perched, baby chibi, mint orange tones"
generate "035-turpialar" "Majestic orange bird creature with tropical leaf wings soaring, noble, mint orange tones"
fi

# B13 — AGUA/CRISTAL: Burbujin → Percolin → Filtrador
if [ "$START_BATCH" -le 13 ]; then
echo "--- B13 AGUA ---" | tee -a "$LOG"
generate "036-burbujin" "Cute floating water bubble creature with innocent baby face inside, baby chibi, blue tones"
generate "037-percolin" "Crystal tower creature filled with bubbling water chambers, medium chibi, blue tones"
generate "038-filtrador" "Tall crystal tower creature with cascading internal waterfalls, noble pure, blue tones"
fi

# B14 — BRASA/HUMO: Cenicín → Cenicero
if [ "$START_BATCH" -le 14 ]; then
echo "--- B14 BRASA ---" | tee -a "$LOG"
generate "039-cenicin" "Small ash mound creature with glowing ember core in center, warm, baby chibi, orange tones"
generate "040-cenicero" "Animated stone dish creature with misty arms and grumpy face, medium chibi, orange gray"
fi

# B15 — METAL/CRISTAL: Pipita → Pipalux → Pipatron
if [ "$START_BATCH" -le 15 ]; then
echo "--- B15 METAL ---" | tee -a "$LOG"
generate "041-pipita" "Small ornate metal tube creature with short legs and curious eyes, baby chibi, steel gray"
generate "042-pipalux" "Elegant engraved metal tube creature with crystal accents, medium chibi, steel blue gray"
generate "043-pipatron" "Colossal steampunk mechanical tube creature shooting crystal beams, noble, steel gray"
fi

# B16 — TIERRA/METAL: Cunaguín → Cunaguaro
if [ "$START_BATCH" -le 16 ]; then
echo "--- B16 TIERRA ---" | tee -a "$LOG"
generate "044-cunaguin" "Baby ocelot cub creature with mud-spotted fur, playful pose, baby chibi, sandy brown tones"
generate "045-cunaguaro" "Fierce ocelot creature with metallic claws and earthy spotted fur, noble, sandy brown"
fi

# B17 — HIERBA/VIENTO: Semillín → Plántula → Floresta
if [ "$START_BATCH" -le 17 ]; then
echo "--- B17 HIERBA ---" | tee -a "$LOG"
generate "046-semillin" "Tiny winged seed creature floating gently on a breeze, baby chibi, warm green tones"
generate "047-plantula" "Young plant creature with first five-pointed leaves growing upward, medium chibi, green"
generate "048-floresta" "Grand flowering tree creature releasing seeds with each breeze, noble majestic, green"
fi

# B18 — RESINA/CRISTAL: Hashito → Hashrak
if [ "$START_BATCH" -le 18 ]; then
echo "--- B18 RESINA ---" | tee -a "$LOG"
generate "049-hashito" "Small dark amber resin ball creature with smooth soft texture, cute, baby chibi, amber"
generate "050-hashrak" "Crystallized amber resin block creature with glowing fracture lines, noble, amber gold"
fi

echo "=== DONE BATCHES 4-18 (010-050) ===" | tee -a "$LOG"
echo "=== $(date) ===" | tee -a "$LOG"
