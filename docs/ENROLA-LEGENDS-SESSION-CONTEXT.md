# ENROLA LEGENDS -- Comprehensive Session Context Document

**Last updated:** 2026-04-03
**Purpose:** Complete project state for resuming development in a new session.

---

## 1. PROJECT OVERVIEW

**Enrola Legends** is a browser-based roguelike RPG (Pokemon-style) built into the storefront of enrola.shop, a smoking accessories e-commerce store. Players explore procedurally-generated dungeons based on real locations in Valencia, Venezuela, capture and train 150 creatures inspired by Venezuelan culture and smoking culture, and battle turn-based 1v1.

### Tech Stack

| Layer | Technology |
|---|---|
| Game engine | **Phaser 3** (WebGL renderer) |
| Framework | **Next.js** (storefront is a Medusa.js v2 storefront) |
| Language | **TypeScript** |
| UI plugin | **phaser3-rex-plugins** (RexUI for rounded rectangles in battle UI) |
| Save system | **localStorage** (key: `enrola-legends-save`) |
| Deployment | enrola.shop/juego (Next.js page route) |

### Game Resolution & Performance

| Parameter | Value |
|---|---|
| Base resolution | **480x320** pixels |
| Target FPS | **24 FPS** (`forceSetTimeOut: true`) |
| Scaling | `Phaser.Scale.FIT` with `CENTER_BOTH` |
| Renderer | WebGL, `pixelArt: true`, `roundPixels: true`, `antialias: false` |
| Background color | `#1A1A1A` |
| Tile size | **16x16** pixels (overworld/dungeon) |
| Overworld zoom | x2 (camera zoom applied in HubScene/DungeonScene) |

### Integration with enrola.shop (Club Enrola)

- The game awards **Club Enrola points** for in-game achievements:
  - Wild battle victory: **10 points**
  - Boss battle victory: **50 points**
  - Creature capture: **5 points**
- Points are stored in `PlayerSave.points` and saved to localStorage
- `customerId` is passed from the Next.js page to the Phaser game via `registry.set("customerId", customerId)` -- currently hardcoded as `"guest"`
- Future: sync points with Medusa customer account

---

## 2. CURRENT STATE OF DEVELOPMENT

### BUILT AND WORKING

| Feature | Status | Key File(s) |
|---|---|---|
| Game bootstrap & Phaser config | Working | `storefront/src/app/juego/GameClient.tsx` |
| Next.js page route `/juego` | Working | `storefront/src/app/juego/page.tsx` |
| Boot scene (asset loading with progress bar) | Working | `storefront/src/app/juego/scenes/BootScene.ts` |
| Title screen with "Nueva Partida" / "Continuar" | Working | `storefront/src/app/juego/scenes/TitleScene.ts` |
| Starter selection (Cogollito/Mechita/Gotirro) | Working | `storefront/src/app/juego/scenes/StarterSelectScene.ts` |
| Hub scene (Plaza de las Esculturas) | Working (visual issues) | `storefront/src/app/juego/scenes/HubScene.ts` |
| Dungeon scene (procedural BSP exploration) | Working | `storefront/src/app/juego/scenes/DungeonScene.ts` |
| Battle scene (full 1v1 combat) | Working | `storefront/src/app/juego/scenes/BattleScene.ts` (1360 lines) |
| Dex scene (collection browser) | Working | `storefront/src/app/juego/scenes/DexScene.ts` |
| BattleManager (pure logic, no Phaser) | Working | `storefront/src/app/juego/lib/BattleManager.ts` |
| CreatureManager (stats, XP, evolution) | Working | `storefront/src/app/juego/lib/CreatureManager.ts` |
| DungeonGenerator (BSP algorithm) | Working | `storefront/src/app/juego/lib/DungeonGenerator.ts` |
| SaveManager (localStorage CRUD) | Working | `storefront/src/app/juego/lib/SaveManager.ts` |
| Type system & interfaces | Working | `storefront/src/app/juego/lib/types.ts` |
| 150 front sprites (OpenAI-generated, 56x56) | Complete | `storefront/public/game/sprites/front/` (150 files) |
| 150 back sprites (OpenAI-generated, 48x48) | Complete | `storefront/public/game/sprites/back/` (150 files) |
| 9 starter PixelLab sprites (SW+NE for battle) | Complete | `storefront/public/game/sprites/sw/` and `ne/` (9 each) |
| 9 battle backgrounds (v1 + v2 versions) | Complete | `storefront/public/game/sprites/zones/` |
| 9 battle platforms | Complete | `storefront/public/game/sprites/zones/platform-*.png` |
| Player character 4 directions | Complete | `storefront/public/game/sprites/player/` |
| Hub building sprites | Complete | `storefront/public/game/sprites/hub/` (22 files) |
| Title screen background | Complete | `storefront/public/game/sprites/ui/title-bg.png` |
| Tilesets (hub + forest + detail) | Complete | `storefront/public/game/tilesets/` |
| Game data JSONs | Complete | `storefront/public/game/data/` (5 files) |
| 40 NPC character sprites | Complete | `game/sprites/characters/` (front + battle + portrait) |
| Art style guide | Complete | `game/sprites/ART-STYLE-GUIDE.md` |
| Sprite generation scripts (OpenAI) | Complete | `game/sprites/generate-*.sh`, `gen-backsprite.py` |

