#!/bin/bash
# ENROLA LEGENDS — Sprite Generation Part 2
# Batches B19-B58 (creatures #051-#150)

set -euo pipefail

OUTDIR="/Users/daniellopez/Desktop/ryo store/game/sprites/creatures"
GEN="/Users/daniellopez/.claude/skills/openai-image-gen/scripts/gen.py"
STYLE="Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, 2-tone shading, NO anti-aliasing, NO dithering, chibi proportions, expressive eyes, transparent background, no text"
LOG="$OUTDIR/generation.log"

generate() {
  local NAME="$1"
  local PROMPT="$2"
  local FILE="$OUTDIR/${NAME}.png"
  if [ -f "$FILE" ]; then
    echo "SKIP $NAME" | tee -a "$LOG"
    return 0
  fi
  local TMPDIR="$OUTDIR/tmp-${NAME}"
  echo "GEN  $NAME ..." | tee -a "$LOG"
  if python3 "$GEN" --prompt "${PROMPT}. ${STYLE}" --count 1 --model gpt-image-1 --background transparent --output-format png --quality medium --out-dir "$TMPDIR" 2>>"$LOG"; then
    local SRC
    SRC=$(find "$TMPDIR" -name "*.png" -not -name "index*" 2>/dev/null | head -1)
    if [ -n "$SRC" ]; then
      cp "$SRC" "$FILE"
      rm -rf "$TMPDIR"
      echo "  OK $NAME" | tee -a "$LOG"
    else
      rm -rf "$TMPDIR"
      echo "  FAIL $NAME (no png)" | tee -a "$LOG"
    fi
  else
    rm -rf "$TMPDIR"
    echo "  FAIL $NAME (api error)" | tee -a "$LOG"
  fi
  sleep 2
}

echo "=== PART 2 starting $(date) ===" | tee -a "$LOG"

# B19 — BRASA/TIERRA: Budarín → Budarazo → Fogonero
echo "--- B19 ---" | tee -a "$LOG"
generate "051-budarin" "Small hot iron cooking disc creature with little eyes, glowing red, baby chibi, orange red tones"
generate "052-budarazo" "Giant walking iron disc creature leaving fire footprints behind, medium chibi, orange red"
generate "053-fogonero" "Living clay oven creature with roaring internal flames visible, noble powerful, orange red"

# B20 — AGUA/VIENTO: Llovizna → Aguaceño
echo "--- B20 ---" | tee -a "$LOG"
generate "054-llovizna" "Tiny drizzling rain cloud creature constantly dripping water drops, baby chibi, blue tones"
generate "055-aguaceno" "Dark storm cloud creature with swirling winds and heavy rain, noble powerful, blue tones"

# B21 — HUMO/VIENTO: Vaperín → Vapornox → Nebulón
echo "--- B21 ---" | tee -a "$LOG"
generate "056-vaperin" "Tiny aromatic wispy mist creature fragrant and delicate, baby chibi, lavender gray tones"
generate "057-vapornox" "Dense vapor tornado creature with swirling aromatic patterns, medium chibi, lavender gray"
generate "058-nebulon" "Vast living nebula creature covering areas with dense atmospheric mist, noble, gray"

# B22 — ESPIRITU/HIERBA: Chamán → Curandol
echo "--- B22 ---" | tee -a "$LOG"
generate "059-chaman" "Small spirit creature wearing a leaf mask, mystical and curious, baby chibi, purple tones"
generate "060-curandol" "Spirit healer creature surrounded by medicinal herbs, serene wise, noble, purple green"

# B23 — METAL/BRASA: Chispín → Chispador → Zipporion
echo "--- B23 ---" | tee -a "$LOG"
generate "061-chispin" "Small flint stone creature with electric sparking face, energetic, baby chibi, steel gray"
generate "062-chispador" "Sparking ignition mechanism creature with constant sparks flying, medium chibi, steel"
generate "063-zipporion" "Colossal gleaming chrome creature with eternal flame crown, noble powerful, steel gray"

# B24 — TIERRA/AGUA: Barrín → Fanguero → Lodazón
echo "--- B24 ---" | tee -a "$LOG"
generate "064-barrin" "Small round wet mud ball creature with tiny innocent eyes, baby chibi, sandy brown tones"
generate "065-fanguero" "Mud golem creature with small plants growing on its body, medium chibi, sandy brown"
generate "066-lodazon" "Massive walking swamp creature dragging mud and plant debris, noble powerful, brown"

