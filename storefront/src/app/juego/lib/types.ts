// ─── Enrola Legends – TypeScript Interfaces ───────────────────────────────

// ─── Literal Types ─────────────────────────────────────────────────────────

export type CreatureType =
  | "HIERBA"
  | "BRASA"
  | "AGUA"
  | "CRISTAL"
  | "TIERRA"
  | "HUMO"
  | "VIENTO"
  | "RESINA"
  | "METAL"
  | "ESPIRITU"
  | "TODOS";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type MoveCategory = "physical" | "special" | "status";

export type StatusEffect =
  | "burn"
  | "freeze"
  | "poison"
  | "confuse"
  | "stat_up_atk"
  | "stat_up_def"
  | "stat_up_spd"
  | "stat_down_atk"
  | "stat_down_def"
  | "stat_down_spd"
  | "heal";

export type ItemCategory = "heal" | "capture" | "battle" | "special";

// ─── Base Data Interfaces (from JSON) ──────────────────────────────────────

/** Matches creatures.json entries */
export interface CreatureData {
  id: number;
  name: string;
  types: CreatureType[]; // 1-2 types
  stats: {
    hp: number;
    atk: number;
    def: number;
    spd: number;
    spe: number;
  };
  movesLearn: Record<string, number>; // level (string key) -> move ID
  evolution: { to: number; level: number } | null;
  rarity: Rarity;
  catchRate: number; // 0-255
  sprite: string; // e.g. "001-cogollito"
}

/** Matches moves.json entries */
export interface MoveData {
  id: number;
  name: string;
  type: CreatureType;
  power: number; // 0 for status moves
  accuracy: number; // 0-100
  pp: number;
  category: MoveCategory;
  effect: StatusEffect | null;
  description: string;
}

/** Matches items.json effect field */
export type ItemEffect =
  | { type: "heal_hp"; value: number }
  | { type: "revive"; value: number }
  | { type: "cure_status"; value: string }
  | { type: "capture"; value: number }
  | { type: "boost_stat"; stat: string; stages: number }
  | { type: "evolve"; value: number }
  | { type: "relearn_moves"; value: number }
  | { type: "repel"; value: number }
  | { type: "escape_dungeon"; value: number };

/** Matches items.json entries */
export interface ItemData {
  id: number;
  name: string;
  category: ItemCategory;
  effect: ItemEffect;
  price: number;
  description: string;
  usableInBattle: boolean;
}

/** Matches dungeons.json entries */
export interface DungeonData {
  id: number;
  name: string;
  theme: string;
  floors: number;
  levelRange: [number, number];
  types: CreatureType[];
  boss: { creatureId: number; level: number };
  encounters: number[]; // creature IDs
  tileset: string;
  bgBattle: string;
  description: string;
}

/**
 * Matches type-chart.json
 * Outer key = attacking type, inner key = defending type, value = multiplier
 */
export type TypeChart = Record<
  Exclude<CreatureType, "TODOS">,
  Record<Exclude<CreatureType, "TODOS">, number>
>;

// ─── Runtime Instances (in-battle) ─────────────────────────────────────────

export interface CreatureInstance {
  data: CreatureData;
  nickname: string | null;
  level: number;
  currentHp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  moves: number[]; // move IDs, max 4
  status: StatusEffect | null;
  statStages: { atk: number; def: number; spd: number; spe: number }; // -6 to +6
}

export interface BattleState {
  playerTeam: CreatureInstance[];
  activePlayerIndex: number;
  enemyTeam: CreatureInstance[];
  activeEnemyIndex: number;
  isPlayerTurn: boolean;
  turnCount: number;
  isWild: boolean; // wild encounter vs trainer battle
  canRun: boolean;
  battleLog: string[];
}

export interface BattleAction {
  type: "attack" | "switch" | "item" | "run";
  moveIndex?: number; // for attack
  switchTo?: number; // for switch (team index)
  itemId?: number; // for item
}

// ─── Battle Results ────────────────────────────────────────────────────────

export interface DamageResult {
  damage: number;
  effectiveness: number; // 0, 0.5, 1, or 2
  isCrit: boolean;
  isStab: boolean;
}

export interface CaptureResult {
  success: boolean;
  shakes: number; // 0-3, for animation
}

export interface LevelUpResult {
  newLevel: number;
  newMoveId: number | null; // move learned at this level
  evolved: boolean;
  evolvedTo: number | null; // creature ID
  statGains: { hp: number; atk: number; def: number; spd: number; spe: number };
}

// ─── Player Save Data ──────────────────────────────────────────────────────

export interface PlayerSave {
  team: CreatureInstance[];
  box: CreatureInstance[]; // stored creatures
  inventory: { itemId: number; quantity: number }[];
  dex: number[]; // creature IDs seen/caught
  currentDungeon: number | null;
  currentFloor: number;
  points: number; // Club Enrola points
  gender: "m" | "f";
  badges: number[]; // dungeon IDs completed
}