### PARTIALLY WORKING (Known Issues)

1. **Hub visuals are rough** -- buildings are placed as sprites on a pre-rendered background (`plaza-bg.png` / `plaza-bg-v4.png`), but the angle of buildings does not match the bird's eye perspective. FarmaPorro building sprite (`farmaporro.png`) is side-view, not front-view. The v2 versions (`tienda-v2.png`, `farmaporro-v2.png`, `museo-v2.png`, `mototaxi-v2.png`) attempted to fix this.

2. **Hub collision grid** -- Player can sometimes get stuck at grid edges. The collision grid is built once in `create()` as a boolean 2D array (`MAP_W=20, MAP_H=16` tiles). Grid size: `TILE=16` pixels.

3. **Battle HP display timing** -- HP bar used to show damage before the attack animation played. This was **partially fixed** with an HP snapshot system (`hpSnapshot` property in BattleScene). The snapshot captures HP values before `BattleManager.executePlayerAction()` mutates the state, then the UI reads from the snapshot until the damage animation completes.

4. **Wang tileset rendering** -- DungeonScene uses a Wang tile index mapping (`WANG_TO_GRID` record mapping 0-15 to spritesheet grid positions). Some tile transitions have visual inconsistencies at certain corners.

5. **Sprites loaded eagerly** -- BootScene currently loads only the first 12 creatures (the 3 starter lines: 001-012) plus all hub/UI assets. Remaining creature sprites (013-150) are NOT loaded and will need on-demand loading when dungeons are entered.

### NOT BUILT YET

- **Audio** -- No music or sound effects. No Web Audio API integration.
- **Remaining 141 PixelLab creature sprites** -- Only the 9 starters have PixelLab Pro directional sprites (8 directions each). The rest only have OpenAI front/back sprites.
- **7 additional dungeon tilesets** -- Only `forest-tileset.png` exists. Need themed tilesets for: Cabriales caves, Reda Building mall, Sambil mall, Cerro Casupo cave, Casco Historico colonial, CC Caribbean maze.
- **Zone selection map** -- No world/zone map screen exists. Currently dungeons are accessed via mototaxi NPC in the hub.
- **Walking animations** -- Player and NPC characters are static single-frame sprites per direction.
- **Item icons** (16x16) -- Not generated.
- **Type icons** (16x16) -- Not generated.
- **Battle effects/animations** -- No particle or spritesheet-based attack effects (only basic tween-based flash/shake).
- **Full NPC interactions** -- Hub NPCs are placed but most have minimal dialogue.
- **Dungeon 2-12 content** -- Data exists in `dungeons.json` for all dungeons, but only the first dungeon (Cuevas del Cabriales) has been playtested.
- **Minimap** -- Not implemented in DungeonScene.
- **Team management UI** -- Basic switch menu exists in battle, but no full team management screen.
- **Shop system** -- Hub has a shop building but the buy/sell interface is minimal.
- **VPS deployment** -- Game runs locally but has not been deployed to the production VPS.

---

## 3. GAME ARCHITECTURE

### Scene Flow

```
BootScene (preload all assets, show loading bar)
    |
    v
TitleScene (title screen: "Nueva Partida" / "Continuar")
    |
    |-- "Nueva Partida" --> StarterSelectScene (pick 1 of 3 starters)
    |                              |
    |                              v
    |                          HubScene
    |
    |-- "Continuar" --------> HubScene (loads save from localStorage)
                                  |
                                  |-- Mototaxi NPC --> DungeonScene
                                  |-- FarmaPorro --> heal team
                                  |-- Tienda --> buy items
                                  |-- Museo --> DexScene
                                  |
                                  v
                              DungeonScene (procedural dungeon exploration)
                                  |
                                  |-- Wild encounter tile --> BattleScene
                                  |-- Boss tile (final floor) --> BattleScene (isBoss: true)
                                  |-- Stairs down --> next floor
                                  |-- Stairs up --> previous floor
                                  |
                                  v
                              BattleScene (1v1 turn-based combat)
                                  |
                                  |-- Victory --> return to DungeonScene (or HubScene if boss)
                                  |-- Defeat --> HubScene (reset dungeon progress)
                                  |-- Run --> return to DungeonScene
                                  |-- Capture --> add creature, return to DungeonScene
```

### File Structure (Complete)