# B25 — CRISTAL/BRASA: Chimbito → Quemacris
echo "--- B25 ---" | tee -a "$LOG"
generate "067-chimbito" "Small hot crystal shard creature glowing red-orange with warmth, baby chibi, ice blue red"
generate "068-quemacris" "Red-hot crystal structure creature with molten magma visible in core, noble, blue red"

# B26 — RESINA/TIERRA: Pegosin → Pegostro → Melazón
echo "--- B26 ---" | tee -a "$LOG"
generate "069-pegosin" "Sticky amber resin blob creature rolling on the ground, cute, baby chibi, amber gold"
generate "070-pegostro" "Slow dense mud-and-resin creature, heavy and unstoppable, medium chibi, amber brown"
generate "071-melazon" "Massive dark dense absorbing creature that engulfs everything it touches, noble, dark amber"

# B27 — VIENTO/ESPIRITU: Suspirín → Exhalón
echo "--- B27 ---" | tee -a "$LOG"
generate "072-suspirin" "Gentle visible sigh creature with peaceful relaxed dreamy face, baby chibi, mint green"
generate "073-exhalon" "Serene wind spirit creature drifting peacefully bringing calm, noble, mint green tones"

# B28 — AGUA/RESINA: Bubblín → Bubblash → Icextract
echo "--- B28 ---" | tee -a "$LOG"
generate "074-bubblin" "Water bubble creature with amber liquid swirling inside it, baby chibi, blue amber"
generate "075-bubblash" "Water sphere creature with golden resin floating within, medium chibi, blue gold"
generate "076-icextract" "Ice crystal creature with pure amber trapped in its frozen core, noble epic, blue gold"

# B29 — HIERBA/BRASA: Porrito → Canuto → Bluntazo
echo "--- B29 ---" | tee -a "$LOG"
generate "077-porrito" "Tiny rolled parchment scroll creature with cute eyes and short legs, baby chibi, green"
generate "078-canuto" "Large rolled scroll creature with glowing tip and rising wisps, medium chibi, green gold"
generate "079-bluntazo" "Colossal leaf-wrapped staff creature with warm aura, majestic noble stance, green gold"

# B30 — METAL/VIENTO: Filtrito → Filtramax
echo "--- B30 ---" | tee -a "$LOG"
generate "080-filtrito" "Small metal filter disc creature with bouncy spring legs, cute, baby chibi, steel gray"
generate "081-filtramax" "Wind turbine filtration creature that purifies air around it, noble powerful, steel gray"

# B31 — CRISTAL/AGUA: Heladín → Glacirín → Crionebla
echo "--- B31 ---" | tee -a "$LOG"
generate "082-heladin" "Cute ice cube creature with frozen surprised face expression, baby chibi, ice blue tones"
generate "083-glacirin" "Ice structure creature with water flowing through its interior, medium chibi, ice blue"
generate "084-crionebla" "Freezing mist creature that crystallizes everything it touches, noble epic, ice blue"

# B32 — HUMO/RESINA: Rosinín → Rosinero
echo "--- B32 ---" | tee -a "$LOG"
generate "085-rosinin" "Tiny amber-tinted mist cloud creature with pine-scented wisps, baby chibi, gray amber"
generate "086-rosinero" "Living heat press creature exuding golden resin from every pore, noble, gray amber"

# B33 — TIERRA/ESPIRITU: Totémico → Petroglin → Ancestrón
echo "--- B33 ---" | tee -a "$LOG"
generate "087-totemico" "Small stone totem creature with ancient carved symbols, sturdy, baby chibi, sandy brown"
generate "088-petroglin" "Animated petroglyph creature glowing with mysterious inner light, medium chibi, brown"
generate "089-ancestron" "Massive ancestral stone guardian creature, ancient living sculpture, noble epic, brown"

# B34 — BRASA/ESPIRITU: Velita → Velarión
echo "--- B34 ---" | tee -a "$LOG"
generate "090-velita" "Small flickering candle creature with blinking warm flame on top, baby chibi, orange gold"
generate "091-velarion" "Floating candelabra creature with multiple whispering mystical flames, noble, orange"

# B35 — HIERBA/AGUA: Mangolín → Mangotal → Mangoboss
echo "--- B35 ---" | tee -a "$LOG"
generate "092-mangolin" "Tiny mango fruit creature with leaf on head and sweet face, baby chibi, green gold"
generate "093-mangotal" "Mango tree creature with juicy fruits dripping golden nectar, medium chibi, green gold"
generate "094-mangoboss" "Giant mango creature with cascading juice waterfall and leaf crown, noble, green gold"

