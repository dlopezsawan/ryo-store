// ─── Enrola Legends – CreatureManager (pure logic, no Phaser) ───────────────

import type {
  CreatureData,
  MoveData,
  CreatureInstance,
  LevelUpResult,
  StatusEffect,
} from "./types";

const LEVEL_CAP = 50;
const STARTER_LEVEL = 5;
const STARTER_IDS = [1, 4, 7] as const; // Cogollito, Mechita, Gotirro

/**
 * Stage multiplier table.
 * Stage 0 = 1.0, each positive stage adds 0.5, each negative subtracts ~proportionally.
 * Matches the classic 2/2, 2/3, 2/4 ... 2/8 for negatives, 2/2, 3/2, 4/2 ... 8/2 for positives.
 */
const STAGE_MULTIPLIERS: Record<number, number> = {
  "-6": 2 / 8,
  "-5": 2 / 7,
  "-4": 2 / 6,
  "-3": 2 / 5,
  "-2": 2 / 4,
  "-1": 2 / 3,
  0: 1,
  1: 3 / 2,
  2: 4 / 2,
  3: 5 / 2,
  4: 6 / 2,
  5: 7 / 2,
  6: 8 / 2,
};

export class CreatureManager {
  private creaturesData: CreatureData[];
  private movesData: MoveData[];

  constructor(creaturesData: CreatureData[], movesData: MoveData[]) {
    this.creaturesData = creaturesData;
    this.movesData = movesData;
  }

  // ── Lookups ──────────────────────────────────────────────────────────────

  getCreatureData(id: number): CreatureData | undefined {
    return this.creaturesData.find((c) => c.id === id);
  }

  getMoveData(id: number): MoveData | undefined {
    return this.movesData.find((m) => m.id === id);
  }

  // ── Stat Calculations ────────────────────────────────────────────────────

  /**
   * HP = floor(((base_hp * 2) * level / 100) + level + 10)
   */
  calculateHp(baseHp: number, level: number): number {
    return Math.floor(((baseHp * 2) * level) / 100 + level + 10);
  }

  /**
   * Stat (atk/def/spd/spe) = floor(((base * 2) * level / 100) + 5)
   */
  calculateStat(baseStat: number, level: number): number {
    return Math.floor(((baseStat * 2) * level) / 100 + 5);
  }

  /**
   * Apply stat stage modifier (-6 to +6) to a calculated stat value.
   */
  getEffectiveStat(base: number, stage: number): number {
    const clamped = Math.max(-6, Math.min(6, stage));
    return Math.floor(base * (STAGE_MULTIPLIERS[clamped] ?? 1));
  }

  // ── Move Selection ───────────────────────────────────────────────────────

  /**
   * Return the last 4 move IDs a creature would know at the given level.
   * movesLearn keys are stringified level numbers; we pick all moves whose
   * learn-level <= given level, sorted ascending, then take the last 4.
   */
  getMovesAtLevel(creatureId: number, level: number): number[] {
    const creature = this.getCreatureData(creatureId);
    if (!creature) return [];

    const learned = Object.entries(creature.movesLearn)
      .map(([lvl, moveId]) => ({ lvl: Number(lvl), moveId }))
      .filter((e) => e.lvl <= level)
      .sort((a, b) => a.lvl - b.lvl)
      .map((e) => e.moveId);

    // Keep the last 4 (most recently learned)
    return learned.slice(-4);
  }

  // ── XP / Leveling ───────────────────────────────────────────────────────

  /**
   * XP required to reach the NEXT level from the given level.
   * Simple cubic curve: level^3
   */
  xpToNextLevel(level: number): number {
    if (level >= LEVEL_CAP) return Infinity;
    return level * level * level;
  }

  /**
   * Add XP to a creature, processing level-ups (and possible evolution) one
   * at a time. Returns an array of LevelUpResult for each level gained.
   */
  addXP(creature: CreatureInstance, xp: number): LevelUpResult[] {
    const results: LevelUpResult[] = [];

    creature.xp += xp;

    while (creature.level < LEVEL_CAP && creature.xp >= creature.xpToNext) {
      creature.xp -= creature.xpToNext;

      const prevLevel = creature.level;
      creature.level += 1;

      // Recalculate stats
      const prevMaxHp = creature.maxHp;
      const newMaxHp = this.calculateHp(creature.data.stats.hp, creature.level);
      const hpGain = newMaxHp - prevMaxHp;
      creature.maxHp = newMaxHp;
      creature.currentHp = Math.min(creature.currentHp + hpGain, newMaxHp);

      const prevAtk = this.calculateStat(creature.data.stats.atk, prevLevel);
      const prevDef = this.calculateStat(creature.data.stats.def, prevLevel);
      const prevSpd = this.calculateStat(creature.data.stats.spd, prevLevel);
      const prevSpe = this.calculateStat(creature.data.stats.spe, prevLevel);

      const newAtk = this.calculateStat(creature.data.stats.atk, creature.level);
      const newDef = this.calculateStat(creature.data.stats.def, creature.level);
      const newSpd = this.calculateStat(creature.data.stats.spd, creature.level);
      const newSpe = this.calculateStat(creature.data.stats.spe, creature.level);

      // Check for a new move at this level
      const moveKey = String(creature.level);
      let newMoveId: number | null = null;
      if (creature.data.movesLearn[moveKey] !== undefined) {
        newMoveId = creature.data.movesLearn[moveKey];
        if (!creature.moves.includes(newMoveId)) {
          if (creature.moves.length < 4) {
            creature.moves.push(newMoveId);
          } else {
            // Replace the oldest move (index 0)
            creature.moves.shift();
            creature.moves.push(newMoveId);
          }
        }
      }

      // Check evolution
      let evolved = false;
      let evolvedTo: number | null = null;

      if (this.canEvolve(creature)) {
        const evolvedInstance = this.evolve(creature);
        // Copy evolved data back into the same reference
        creature.data = evolvedInstance.data;
        creature.maxHp = evolvedInstance.maxHp;
        creature.currentHp = evolvedInstance.currentHp;
        creature.moves = evolvedInstance.moves;
        evolved = true;
        evolvedTo = evolvedInstance.data.id;
      }

      creature.xpToNext = this.xpToNextLevel(creature.level);

      results.push({
        newLevel: creature.level,
        newMoveId,
        evolved,
        evolvedTo,
        statGains: {
          hp: hpGain,
          atk: newAtk - prevAtk,
          def: newDef - prevDef,
          spd: newSpd - prevSpd,
          spe: newSpe - prevSpe,
        },
      });
    }

    // Clamp leftover XP at cap
    if (creature.level >= LEVEL_CAP) {
      creature.xp = 0;
      creature.xpToNext = Infinity;
    }

    return results;
  }