```
storefront/src/app/juego/
  page.tsx                    -- Next.js page route, renders GameClient
  GameClient.tsx              -- React component, creates Phaser.Game instance
  scenes/
    BootScene.ts              -- Preloads all assets, sets up registry data
    TitleScene.ts             -- Title screen with menu options
    StarterSelectScene.ts     -- Starter creature selection (3 choices)
    HubScene.ts               -- Hub overworld (Plaza de las Esculturas)
    DungeonScene.ts           -- Procedural dungeon exploration
    BattleScene.ts            -- Full battle UI + animation (1360 lines)
    DexScene.ts               -- Creature collection browser
  lib/
    types.ts                  -- All TypeScript interfaces and type definitions
    BattleManager.ts          -- Pure logic battle engine (no Phaser dependency)
    CreatureManager.ts        -- Creature stats, XP, leveling, evolution
    DungeonGenerator.ts       -- BSP-based procedural floor generation
    SaveManager.ts            -- localStorage save/load with schema versioning

storefront/public/game/
  data/
    creatures.json            -- 150 creatures: stats, types, moves, evolution
    moves.json                -- All moves: power, accuracy, PP, type, effects
    type-chart.json           -- 10x10 type effectiveness multipliers
    items.json                -- All items: heals, capture balls, boosts
    dungeons.json             -- 12 dungeons: floors, level range, encounters, boss
  sprites/
    front/                    -- 150 PNG files: 001-cogollito.png through 150-*.png (56x56)
    back/                     -- 150 PNG files: 001-cogollito.png through 150-*.png (48x48)
    sw/                       -- 9 PixelLab SW-view PNGs (starters only): 001-009
    ne/                       -- 9 PixelLab NE-view PNGs (starters only): 001-009
    player/                   -- player-south.png, player-north.png, player-east.png, player-west.png
    hub/                      -- 22 building/decoration sprites (see Hub Sprites section)
    zones/                    -- 9 battle BGs (v1+v2), 9 platform sprites, backup/
    ui/                       -- title-bg.png (only UI sprite so far)
  tilesets/
    hub-tileset.png           -- Hub overworld tileset
    hub-tileset.json          -- Hub tileset metadata
    forest-tileset.png        -- Forest/dungeon tileset (4x4 grid, 16 tiles, 16px each)
    forest-tileset.json       -- Forest tileset metadata
    detail-tiles.png          -- 3x3 grid (9 tiles, 16px each) for visual variety

game/sprites/                 -- Source/generation workspace (NOT served to browser)
  creatures/                  -- 155 OpenAI-generated creature source PNGs
  characters/                 -- 44 NPC character source PNGs (front/battle/portrait)
  pixellab/                   -- 85 PixelLab-generated PNGs (8 directions per starter)
  zones/                      -- Zone art source files
  ART-STYLE-GUIDE.md          -- Comprehensive pixel art style guide
  GENERATION-PLAN.md          -- Full sprite generation plan
  generate-all.sh             -- Shell script for batch OpenAI sprite generation
  generate-part2.sh           -- Second batch script
  generate-backsprites.sh     -- Back sprite generation script
  gen-backsprite.py           -- Python script for back sprite generation
  gallery.html                -- Local HTML gallery for previewing sprites
```

### Data Flow

1. **BootScene.preload()** loads all JSON data files and sprite images
2. **BootScene.create()** stores parsed JSON in `this.registry`:
   - `creaturesData` -- array of 150 CreatureData objects
   - `movesData` -- array of MoveData objects
   - `typeChart` -- 10x10 Record<string, Record<string, number>>
   - `itemsData` -- array of ItemData objects
   - `dungeonsData` -- array of DungeonData objects