# B36 — METAL/TIERRA: Bolivín → Carabobín → Libertador
echo "--- B36 ---" | tee -a "$LOG"
generate "095-bolivin" "Tiny metal toy soldier creature with battle hat, cute stance, baby chibi, steel gray"
generate "096-carabobin" "Armored soldier creature with stone and earth shield, medium chibi, steel brown"
generate "097-libertador" "Majestic golden general creature with sword cape and golden aura, noble epic, steel gold"

# B37 — CRISTAL/ESPIRITU: Vitralín → Vitralux
echo "--- B37 ---" | tee -a "$LOG"
generate "098-vitralin" "Small glowing stained glass shard creature emitting colorful light, baby chibi, ice blue"
generate "099-vitralux" "Floating stained glass window creature projecting colored light beams, noble, ice blue"

# B38 — RESINA/HUMO: Waxito → Waxmelt
echo "--- B38 ---" | tee -a "$LOG"
generate "100-waxito" "Tiny golden creamy wax droplet creature, soft and round, baby chibi, amber gold tones"
generate "101-waxmelt" "Melting golden wax creature constantly generating warm rising vapor, noble, amber gold"

# B39 — VIENTO/METAL: Molinín → Turbinox
echo "--- B39 ---" | tee -a "$LOG"
generate "102-molinin" "Small spinning metal windmill creature lightweight and cheerful, baby chibi, mint steel"
generate "103-turbinox" "Living wind turbine creature generating sharp cutting winds, noble powerful, mint steel"

# B40 — HUMO/TIERRA: Sahumerín → Sahumador → Incensario
echo "--- B40 ---" | tee -a "$LOG"
generate "104-sahumerin" "Small clay incense burner creature gently steaming with warm glow, baby chibi, gray"
generate "105-sahumador" "Ceramic vessel creature with constant aromatic mist rising upward, medium chibi, gray"
generate "106-incensario" "Miniature clay temple creature exhaling sacred aromatic mist plumes, noble epic, gray"

# B41 — AGUA/ESPIRITU: Tacarito → Tacarigua
echo "--- B41 ---" | tee -a "$LOG"
generate "107-tacarito" "Mysterious glowing lake droplet creature with deep blue shimmer, baby chibi, blue"
generate "108-tacarigua" "Ancient lake spirit creature with deep blue aura and wise eyes, noble, blue purple"

# B42 — HIERBA/METAL: Tijerín → Podarex
echo "--- B42 ---" | tee -a "$LOG"
generate "109-tijerin" "Small plant creature with metallic scissor-shaped leaves, cute, baby chibi, green steel"
generate "110-podarex" "Plant creature with scissor blade arms trimming leaves around it, noble, green steel"

# B43 — BRASA/VIENTO: Chispita → Llamarada
echo "--- B43 ---" | tee -a "$LOG"
generate "111-chispita" "Tiny bouncing spark creature energetic and erratic flickering, baby chibi, orange gold"
generate "112-llamarada" "Blazing fire gust creature fueled by swirling wind currents, noble powerful, orange"

# B44 — CRISTAL/METAL: Perkito → Perkador → Perkmaster
echo "--- B44 ---" | tee -a "$LOG"
generate "113-perkito" "Small crystal tube creature with metal frame and tiny bubbles inside, baby chibi, blue"
generate "114-perkador" "Complex crystal filtration creature with metal structural framework, medium chibi, blue"
generate "115-perkmaster" "Clockwork crystal tower creature with intricate metallic gear mechanisms, noble epic"

# B45 — RESINA/ESPIRITU: Aromín → Aromantis
echo "--- B45 ---" | tee -a "$LOG"
generate "116-aromin" "Floating fragrant amber droplet creature with hypnotic aromatic glow, baby chibi, amber"
generate "117-aromantis" "Sentient aromatic cloud creature inducing calm and peace, wise, noble, amber purple"

# B46 — TIERRA/CRISTAL: Polvorín → Polvorosa
echo "--- B46 ---" | tee -a "$LOG"
generate "118-polvorin" "Small mound of sparkling fine crystalline dust creature, glittering, baby chibi, brown"
generate "119-polvorosa" "Crystallized sugar pastry creature sweet but powerful presence, noble epic, brown gold"

# B47 — HIERBA/ESPIRITU: Guacamín → Guacamaya
echo "--- B47 ---" | tee -a "$LOG"
generate "120-guacamin" "Baby green macaw creature with bright fluffy feathers, adorable, baby chibi, green"
generate "121-guacamaya" "Majestic macaw creature with spiritual aura and leaf-like plumage, noble epic, green"