  // ── Evolution ────────────────────────────────────────────────────────────

  /**
   * Check if a creature has reached its evolution level.
   */
  canEvolve(creature: CreatureInstance): boolean {
    const evo = creature.data.evolution;
    if (!evo) return false;
    return creature.level >= evo.level;
  }

  /**
   * Evolve a creature into its next form.
   * Recalculates HP (keeping damage delta), recalculates moves.
   */
  evolve(creature: CreatureInstance): CreatureInstance {
    const evo = creature.data.evolution;
    if (!evo) return creature;

    const evolvedData = this.getCreatureData(evo.to);
    if (!evolvedData) return creature;

    const newMaxHp = this.calculateHp(evolvedData.stats.hp, creature.level);
    const damageTaken = creature.maxHp - creature.currentHp;
    const newCurrentHp = Math.max(1, newMaxHp - damageTaken);

    const moves = this.getMovesAtLevel(evolvedData.id, creature.level);

    return {
      data: evolvedData,
      nickname: creature.nickname,
      level: creature.level,
      currentHp: newCurrentHp,
      maxHp: newMaxHp,
      xp: creature.xp,
      xpToNext: this.xpToNextLevel(creature.level),
      moves,
      status: creature.status,
      statStages: { ...creature.statStages },
    };
  }

  // ── Instance Creation ────────────────────────────────────────────────────

  /**
   * Create a fresh CreatureInstance for the given creature at a given level.
   */
  createInstance(creatureId: number, level: number): CreatureInstance {
    const data = this.getCreatureData(creatureId);
    if (!data) {
      throw new Error(`Creature ID ${creatureId} not found`);
    }

    const clampedLevel = Math.max(1, Math.min(LEVEL_CAP, level));
    const maxHp = this.calculateHp(data.stats.hp, clampedLevel);
    const moves = this.getMovesAtLevel(creatureId, clampedLevel);

    return {
      data,
      nickname: null,
      level: clampedLevel,
      currentHp: maxHp,
      maxHp,
      xp: 0,
      xpToNext: this.xpToNextLevel(clampedLevel),
      moves,
      status: null,
      statStages: { atk: 0, def: 0, spd: 0, spe: 0 },
    };
  }

  // ── Wild Encounters ──────────────────────────────────────────────────────

  /**
   * Create a random wild creature for a dungeon encounter.
   * Picks a random creature ID from the encounter list and a random level
   * within [levelMin, levelMax].
   */
  createWildEncounter(
    encounterIds: number[],
    levelMin: number,
    levelMax: number,
  ): CreatureInstance {
    if (encounterIds.length === 0) {
      throw new Error("Encounter list is empty");
    }

    const randomIndex = Math.floor(Math.random() * encounterIds.length);
    const creatureId = encounterIds[randomIndex];

    const min = Math.max(1, levelMin);
    const max = Math.min(LEVEL_CAP, levelMax);
    const level = min + Math.floor(Math.random() * (max - min + 1));

    return this.createInstance(creatureId, level);
  }

  // ── Starters ─────────────────────────────────────────────────────────────

  /**
   * Create the 3 starter creatures at level 5.
   * #1 Cogollito (Hierba), #4 Mechita (Brasa), #7 Gotirro (Agua)
   */
  getStarters(): [CreatureInstance, CreatureInstance, CreatureInstance] {
    return [
      this.createInstance(STARTER_IDS[0], STARTER_LEVEL),
      this.createInstance(STARTER_IDS[1], STARTER_LEVEL),
      this.createInstance(STARTER_IDS[2], STARTER_LEVEL),
    ];
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  /**
   * Heal a creature to full HP and clear any status condition.
   * Also resets stat stages.
   */
  healFull(creature: CreatureInstance): void {
    creature.currentHp = creature.maxHp;
    creature.status = null;
    creature.statStages = { atk: 0, def: 0, spd: 0, spe: 0 };
  }

  /**
   * Returns true if the creature has 0 HP.
   */
  isFainted(creature: CreatureInstance): boolean {
    return creature.currentHp <= 0;
  }
}