3. **SaveManager** reads/writes `PlayerSave` to localStorage key `"enrola-legends-save"` wrapped in a `SaveEnvelope` with `version: 1`
4. **Scenes** access data via `this.registry.get("creaturesData")` etc.
5. **BattleScene** creates a `BattleManager` instance with typeChart + moves, then converts `CreatureInstance` (from types.ts/CreatureManager) to `BMCreature` (BattleManager's own CreatureInstance type) via `toBattleCreature()`

### SaveManager

- **localStorage key:** `"enrola-legends-save"`
- **Schema version:** 1
- **Envelope:** `{ version: number, data: PlayerSave }`
- **Methods:** `save(data)`, `load(): PlayerSave | null`, `hasSave(): boolean`, `deleteSave()`

**PlayerSave schema:**
```typescript
interface PlayerSave {
  team: CreatureInstance[];          // active team (max 6)
  box: CreatureInstance[];           // stored creatures
  inventory: { itemId: number; quantity: number }[];
  dex: number[];                    // creature IDs seen/caught
  currentDungeon: number | null;    // dungeon ID if inside one
  currentFloor: number;
  points: number;                   // Club Enrola points
  gender: "m" | "f";
  badges: number[];                 // completed dungeon IDs
}
```

### BattleManager

Pure logic engine with NO Phaser dependency. Key design:

- **Constructor:** takes `TypeChart` and `MoveData[]`
- **State:** `BattleState` with player team, enemy team, active indices, turn counter, win condition
- **Actions:** `executePlayerAction(action)` returns `BattleEvent[]` -- an array of events for the scene to animate sequentially
- **BattleEvent types:** `message`, `damage`, `faint`, `status`, `heal`, `switch`, `capture`, `xp`, `run`, `battleEnd`
- **Damage formula:** Pokemon-like: `((2*level/5+2) * power * atk/def) / 50 + 2`, with STAB (x1.5), type effectiveness, critical hits (1/16 chance, x1.5 damage)
- **Stat stages:** -6 to +6, multiplier table: 2/8 at -6, 2/2 at 0, 8/2 at +6
- **Capture:** Uses `catchRate` from creature data, `ballMultiplier` from item, shake count 0-3
- **Speed determines turn order:** Higher SPD goes first
- **Enemy AI:** Simple -- picks random move

### CreatureManager

- **Level cap:** 50
- **Starter level:** 5
- **Starter IDs:** 1 (Cogollito/Hierba), 4 (Mechita/Brasa), 7 (Gotirro/Agua)
- **HP formula:** `floor(((base_hp * 2) * level / 100) + level + 10)`
- **Stat formula:** `floor(((base * 2) * level / 100) + 5)`
- **XP curve:** `level^3` (cubic)
- **Evolution:** Triggered when level >= `evolution.level`. HP delta preserved. Moves recalculated for new species.
- **Move learning:** Learns moves at specific levels (from `movesLearn` map). Keeps last 4. When full, oldest move replaced.
- **Wild encounters:** Random creature from dungeon's encounter list, random level within dungeon's level range.

### DungeonGenerator (BSP Algorithm)

- **Grid size:** 30 wide x 20 tall (in tiles)
- **Seed:** `dungeonId * 1000 + floorNumber` (deterministic, seeded PRNG using LCG)
- **BSP depth:** 2-3 splits, producing 4-6 rooms
- **Room sizes:** 4-8 wide, 4-6 tall
- **Corridors:** L-shaped (horizontal first, then vertical)
- **Tile values:** 0=wall, 1=floor, 2=corridor, 3=stairs_down, 4=item_pickup, 5=boss, 6=stairs_up
- **Spawn:** First room center. Stairs: farthest room center (by BFS distance).
- **Items:** 1-3 random pickups per floor from `PICKUP_ITEM_IDS`
- **Encounter rate:** `min(8 + floor * 0.5, 15)` percent per step
- **Connectivity guaranteed:** If BFS fails to find path from spawn to stairs, a direct corridor is carved.

---

## 4. SPRITE SYSTEM

### OpenAI-Generated Sprites (All 150 creatures)

- **Front sprites:** 150 files in `storefront/public/game/sprites/front/` (56x56 px)
  - Naming: `001-cogollito.png` through `150-*.png`
  - Loaded as: `front-001-cogollito`, `front-002-cogollero`, etc.
- **Back sprites:** 150 files in `storefront/public/game/sprites/back/` (48x48 px)
  - Naming: same as front
  - Loaded as: `back-001-cogollito`, etc.
- **Source files:** `game/sprites/creatures/` (155 files including generation artifacts)
- **Generated with:** OpenAI DALL-E via shell scripts (`generate-all.sh`, `gen-backsprite.py`)
- **Style:** GBC Pokemon Crystal aesthetic, 4-color palette per type, 1px black outline

### PixelLab Pro Sprites (9 starters with 8 directions)

- **Location (source):** `game/sprites/pixellab/` (85 files)
  - Per creature: `{name}-front.png`, `{name}-back.png`, `{name}-north.png`, `{name}-south.png`, `{name}-east.png`, `{name}-west.png` + sometimes `-ne.png`, `-sw.png`, `-sw-trimmed.png`
- **Deployed for battle:** Only SW and NE views are copied to:
  - `storefront/public/game/sprites/sw/` (9 files: 001-009)
  - `storefront/public/game/sprites/ne/` (9 files: 001-009)
- **Creatures with PixelLab sprites:** cogollito, cogollero, cogolord, mechita, flamero, infernal, gotirro, cabrialin, cabriator
- **Root-level PNGs:** There are also `{name}-{direction}.png` files at the project root (e.g., `cogollito-east.png`) -- these appear to be copies/exports from PixelLab generation

### How Sprites Are Loaded (BootScene.ts)

```typescript
// For each creature in demoCreatures array:
this.load.image(`front-${sprite}`, `/game/sprites/front/${sprite}.png`);
this.load.image(`back-${sprite}`, `/game/sprites/back/${sprite}.png`);
// PixelLab pro sprites:
this.load.image(`sw-${sprite}`, `/game/sprites/sw/${sprite}.png`);  // enemy front view
this.load.image(`ne-${sprite}`, `/game/sprites/ne/${sprite}.png`);  // player back view
```

In **BattleScene**, sprite key selection:
- **Player's creature** (bottom-left): prefers `ne-{sprite}` (NE view = back-side facing camera), falls back to `back-{sprite}`
- **Enemy creature** (top-right): prefers `sw-{sprite}` (SW view = front-side facing camera), falls back to `front-{sprite}`

### Player Character Sprites

4 static directional sprites in `storefront/public/game/sprites/player/`:
- `player-south.png` (facing camera)
- `player-north.png` (facing away)
- `player-east.png` (facing right)
- `player-west.png` (facing left)

Source files in `game/sprites/characters/`:
- `player-m-front.png`, `player-m-back.png`, `player-m-left.png`, `player-m-battle.png`, `player-m-portrait.png`
- `player-f-front.png`, `player-f-back.png`, `player-f-left.png`, `player-f-battle.png`, `player-f-portrait.png`

### Hub Building Sprites

All in `storefront/public/game/sprites/hub/`:

| File | Phaser Key | Purpose |
|---|---|---|
| `tienda-v2.png` | `hub-shop` | RYO Shop (buy items) |
| `farmaporro-v2.png` | `hub-heal` | FarmaPorro healing center |
| `farmaporro.png` | `hub-farmaporro` | FarmaPorro (original side-view, kept as fallback) |
| `fountain.png` | `hub-fountain` | Decorative fountain |
| `palm-tree.png` | `hub-palm` | Palm tree decoration |
| `sculpture.png` | `hub-sculpture` | Plaza sculpture |
| `museo-v2.png` | `hub-dex` | Museo (Dex building) |
| `mototaxi-v2.png` | `hub-mototaxi` | Mototaxi (dungeon access) |
| `bench.png` | `hub-bench` | Park bench |
| `lamp.png` | `hub-lamp` | Street lamp |
| `bush-flowers.png` | `hub-bush` | Flowering bush |
| `flower-bed.png` | `hub-flowerbed` | Flower bed |
| `mango-tree.png` | `hub-mango` | Mango tree |
| `potted-plant.png` | `hub-pot` | Potted plant |
| `plaza-bg.png` / `plaza-bg-v4.png` | `hub-plaza-bg` | Pre-rendered background image |

Other hub files (not loaded in BootScene): `dex-building.png`, `grass-crack.png`, `heal-center.png`, `mototaxi.png` (v1), `park-entrance.png`, `shop.png` (v1)

### Battle Backgrounds

9 battle backgrounds in `storefront/public/game/sprites/zones/`, each with v1 and v2:

| Key | File | Zone |
|---|---|---|
| `bg-penalver` | `bg-01-penalver.png` | Parque Penalver |
| `bg-cuevas` | `bg-02-cuevas.png` | Cuevas del Cabriales |
| `bg-cabriales` | `bg-03-cabriales.png` | Rio Cabriales |
| `bg-reda` | `bg-04-reda.png` | CC Reda Building |
| `bg-sambil` | `bg-05-sambil.png` | Sambil Valencia |
| `bg-casupo` | `bg-06-casupo.png` | Cerro Casupo |
| `bg-casco` | `bg-07-casco.png` | Casco Historico |
| `bg-caribbean` | `bg-08-caribbean.png` | CC Caribbean |
| `bg-vinedo` | `bg-09-vinedo.png` | El Vinedo (hub wild area) |

9 battle platforms: `platform-{zone}.png` for ground beneath creatures.

### Zone Exterior Art

In `game/sprites/zones/` -- source art for zone selection/previews (25 files + backup/).

---

## 5. GAME DESIGN

### 10 Types with Effectiveness Chart

Types: HUMO, BRASA, HIERBA, CRISTAL, TIERRA, AGUA, VIENTO, RESINA, METAL, ESPIRITU

**Key relationships:**
- Primary triangle: BRASA > HIERBA > AGUA > BRASA
- Secondary triangle: CRISTAL > VIENTO > HUMO > RESINA > CRISTAL
- TIERRA is immune to VIENTO
- STAB: x1.5 bonus for same-type moves
- Dual-type creatures multiply effectiveness (can be x4 or x0.25)

### 150 Creatures (Organized by Evolutionary Lines)

50 evolutionary lines, most are 2-stage or 3-stage. Organized by Dex number:

| Line | IDs | Name | Types | Stages |
|---|---|---|---|---|
| 1 (Starter) | 001-003 | Cogollito > Cogollero > Cogolord | HIERBA > HIERBA > HIERBA/RESINA | 3 |
| 2 (Starter) | 004-006 | Mechita > Flamero > Infernal | BRASA > BRASA > BRASA/METAL | 3 |
| 3 (Starter) | 007-009 | Gotirro > Cabrialin > Cabriator | AGUA > AGUA > AGUA/TIERRA | 3 |
| 4 | 010-012 | Jalita > Ventolero > Huracanal | VIENTO > VIENTO > VIENTO/AGUA | 3 |
| 5 | 013-015 | Bonguito > Bonglass > Prismorfo | CRISTAL > CRISTAL > CRISTAL/ESPIRITU | 3 |
| 6 | 016-018 | Arepita > Arepaso > Arepaking | TIERRA > TIERRA > TIERRA/BRASA | 3 |
| 7 | 019-021 | Grindito > Grindark > Moledron | METAL > METAL > METAL/HIERBA | 3 |
| 8 | 022-024 | Humito > Nebuloso > Fumantis | HUMO > HUMO > HUMO/ESPIRITU | 3 |
| 9 | 025-027 | Terpino > Terpenol > Dabmaster | RESINA > RESINA > RESINA/BRASA | 3 |
| 10 | 028-030 | Calmita > Serenox > Nirvanol | ESPIRITU > ESPIRITU > ESPIRITU/HUMO | 3 |
| ... | 031-150 | See GDD for full list | Various | 2-3 |

Rarities: Common (C), Uncommon, Rare (R), Epic (E), Legendary (L). Creature #150 is the final boss legendary.

Thematic inspiration: Venezuelan culture (arepas, cunaguaro, cachapa, turpial, Rio Cabriales) + smoking culture (cogollos, grinders, bongs, hash, terpenos, dabbing, papelillos).

### 12 Dungeons

| # | Name | Real Location | Floors | Levels | Types |
|---|---|---|---|---|---|
| 1 | Cuevas del Cabriales | Rio Cabriales | 5 | 1-8 | AGUA/TIERRA |
| 2 | Parque Fernando Penalver | Parque Penalver | 6 | 5-12 | HIERBA/VIENTO |
| 3 | Ruinas de La Pastora | Iglesia La Pastora | 7 | 10-18 | ESPIRITU/TIERRA |
| 4 | Mercado Municipal | Mercado de Valencia | 7 | 12-20 | Mixed |
| 5 | Fabrica Abandonada | Zona industrial | 8 | 15-25 | METAL/BRASA |
| 6 | Cerro El Cafe | Cerro El Cafe | 8 | 18-28 | HUMO/VIENTO/HIERBA |
| 7 | Acuario de Valencia | Acuario de Valencia | 9 | 22-32 | AGUA/CRISTAL |
| 8 | Campo de Carabobo | Campo de Carabobo | 10 | 25-35 | BRASA/METAL/TIERRA |
| 9 | Universidad de Carabobo | UC campus | 10 | 28-38 | RESINA/CRISTAL/HIERBA |
| 10 | Torres del Teleferico | Teleferico de Valencia | 12 | 32-42 | VIENTO/ESPIRITU |
| 11 | CC Reda Building | Reda Building mall | 12 | 36-46 | ESPIRITU/METAL/CRISTAL |
| 12 | Sambil Valencia | Sambil mall | 15 | 40-50 | All types (final) |

Each dungeon has a unique boss creature (legendary/epic). Dungeon #12 boss is creature #150.

### Hub: El Vinedo / Plaza de las Esculturas

- Grid-based movement (16px tiles, 20x16 grid)
- Pre-rendered background image + sprite overlays for buildings
- Interactable buildings: Tienda (shop), FarmaPorro (heal), Museo (dex), Mototaxi (dungeons)
- Decorative elements: fountain, palm trees, benches, lamps, bushes, sculptures, mango tree
- Move speed: 120ms per grid step

### Items

Categories: heal, capture, battle, special. Defined in `items.json`.

Key items:
- Pociones (heal HP): Pocion, Super Pocion, Pocion Max
- Papelillos (capture): Basico, Pro, Ultra, Maestro (increasing ball multiplier)
- Revivir (revive fainted creature)
- Stat boosts (ATK/DEF/SPD)
- Piedra Evolucion, Repelente, Antidoto

### Capture System

- Uses `catchRate` (0-255) from creature data + `ballMultiplier` from capture item
- BattleManager calculates shake count (0-3) and success
- BattleScene animates: wobble shakes, then either shrink+fade (success) or pop out (failure)
- Captured creature added to team (if < 6) or box

### Evolution System

- Level-based: creature evolves when reaching `evolution.level`
- HP delta preserved (damage carries over)
- Moves recalculated for new species at current level
- BattleScene plays evolution animation: 3 white flashes, sprite swap, congratulatory message

---

## 6. KNOWN ISSUES & BUGS

1. **Hub building perspective mismatch** -- Building sprites (tienda, farmaporro, museo) were generated at inconsistent angles. Some are side-view, some are 3/4 view. The hub background is top-down/bird's-eye. Need to regenerate all buildings at consistent front-view perspective using PixelLab.

2. **FarmaPorro side-view** -- The `farmaporro.png` sprite is clearly a side-view building. A `farmaporro-v2.png` was created to fix this, but may still not match the desired perspective.

3. **Hub collision grid** -- Players can get stuck at grid boundaries. The `isBlocked()` function checks `collisionGrid[ty][tx]` but edge cases at map borders (`tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H`) can create stuck states.

4. **Battle HP animation timing** -- BattleManager mutates creature HP immediately when calculating damage, but the BattleScene needs to show the old HP until the attack animation plays. The `hpSnapshot` system was added to fix this: HP is snapshotted before `executePlayerAction()`, and the UI reads from the snapshot during animation. After the damage tween completes, the snapshot is updated to real values. This is mostly working but can still show brief incorrect values in edge cases with multi-hit or status damage.

5. **Wang tileset corner transitions** -- The `WANG_TO_GRID` mapping in DungeonScene doesn't perfectly handle all corner cases, leading to some visual artifacts where floor meets wall.

6. **Only 12 creatures loaded** -- BootScene only preloads sprites for creatures 001-012. Entering dungeons with creatures 013+ will show missing sprites. Need to implement on-demand sprite loading per dungeon.

7. **No error handling for missing sprites** -- If a sprite key is not found, Phaser shows the default missing texture (green rectangle). Should add fallback logic.

8. **Battle uses both CreatureInstance types** -- There are two `CreatureInstance` interfaces: one in `types.ts` (used by CreatureManager/SaveManager) and one in `BattleManager.ts`. The `toBattleCreature()` function bridges them, but this duplication is fragile.

---

## 7. IMMEDIATE NEXT STEPS (Priority Order)

### HIGH PRIORITY

1. **Fix hub visuals** -- Generate new front-view building sprites with PixelLab MCP at consistent perspective. Regenerate `plaza-bg.png` to look more like a real Venezuelan plaza. Fix collision grid.

2. **On-demand sprite loading** -- Implement lazy loading of creature sprites in DungeonScene/BattleScene. Only load sprites for creatures in the current dungeon's encounter list + player team.

3. **Generate remaining PixelLab creature sprites** -- Need SW + NE views for all 150 creatures (currently only 9 starters have them). This is needed for high-quality battle visuals.

4. **Add audio** -- Battle music (looping BGM), victory jingle, capture SFX, attack SFFs, menu blips. Use Web Audio API or Phaser's audio system.

5. **Complete dungeon tilesets** -- Generate 6 more themed tilesets (caves, mall, mountain, colonial, etc.) using PixelLab's `create_topdown_tileset` or `create_tiles_pro`.

### MEDIUM PRIORITY

6. **Zone selection map** -- Build a visual map screen showing Valencia with dungeon locations. Player taps a zone to enter.

7. **Full NPC dialogue system** -- Implement dialogue boxes with portraits for hub NPCs.

8. **Team management screen** -- Full-screen team view with stats, moves, held items.

9. **Item/type icons** -- Generate 18 item icons + 10 type icons (16x16 pixel art).

10. **Battle effects** -- Spritesheet-based attack animations per type (leaf slash, fire burst, water splash, etc.).

### LOW PRIORITY

11. **Walking animations** -- 2-3 frame walk cycles for player character.

12. **Deploy to VPS** -- Build Next.js storefront, deploy to Hostinger VPS at enrola.shop.

13. **Points sync with Medusa** -- Connect Club Enrola points to actual Medusa customer loyalty system.

14. **Difficulty balancing** -- Playtest all 12 dungeons, tune level ranges and encounter rates.

---

## 8. API KEYS & SERVICES

### PixelLab MCP

- **Service:** PixelLab AI pixel art generation (pixellab.ai)
- **Access:** Available as MCP server in this Claude Code environment
- **Available tools:** `create_character`, `animate_character`, `create_isometric_tile`, `create_topdown_tileset`, `create_sidescroller_tileset`, `create_tiles_pro`, `create_map_object`, `list_characters`, etc.
- **Usage model:** Subscription-based with credit fallback
- **How it was used:** Generated 8-directional sprites for the 9 starter creatures. Each creature was created as a character, then views were generated for front, back, north, south, east, west, NE, SW.
- **NOTE:** Only starters (001-009) have PixelLab sprites. The remaining 141 creatures only have OpenAI front/back sprites.

### OpenAI API

- **Used for:** Generating 150 front sprites (56x56) + 150 back sprites (48x48) + NPC character sprites + battle backgrounds + zone art
- **Scripts:** `game/sprites/generate-all.sh`, `generate-part2.sh`, `gen-backsprite.py`, `generate-backsprites.sh`
- **Model used:** DALL-E 3 / DALL-E 2 (via shell scripts with curl calls)
- **NOT configured as MCP** -- was used via direct API calls in shell scripts

### Hostinger VPS

- **MCP configured:** Yes, in `.mcp.json` with `hostinger-api-mcp` and API token
- **Purpose:** Deployment target for the entire enrola.shop stack

### Notion

- **MCP configured:** Yes, in `.mcp.json`
- **Workspace:** "RYO Shop" with dev board and documentation
- **Page ID:** `32565164ef3a812caedde132b3521069`

---

## 9. IMPORTANT DESIGN DECISIONS

### Battle Sprite Orientation

- **Player's creature** (bottom-left of screen): Uses **NE view** (`ne-XXX`) which shows the creature's back-side. This is the "looking away from camera" perspective, similar to Pokemon's back sprites. Falls back to `back-XXX` (OpenAI back sprite) if NE not available.
- **Enemy creature** (top-right of screen): Uses **SW view** (`sw-XXX`) which shows the creature's front-side facing the player. Falls back to `front-XXX` (OpenAI front sprite) if SW not available.

### Hub Rendering Strategy

- Uses a **pre-rendered background image** (`plaza-bg.png`) instead of tile-by-tile rendering
- Building sprites are placed as Phaser images on top of the background at specific pixel coordinates
- Grid-based movement with a collision grid overlay
- This approach was chosen for visual quality (a single painted background looks better than tiles) but makes it harder to modify layout

### Dungeon Rendering Strategy

- Uses **procedural BSP generation** for floor layouts
- Renders tiles using a **Wang tileset** (4x4 grid = 16 tiles) where each tile index is determined by neighbor context
- Each tile is a 16x16 pixel sprite from the tileset spritesheet
- Camera zoom x2 in dungeon view for overworld feel
- Encounter checks happen on each player step (percentage-based)

### Rex UI Plugin

- Imported as `phaser3-rex-plugins/templates/ui/ui-plugin.js`
- Mapped as scene plugin with key `"rexUI"`
- Used for: creating rounded rectangles and styled UI panels in BattleScene
- Import is dynamic (`await import(...)`) to avoid SSR issues in Next.js

### Resolution & Zoom

- Base canvas: **480x320** (landscape, GBA-like aspect ratio)
- GDD originally specified 320x240 but the actual implementation uses 480x320
- Hub and dungeon scenes apply camera zoom x2, making the effective visible area 240x160 pixels (true GBA resolution)
- Battle scene does NOT zoom -- uses full 480x320 for UI layout

### Color Palette

The game uses enrola.shop brand colors:
- Orange/Red: `#E84B2B` (0xe84b2b) -- accent, titles, highlights
- Cream: `#F5F0E8` (0xf5f0e8) -- text, light backgrounds
- Dark: `#1A1A1A` (0x1a1a1a) -- backgrounds
- Green (HP full): `#44CC44`
- Yellow (HP mid): `#CCCC44`
- Red (HP low): `#CC4444`
- Gold border: `#C4B48A` (battle UI panels)

### Creature Art Style

From `ART-STYLE-GUIDE.md`:
- **Canvas:** 56x56 px (front), 48x48 (back)
- **Colors per sprite:** 4 total: black outline + 2 body tones + white/transparent
- **Outline:** 1px black (#000000), fully closed
- **Light source:** Top-left (highlights top-left, shadows bottom-right)
- **Shading:** 2 tones only (body + highlight), NO dithering
- **Anti-aliasing:** NONE. Hard edges, clean pixels
- **Reference:** Pokemon Crystal / Pokemon Prism (GBC era) but more minimalist

---

## APPENDIX: Quick Reference File Paths

```
# Game source code
storefront/src/app/juego/GameClient.tsx
storefront/src/app/juego/page.tsx
storefront/src/app/juego/scenes/BootScene.ts
storefront/src/app/juego/scenes/TitleScene.ts
storefront/src/app/juego/scenes/StarterSelectScene.ts
storefront/src/app/juego/scenes/HubScene.ts
storefront/src/app/juego/scenes/DungeonScene.ts
storefront/src/app/juego/scenes/BattleScene.ts
storefront/src/app/juego/scenes/DexScene.ts
storefront/src/app/juego/lib/types.ts
storefront/src/app/juego/lib/BattleManager.ts
storefront/src/app/juego/lib/CreatureManager.ts
storefront/src/app/juego/lib/DungeonGenerator.ts
storefront/src/app/juego/lib/SaveManager.ts

# Game data (JSON)
storefront/public/game/data/creatures.json
storefront/public/game/data/moves.json
storefront/public/game/data/type-chart.json
storefront/public/game/data/items.json
storefront/public/game/data/dungeons.json

# Design documents
docs/GDD-ENROLA-LEGENDS.md
docs/ENROLA-LEGENDS-SESSION-CONTEXT.md (this file)
game/ASSETS-PENDIENTES.md
game/sprites/ART-STYLE-GUIDE.md
game/sprites/GENERATION-PLAN.md
```