# B48 — AGUA/METAL: Conservín → Conservero
echo "--- B48 ---" | tee -a "$LOG"
generate "122-conservin" "Small tin can creature with magical glowing liquid sloshing inside, baby chibi, blue"
generate "123-conservero" "Giant metal jar creature containing swirling ocean water within it, noble epic, blue"

# B49 — BRASA/RESINA: Carboncín → Narguilor
echo "--- B49 ---" | tee -a "$LOG"
generate "124-carboncin" "Small glowing red-hot coal creature, ember bright and warm, baby chibi, orange red"
generate "125-narguilor" "Living ornate tall vessel creature with aromatic mist and eternal embers, noble epic"

# B50 — VIENTO/HUMO: Hallaquín → Hallacazo
echo "--- B50 ---" | tee -a "$LOG"
generate "126-hallaquin" "Leaf-wrapped tamale creature floating on the wind festive and cute, baby chibi, mint"
generate "127-hallacazo" "Giant flying leaf-wrapped tamale creature trailing aromatic steam, noble epic, mint"

# B51 — INDEPENDIENTES COMUNES (grupo 1)
echo "--- B51 ---" | tee -a "$LOG"
generate "128-papelon" "Paper roll creature running with tiny legs, energetic expression, chibi, green tones"
generate "129-filtrox" "Tough small cardboard tube creature in bodyguard stance, determined, chibi, steel gray"
generate "130-clippy" "Smiling rechargeable fire-starter creature with spinning wheel on top, chibi, steel gray"

# B52 — INDEPENDIENTES COMUNES (grupo 2)
echo "--- B52 ---" | tee -a "$LOG"
generate "131-bongolon" "Huge clumsy crystal vessel creature stumbling but tough and resilient, chibi, ice blue"
generate "132-vaporcito" "Portable metal mist device creature with LED screen face, tech, chibi, lavender gray"
generate "133-enrollao" "Calm leaf-rolled humanoid creature with serene meditative expression, chibi, green"

# B53 — INDEPENDIENTES COMUNES (grupo 3)
echo "--- B53 ---" | tee -a "$LOG"
generate "134-moledora" "Elegant gear mill creature with flowers blooming from its surface, chibi, steel green"
generate "135-chaguaramin" "Small palm tree creature throwing coconuts with playful mischief, chibi, green"
generate "136-hamaquero" "Floating hammock creature perpetually sleeping and dreaming peacefully, chibi, mint"

# B54 — INDEPENDIENTES COMUNES (grupo 4)
echo "--- B54 ---" | tee -a "$LOG"
generate "137-papagallo" "Blazing kite creature soaring through sky with fiery streaming tail, chibi, mint orange"
generate "138-roncador" "Sleepy creature snoring out relaxing mist clouds dozing contentedly, chibi, gray"
generate "139-munchero" "Round eternally hungry creature devouring snacks with ravenous joy, chibi, sandy brown"
generate "140-pasillero" "Transparent flickering hallway ghost creature elusive and mysterious, chibi, purple"

# B55 — EPICOS INDEPENDIENTES (grupo 1)
echo "--- B55 ---" | tee -a "$LOG"
generate "141-caobon" "Massive ancient mahogany tree creature wise enormous and deeply rooted, epic, green"
generate "142-teleferix" "Living cable car cabin creature patrolling mountain heights adventurous, epic, mint"
generate "143-pilandero" "Giant wooden mortar creature pounding with volcanic force powerful, epic, sandy brown"

# B56 — EPICOS INDEPENDIENTES (grupo 2)
echo "--- B56 ---" | tee -a "$LOG"
generate "144-sambilon" "Living miniature shopping mall creature made of glass and steel imposing, epic, ice blue"
generate "145-redactor" "Ghostly building guardian creature holding many glowing keys mysterious, epic, purple"

# B57 — LEGENDARIOS (grupo 1)
echo "--- B57 ---" | tee -a "$LOG"
generate "146-cabrialesix" "Majestic ancestral river serpent dragon creature with flowing water aura, legendary, blue"
generate "147-penalveris" "Sacred giant tree guardian creature with roots spanning outward ancient, legendary, green"

# B58 — LEGENDARIOS (grupo 2)
echo "--- B58 ---" | tee -a "$LOG"
generate "148-carabobex" "Spectral golden armored warrior creature with blazing sword raised, legendary, steel gold"
generate "149-redantom" "Dimensional crystal-spirit entity creature distorting reality around it, legendary, purple"
generate "150-enrolador" "Supreme master being creature with crystal body mist crown and ember heart, legendary"

echo "=== ALL 150 COMPLETE $(date) ===" | tee -a "$LOG"
