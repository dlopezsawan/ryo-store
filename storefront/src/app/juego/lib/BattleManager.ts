// ─────────────────────────────────────────────────────────────
// BattleManager.ts – Core battle logic engine for Enrola Legends
// Pure logic, NO Phaser dependency, NO rendering.
// ─────────────────────────────────────────────────────────────

// ── Inline types (will be replaced by ./types when that file lands) ────

/** Type effectiveness chart: attackType → defenderType → multiplier */
export type TypeChart = Record<string, Record<string, number>>;

export interface MoveData {
  id: number;
  name: string;
  type: string;
  power: number;
  accuracy: number;
  pp: number;
  category: "physical" | "special" | "status";
  effect: string | null;
  description: string;
}

export interface CreatureStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  spe: number;
}

export interface CreatureSpecies {
  id: number;
  name: string;
  types: string[];
  stats: CreatureStats;
  movesLearn: Record<string, number>; // level → moveId
  evolution: { to: number; level: number } | null;
  rarity: string;
  catchRate: number;
  sprite: string;
}

export interface StatStages {
  atk: number;
  def: number;
  spd: number;
  spe: number;
}

export interface CreatureInstance {
  uid: string;
  species: CreatureSpecies;
  nickname: string;
  level: number;
  xp: number;
  xpToNext: number;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  spe: number;
  moves: number[]; // move IDs (max 4)
  pp: Record<number, number>; // moveId → remaining PP
  status: StatusEffect | null;
  statusTurns: number;
  statStages: StatStages;
  fainted: boolean;
}

export type StatusEffect =
  | "burn"
  | "poison"
  | "freeze"
  | "paralyze"
  | "sleep"
  | "confuse"
  | null;

export interface BattleState {
  playerTeam: CreatureInstance[];
  enemyTeam: CreatureInstance[];
  activePlayerIndex: number;
  activeEnemyIndex: number;
  isWild: boolean;
  turn: number;
  over: boolean;
  winner: "player" | "enemy" | null;
}

export type BattleAction =
  | { type: "move"; moveId: number }
  | { type: "switch"; index: number }
  | { type: "item"; itemId: string; target?: number }
  | { type: "capture"; ballMultiplier: number }
  | { type: "run" };

export interface DamageResult {
  damage: number;
  effectiveness: number; // 0, 0.25, 0.5, 1, 2, 4
  isCrit: boolean;
  stab: number;
}

export interface CaptureResult {
  success: boolean;
  shakes: number; // 0-3 shakes before breaking / capture
}

// ── BattleEvent union for the scene to animate ──────────────
export type BattleEvent =
  | { type: "message"; text: string }
  | { type: "damage"; target: "player" | "enemy"; damage: number; effectiveness: number; isCrit: boolean }
  | { type: "faint"; target: "player" | "enemy" }
  | { type: "status"; target: "player" | "enemy"; effect: string }
  | { type: "heal"; target: "player" | "enemy"; amount: number }
  | { type: "switch"; side: "player" | "enemy"; newIndex: number }
  | { type: "capture"; shakes: number; success: boolean }
  | { type: "xp"; amount: number; levelUp: boolean; newLevel: number; newMove: number | null; evolved: boolean }
  | { type: "run"; success: boolean }
  | { type: "battleEnd"; winner: "player" | "enemy" };

// ── Stat stage multiplier table (index 0 = -6, index 6 = 0, index 12 = +6) ──
const STAT_STAGE_MULTIPLIERS: number[] = [
  2 / 8, // -6
  2 / 7, // -5
  2 / 6, // -4
  2 / 5, // -3
  2 / 4, // -2
  2 / 3, // -1
  2 / 2, //  0
  3 / 2, // +1
  4 / 2, // +2
  5 / 2, // +3
  6 / 2, // +4
  7 / 2, // +5
  8 / 2, // +6
];

function clampStage(stage: number): number {
  return Math.max(-6, Math.min(6, stage));
}

function stageMultiplier(stage: number): number {
  return STAT_STAGE_MULTIPLIERS[clampStage(stage) + 6];
}

// ── BattleManager ───────────────────────────────────────────

export class BattleManager {
  private state!: BattleState;
  private typeChart: TypeChart;
  private moves: Map<number, MoveData>;

  constructor(typeChart: TypeChart, moves: MoveData[]) {
    this.typeChart = typeChart;
    this.moves = new Map();
    for (const m of moves) {
      this.moves.set(m.id, m);
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  getMove(id: number): MoveData {
    const m = this.moves.get(id);
    if (!m) throw new Error(`Move ${id} not found`);
    return m;
  }

  getState(): BattleState {
    return this.state;
  }

  // ── Initialize a battle ──────────────────────────────────

  initBattle(
    playerTeam: CreatureInstance[],
    enemyTeam: CreatureInstance[],
    isWild: boolean,
  ): BattleState {
    this.state = {
      playerTeam,
      enemyTeam,
      activePlayerIndex: 0,
      activeEnemyIndex: 0,
      isWild,
      turn: 0,
      over: false,
      winner: null,
    };
    return this.state;
  }

  // ── Active creatures ─────────────────────────────────────

  getActivePlayer(): CreatureInstance {
    return this.state.playerTeam[this.state.activePlayerIndex];
  }

  getActiveEnemy(): CreatureInstance {
    return this.state.enemyTeam[this.state.activeEnemyIndex];
  }

  // ── Turn order ───────────────────────────────────────────

  determineTurnOrder(): "player" | "enemy" {
    const pSpd =
      this.getActivePlayer().spd *
      stageMultiplier(this.getActivePlayer().statStages.spd);
    const eSpd =
      this.getActiveEnemy().spd *
      stageMultiplier(this.getActiveEnemy().statStages.spd);
    if (pSpd === eSpd) return Math.random() < 0.5 ? "player" : "enemy";
    return pSpd >= eSpd ? "player" : "enemy";
  }

  // ── Execute player action ────────────────────────────────

  executePlayerAction(action: BattleAction): BattleEvent[] {
    const events: BattleEvent[] = [];
    this.state.turn++;

    // ── Switches and run always go first ───────────────────
    if (action.type === "run") {
      return this.handleRun(events);
    }

    if (action.type === "capture") {
      return this.handleCapture(action.ballMultiplier, events);
    }

    if (action.type === "switch") {
      events.push(...this.handleSwitch("player", action.index));
      events.push(...this.executeEnemyTurn());
      this.pushEndOfTurnEffects(events);
      return events;
    }

    // ── Move-based action: determine order ────────────────
    const first = this.determineTurnOrder();

    if (first === "player") {
      events.push(...this.executeMoveAction("player", action));
      if (this.checkBattleEnd(events)) return events;
      events.push(...this.executeEnemyTurn());
      if (this.checkBattleEnd(events)) return events;
    } else {
      events.push(...this.executeEnemyTurn());
      if (this.checkBattleEnd(events)) return events;
      events.push(...this.executeMoveAction("player", action));
      if (this.checkBattleEnd(events)) return events;
    }

    this.pushEndOfTurnEffects(events);
    this.checkBattleEnd(events);
    return events;
  }

  // ── Execute enemy AI turn ────────────────────────────────

  executeEnemyTurn(): BattleEvent[] {
    const enemy = this.getActiveEnemy();
    if (enemy.fainted) return [];
    const action = this.chooseEnemyAction();
    return this.executeMoveAction("enemy", action);
  }

  // ── Execute a move action for a side ─────────────────────

  private executeMoveAction(
    side: "player" | "enemy",
    action: BattleAction,
  ): BattleEvent[] {
    const events: BattleEvent[] = [];
    if (action.type !== "move") return events;

    const attacker = side === "player" ? this.getActivePlayer() : this.getActiveEnemy();
    const defender = side === "player" ? this.getActiveEnemy() : this.getActivePlayer();
    const targetSide: "player" | "enemy" = side === "player" ? "enemy" : "player";

    if (attacker.fainted) return events;

    // Frozen: 20% chance to thaw each turn
    if (attacker.status === "freeze") {
      if (Math.random() < 0.2) {
        attacker.status = null;
        attacker.statusTurns = 0;
        events.push({ type: "message", text: `${attacker.nickname} se descongeló!` });
      } else {
        events.push({ type: "message", text: `${attacker.nickname} está congelado y no puede moverse!` });
        return events;
      }
    }

    // Paralysis: 25% chance to skip turn
    if (attacker.status === "paralyze" && Math.random() < 0.25) {
      events.push({ type: "message", text: `${attacker.nickname} está paralizado y no puede moverse!` });
      return events;
    }

    // Confusion: 33% chance to hit self
    if (attacker.status === "confuse") {
      attacker.statusTurns--;
      if (attacker.statusTurns <= 0) {
        attacker.status = null;
        events.push({ type: "message", text: `${attacker.nickname} ya no está confuso!` });
      } else if (Math.random() < 0.33) {
        const selfDmg = Math.max(1, Math.floor(attacker.maxHp / 8));
        this.applyDamage(attacker, selfDmg);
        events.push({ type: "message", text: `${attacker.nickname} se hirió a sí mismo por la confusión!` });
        events.push({ type: "damage", target: side, damage: selfDmg, effectiveness: 1, isCrit: false });
        if (attacker.fainted) {
          events.push({ type: "faint", target: side });
          this.handleFaint(side, events);
        }
        return events;
      }
    }

    const move = this.getMove(action.moveId);

    // Deduct PP
    if (attacker.pp[move.id] !== undefined) {
      attacker.pp[move.id] = Math.max(0, attacker.pp[move.id] - 1);
    }

    events.push({
      type: "message",
      text: `${attacker.nickname} usa ${move.name}!`,
    });

    // Accuracy check
    if (Math.random() * 100 > move.accuracy) {
      events.push({ type: "message", text: `¡El ataque falló!` });
      return events;
    }

    // Status move
    if (move.category === "status") {
      events.push(...this.handleStatusMove(attacker, defender, move, side, targetSide));
      return events;
    }

    // Damaging move
    const result = this.calculateDamage(attacker, defender, move.id);
    const fainted = this.applyDamage(defender, result.damage);

    events.push({
      type: "damage",
      target: targetSide,
      damage: result.damage,
      effectiveness: result.effectiveness,
      isCrit: result.isCrit,
    });

    if (result.effectiveness > 1) {
      events.push({ type: "message", text: `¡Es súper efectivo!` });
    } else if (result.effectiveness < 1 && result.effectiveness > 0) {
      events.push({ type: "message", text: `No es muy efectivo...` });
    } else if (result.effectiveness === 0) {
      events.push({ type: "message", text: `No afecta a ${defender.nickname}...` });
    }

    if (result.isCrit) {
      events.push({ type: "message", text: `¡Golpe crítico!` });
    }

    // Secondary effects on damaging moves
    if (move.effect && move.power > 0 && !fainted) {
      const eff = move.effect as string;

      // Recoil damage (self-damage based on damage dealt)
      if (eff === "recoil_25") {
        const recoil = Math.max(1, Math.floor(result.damage * 0.25));
        this.applyDamage(attacker, recoil);
        events.push({ type: "message", text: `${attacker.nickname} sufrio dano de retroceso!` });
      } else if (eff === "recoil_33") {
        const recoil = Math.max(1, Math.floor(result.damage * 0.33));
        this.applyDamage(attacker, recoil);
        events.push({ type: "message", text: `${attacker.nickname} sufrio dano de retroceso!` });
      }

      // Drain (heal attacker for % of damage dealt)
      if (eff === "drain_50") {
        const heal = Math.max(1, Math.floor(result.damage * 0.5));
        const actual = Math.min(heal, attacker.maxHp - attacker.currentHp);
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
        if (actual > 0) {
          events.push({ type: "heal", target: side, amount: actual });
          events.push({ type: "message", text: `${attacker.nickname} absorbi energia!` });
        }
      }

      // High crit (already handled in calculateDamage via higher crit rate)
      // Flinch chance (skip defender's turn — simplified: just show message)
      if (eff === "flinch_20" && Math.random() < 0.2) {
        events.push({ type: "message", text: `${defender.nickname} retrocedio!` });
      } else if (eff === "flinch_30" && Math.random() < 0.3) {
        events.push({ type: "message", text: `${defender.nickname} retrocedio!` });
      }

      // Status chance effects (burn, poison, freeze with %)
      if (eff === "burn_10" && Math.random() < 0.1) {
        if (this.applyStatusEffect(defender, "burn"))
          events.push({ type: "status", target: targetSide, effect: "burn" });
      } else if (eff === "poison_20" && Math.random() < 0.2) {
        if (this.applyStatusEffect(defender, "poison"))
          events.push({ type: "status", target: targetSide, effect: "poison" });
      } else if (eff === "poison_30" && Math.random() < 0.3) {
        if (this.applyStatusEffect(defender, "poison"))
          events.push({ type: "status", target: targetSide, effect: "poison" });
      } else if (eff === "freeze_10" && Math.random() < 0.1) {
        if (this.applyStatusEffect(defender, "freeze"))
          events.push({ type: "status", target: targetSide, effect: "freeze" });
      }

      // Stat modifications from damaging moves
      if (eff === "stat_down_def_target") {
        this.modifyStatStage(defender, "def", -1);
        events.push({ type: "message", text: `La DEF de ${defender.nickname} bajo!` });
      } else if (eff === "stat_down_spd_target") {
        this.modifyStatStage(defender, "spd", -1);
        events.push({ type: "message", text: `La VEL de ${defender.nickname} bajo!` });
      } else if (eff === "stat_down_spe_target") {
        this.modifyStatStage(defender, "spe", -1);
        events.push({ type: "message", text: `El ESP de ${defender.nickname} bajo!` });
      }
    }

    if (fainted) {
      events.push({ type: "faint", target: targetSide });
      this.handleFaint(targetSide, events);
    }

    return events;
  }

  // ── Handle status moves ──────────────────────────────────

  private handleStatusMove(
    attacker: CreatureInstance,
    defender: CreatureInstance,
    move: MoveData,
    attackerSide: "player" | "enemy",
    defenderSide: "player" | "enemy",
  ): BattleEvent[] {
    const events: BattleEvent[] = [];

    const eff = move.effect as string;

    // ── Status ailments ──
    if (["burn", "poison", "freeze", "paralyze", "confuse"].includes(eff)) {
      const applied = this.applyStatusEffect(defender, eff);
      if (applied) {
        events.push({ type: "status", target: defenderSide, effect: eff });
        const names: Record<string, string> = {
          burn: "quemado", poison: "envenenado", freeze: "congelado",
          paralyze: "paralizado", confuse: "confuso",
        };
        events.push({ type: "message", text: `${defender.nickname} fue ${names[eff] ?? eff}!` });
      } else {
        events.push({ type: "message", text: `No tuvo efecto!` });
      }
    }
    // ── Heal self ──
    else if (eff === "heal_self_50" || eff === "heal" || eff === "heal_self_25") {
      const pct = eff === "heal_self_25" ? 0.25 : 0.5;
      const healAmount = Math.max(1, Math.floor(attacker.maxHp * pct));
      const actual = Math.min(healAmount, attacker.maxHp - attacker.currentHp);
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
      events.push({ type: "heal", target: attackerSide, amount: actual });
      events.push({ type: "message", text: `${attacker.nickname} recupero salud!` });
    }
    else if (eff === "heal_self_100_sleep") {
      attacker.currentHp = attacker.maxHp;
      attacker.status = "sleep";
      events.push({ type: "heal", target: attackerSide, amount: attacker.maxHp });
      events.push({ type: "message", text: `${attacker.nickname} descanso y recupero todo el HP! Pero se durmio.` });
    }
    // ── Self stat boosts (+1) ──
    else if (eff === "stat_up_atk") {
      this.modifyStatStage(attacker, "atk", 1);
      events.push({ type: "message", text: `El ATK de ${attacker.nickname} subio!` });
    } else if (eff === "stat_up_def") {
      this.modifyStatStage(attacker, "def", 1);
      events.push({ type: "message", text: `La DEF de ${attacker.nickname} subio!` });
    } else if (eff === "stat_up_spd") {
      this.modifyStatStage(attacker, "spd", 1);
      events.push({ type: "message", text: `La VEL de ${attacker.nickname} subio!` });
    } else if (eff === "stat_up_spe") {
      this.modifyStatStage(attacker, "spe", 1);
      events.push({ type: "message", text: `El ESP de ${attacker.nickname} subio!` });
    }
    // ── Self stat boosts (+2) ──
    else if (eff === "stat_up_atk_2") {
      this.modifyStatStage(attacker, "atk", 2);
      events.push({ type: "message", text: `El ATK de ${attacker.nickname} subio mucho!` });
    } else if (eff === "stat_up_spd_2") {
      this.modifyStatStage(attacker, "spd", 2);
      events.push({ type: "message", text: `La VEL de ${attacker.nickname} subio mucho!` });
    }
    // ── Target stat drops (-1) ──
    else if (eff === "stat_down_atk_target") {
      this.modifyStatStage(defender, "atk", -1);
      events.push({ type: "message", text: `El ATK de ${defender.nickname} bajo!` });
    } else if (eff === "stat_down_def_target") {
      this.modifyStatStage(defender, "def", -1);
      events.push({ type: "message", text: `La DEF de ${defender.nickname} bajo!` });
    } else if (eff === "stat_down_spd_target") {
      this.modifyStatStage(defender, "spd", -1);
      events.push({ type: "message", text: `La VEL de ${defender.nickname} bajo!` });
    } else if (eff === "stat_down_spe_target") {
      this.modifyStatStage(defender, "spe", -1);
      events.push({ type: "message", text: `El ESP de ${defender.nickname} bajo!` });
    } else if (eff === "stat_down_acc_target") {
      // Accuracy not tracked as stat stage yet — treat as SPE down
      this.modifyStatStage(defender, "spe", -1);
      events.push({ type: "message", text: `La precision de ${defender.nickname} bajo!` });
    }
    // ── Protect ──
    else if (eff === "protect") {
      events.push({ type: "message", text: `${attacker.nickname} se protegio!` });
      // Simplified: just a message, full protect needs turn-blocking logic
    }
    // ── Default ──
    else {
      events.push({ type: "message", text: `Pero no paso nada!` });
    }

    return events;
  }

  // ── Stat stage modification ──────────────────────────────

  private modifyStatStage(
    creature: CreatureInstance,
    stat: keyof StatStages,
    delta: number,
  ): void {
    creature.statStages[stat] = clampStage(creature.statStages[stat] + delta);
  }

  // ── Damage calculation ───────────────────────────────────
  // Formula: (((2*level/5+2) * power * atk/def) / 50 + 2) * STAB * typeEff * crit * random

  calculateDamage(
    attacker: CreatureInstance,
    defender: CreatureInstance,
    moveId: number,
  ): DamageResult {
    const move = this.getMove(moveId);

    if (move.power === 0) {
      return { damage: 0, effectiveness: 1, isCrit: false, stab: 1 };
    }

    const level = attacker.level;
    const power = move.power;

    // Pick atk/def based on category
    let atkStat: number;
    let defStat: number;
    if (move.category === "physical") {
      atkStat = attacker.atk * stageMultiplier(attacker.statStages.atk);
      defStat = defender.def * stageMultiplier(defender.statStages.def);
    } else {
      // special — uses spe for both attack AND defense
      atkStat = attacker.spe * stageMultiplier(attacker.statStages.spe);
      defStat = defender.spe * stageMultiplier(defender.statStages.spe);
    }

    // Burn halves physical attack
    if (attacker.status === "burn" && move.category === "physical") {
      atkStat *= 0.5;
    }

    const stab = this.getStab(attacker, move.type);
    const effectiveness = this.getTypeEffectiveness(move.type, defender.species.types);

    // Critical hit: 1/16 normally, 1/4 for high_crit moves, 1.5x damage
    const critChance = move.effect === "high_crit" ? 1 / 4 : 1 / 16;
    const isCrit = Math.random() < critChance;
    const critMultiplier = isCrit ? 1.5 : 1.0;

    // Random factor 0.85-1.0
    const random = Math.random() * 0.15 + 0.85;

    let damage =
      (((2 * level) / 5 + 2) * power * (atkStat / defStat)) / 50 + 2;
    damage *= stab * effectiveness * critMultiplier * random;
    damage = Math.max(1, Math.floor(damage));

    // If effectiveness is 0, no damage
    if (effectiveness === 0) damage = 0;

    return { damage, effectiveness, isCrit, stab };
  }

  // ── Type effectiveness ───────────────────────────────────

  getTypeEffectiveness(attackType: string, defenderTypes: string[]): number {
    let mult = 1;
    for (const defType of defenderTypes) {
      const row = this.typeChart[attackType];
      if (row && row[defType] !== undefined) {
        mult *= row[defType];
      }
    }
    return mult;
  }

  // ── STAB ─────────────────────────────────────────────────

  getStab(creature: CreatureInstance, moveType: string): number {
    return creature.species.types.includes(moveType) ? 1.5 : 1.0;
  }

  // ── Apply damage ─────────────────────────────────────────

  applyDamage(target: CreatureInstance, damage: number): boolean {
    target.currentHp = Math.max(0, target.currentHp - damage);
    if (target.currentHp === 0) {
      target.fainted = true;
      target.status = null;
      target.statusTurns = 0;
    }
    return target.fainted;
  }

  // ── Apply status effect ──────────────────────────────────

  applyStatusEffect(target: CreatureInstance, effect: string): boolean {
    // Can't stack non-volatile status (burn/poison/freeze/paralyze)
    const nonVolatile = ["burn", "poison", "freeze", "paralyze"];
    if (nonVolatile.includes(effect) && target.status !== null) {
      return false;
    }

    // Confuse is semi-volatile, can stack on top of a non-volatile status
    if (effect === "confuse") {
      if (target.status === "confuse") return false;
      // We track confuse through status field only if no other status; otherwise we still allow it
      // For simplicity, confuse replaces status tracking (in a full game, volatile statuses are separate)
      if (target.status !== null && nonVolatile.includes(target.status)) {
        // Already has a non-volatile status; for now, skip confusion
        return false;
      }
    }

    switch (effect) {
      case "burn":
        target.status = "burn";
        target.statusTurns = 0;
        return true;
      case "poison":
        target.status = "poison";
        target.statusTurns = 0;
        return true;
      case "freeze":
        target.status = "freeze";
        target.statusTurns = 0;
        return true;
      case "paralyze":
        target.status = "paralyze";
        target.statusTurns = 0;
        return true;
      case "confuse":
        target.status = "confuse";
        target.statusTurns = 2 + Math.floor(Math.random() * 4); // 2-5 turns
        return true;
      default:
        return false;
    }
  }

  // ── End-of-turn effects ──────────────────────────────────

  processEndOfTurnEffects(creature: CreatureInstance): number {
    if (creature.fainted || !creature.status) return 0;

    let damage = 0;
    switch (creature.status) {
      case "burn":
        damage = Math.max(1, Math.floor(creature.maxHp / 16));
        this.applyDamage(creature, damage);
        break;
      case "poison":
        damage = Math.max(1, Math.floor(creature.maxHp / 8));
        this.applyDamage(creature, damage);
        break;
      // Freeze and paralyze don't deal residual damage
      default:
        break;
    }
    return damage;
  }

  private pushEndOfTurnEffects(events: BattleEvent[]): void {
    const player = this.getActivePlayer();
    const enemy = this.getActiveEnemy();

    if (!player.fainted && (player.status === "burn" || player.status === "poison")) {
      const dmg = this.processEndOfTurnEffects(player);
      if (dmg > 0) {
        const label = player.status === "burn" ? "quemadura" : "veneno";
        events.push({ type: "message", text: `${player.nickname} sufre daño por ${label}!` });
        events.push({ type: "damage", target: "player", damage: dmg, effectiveness: 1, isCrit: false });
        if (player.fainted) {
          events.push({ type: "faint", target: "player" });
          this.handleFaint("player", events);
        }
      }
    }

    if (!enemy.fainted && (enemy.status === "burn" || enemy.status === "poison")) {
      const dmg = this.processEndOfTurnEffects(enemy);
      if (dmg > 0) {
        const label = enemy.status === "burn" ? "quemadura" : "veneno";
        events.push({ type: "message", text: `${enemy.nickname} sufre daño por ${label}!` });
        events.push({ type: "damage", target: "enemy", damage: dmg, effectiveness: 1, isCrit: false });
        if (enemy.fainted) {
          events.push({ type: "faint", target: "enemy" });
          this.handleFaint("enemy", events);
        }
      }
    }
  }

  // ── Capture ──────────────────────────────────────────────
  // Formula: catchRate * (3*maxHp - 2*currentHp) / (3*maxHp) * ballMultiplier

  attemptCapture(
    target: CreatureInstance,
    ballMultiplier: number,
  ): CaptureResult {
    if (!this.state.isWild) {
      return { success: false, shakes: 0 };
    }

    const catchRate = target.species.catchRate;
    const modifiedRate =
      (catchRate * (3 * target.maxHp - 2 * target.currentHp)) /
      (3 * target.maxHp) *
      ballMultiplier;

    // Status bonuses
    let statusBonus = 1;
    if (target.status === "freeze" || target.status === "paralyze") statusBonus = 2;
    else if (target.status === "burn" || target.status === "poison") statusBonus = 1.5;

    const finalRate = modifiedRate * statusBonus;

    // Max catch rate is 255
    const shakeChance = finalRate / 255;

    // Each of the 3 shakes must pass independently
    let shakes = 0;
    for (let i = 0; i < 3; i++) {
      if (Math.random() < shakeChance) {
        shakes++;
      } else {
        break;
      }
    }

    const success = shakes === 3;
    return { success, shakes };
  }

  private handleCapture(ballMultiplier: number, events: BattleEvent[]): BattleEvent[] {
    const enemy = this.getActiveEnemy();
    events.push({ type: "message", text: `¡Lanzas una bola de captura!` });

    const result = this.attemptCapture(enemy, ballMultiplier);
    events.push({ type: "capture", shakes: result.shakes, success: result.success });

    if (result.success) {
      events.push({ type: "message", text: `¡${enemy.nickname} fue capturado!` });
      this.state.over = true;
      this.state.winner = "player";
      events.push({ type: "battleEnd", winner: "player" });
    } else {
      events.push({ type: "message", text: `¡${enemy.nickname} se liberó!` });
      // Enemy gets a free turn after failed capture
      events.push(...this.executeEnemyTurn());
      this.pushEndOfTurnEffects(events);
      this.checkBattleEnd(events);
    }

    return events;
  }

  // ── Run ──────────────────────────────────────────────────

  canRun(): boolean {
    return this.state.isWild;
  }

  private handleRun(events: BattleEvent[]): BattleEvent[] {
    if (this.canRun()) {
      events.push({ type: "run", success: true });
      events.push({ type: "message", text: `¡Escapaste con éxito!` });
      this.state.over = true;
    } else {
      events.push({ type: "run", success: false });
      events.push({ type: "message", text: `¡No puedes huir de un combate contra entrenador!` });
      // Enemy attacks
      events.push(...this.executeEnemyTurn());
      this.pushEndOfTurnEffects(events);
      this.checkBattleEnd(events);
    }
    return events;
  }

  // ── Switch ───────────────────────────────────────────────

  private handleSwitch(side: "player" | "enemy", index: number): BattleEvent[] {
    const events: BattleEvent[] = [];
    const team = side === "player" ? this.state.playerTeam : this.state.enemyTeam;

    if (index < 0 || index >= team.length || team[index].fainted) {
      events.push({ type: "message", text: `¡No puedes cambiar a ese criatura!` });
      return events;
    }

    const old = side === "player"
      ? this.state.playerTeam[this.state.activePlayerIndex]
      : this.state.enemyTeam[this.state.activeEnemyIndex];

    // Reset stat stages on switch-out
    old.statStages = { atk: 0, def: 0, spd: 0, spe: 0 };

    if (side === "player") {
      this.state.activePlayerIndex = index;
    } else {
      this.state.activeEnemyIndex = index;
    }

    const newCreature = side === "player" ? this.getActivePlayer() : this.getActiveEnemy();
    events.push({ type: "switch", side, newIndex: index });
    events.push({
      type: "message",
      text: `¡Adelante, ${newCreature.nickname}!`,
    });

    return events;
  }

  // ── XP ───────────────────────────────────────────────────
  // baseXP = defeated.species.stats.hp (using HP as base XP proxy)
  // Formula: baseXP * enemyLevel / 5

  calculateXP(defeated: CreatureInstance): number {
    const baseXP = defeated.species.stats.hp;
    return Math.max(1, Math.floor((baseXP * defeated.level) / 5));
  }

  private awardXP(events: BattleEvent[]): void {
    const player = this.getActivePlayer();
    const enemy = this.getActiveEnemy();

    if (!enemy.fainted || player.fainted) return;

    const xpGain = this.calculateXP(enemy);
    player.xp += xpGain;

    let leveledUp = false;
    let newLevel = player.level;
    let newMove: number | null = null;
    let evolved = false;

    // Level up loop
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level++;
      newLevel = player.level;
      leveledUp = true;

      // Recalculate stats on level up (simple linear scaling)
      const base = player.species.stats;
      player.maxHp = Math.floor(((base.hp * 2 * player.level) / 100) + player.level + 10);
      player.atk = Math.floor(((base.atk * 2 * player.level) / 100) + 5);
      player.def = Math.floor(((base.def * 2 * player.level) / 100) + 5);
      player.spd = Math.floor(((base.spd * 2 * player.level) / 100) + 5);
      player.spe = Math.floor(((base.spe * 2 * player.level) / 100) + 5);

      // Heal proportion of level-up HP gain
      const hpGain = player.maxHp - player.currentHp;
      if (hpGain > 0) {
        player.currentHp = Math.min(player.maxHp, player.currentHp + Math.floor(hpGain * 0.25));
      }

      // XP to next level formula: level^3
      player.xpToNext = player.level * player.level * player.level;

      // Check for new moves at this level
      const learnAtLevel = player.species.movesLearn[String(player.level)];
      if (learnAtLevel !== undefined) {
        if (player.moves.length < 4) {
          player.moves.push(learnAtLevel);
          const moveData = this.moves.get(learnAtLevel);
          if (moveData) {
            player.pp[learnAtLevel] = moveData.pp;
          }
          newMove = learnAtLevel;
        } else {
          // In a full game, prompt player to replace a move. For now, auto-replace weakest.
          newMove = learnAtLevel;
          // Replace the move with lowest power
          let lowestIdx = 0;
          let lowestPower = Infinity;
          for (let i = 0; i < player.moves.length; i++) {
            const m = this.moves.get(player.moves[i]);
            const p = m ? m.power : 0;
            if (p < lowestPower) {
              lowestPower = p;
              lowestIdx = i;
            }
          }
          const replacedMove = player.moves[lowestIdx];
          player.moves[lowestIdx] = learnAtLevel;
          delete player.pp[replacedMove];
          const moveData = this.moves.get(learnAtLevel);
          if (moveData) {
            player.pp[learnAtLevel] = moveData.pp;
          }
        }
      }

      // Check evolution
      if (
        player.species.evolution &&
        player.level >= player.species.evolution.level
      ) {
        // Evolution would be handled by the scene with species data lookup
        // We flag it here; the scene should resolve the new species
        evolved = true;
      }
    }

    events.push({
      type: "xp",
      amount: xpGain,
      levelUp: leveledUp,
      newLevel,
      newMove,
      evolved,
    });
  }

  // ── Faint handling ───────────────────────────────────────

  private handleFaint(side: "player" | "enemy", events: BattleEvent[]): void {
    if (side === "enemy") {
      // Award XP when enemy faints
      this.awardXP(events);

      // Try to send out next enemy creature
      const nextIdx = this.state.enemyTeam.findIndex(
        (c, i) => i !== this.state.activeEnemyIndex && !c.fainted,
      );
      if (nextIdx !== -1) {
        events.push(...this.handleSwitch("enemy", nextIdx));
      }
    } else {
      // Player creature fainted; try to send out next
      const nextIdx = this.state.playerTeam.findIndex(
        (c, i) => i !== this.state.activePlayerIndex && !c.fainted,
      );
      if (nextIdx !== -1) {
        // In a real game, prompt player to choose. Auto-pick first available.
        events.push(...this.handleSwitch("player", nextIdx));
      }
    }
  }

  // ── Battle end check ─────────────────────────────────────

  isBattleOver(): { over: boolean; winner: "player" | "enemy" | null } {
    const playerAlive = this.state.playerTeam.some((c) => !c.fainted);
    const enemyAlive = this.state.enemyTeam.some((c) => !c.fainted);

    if (!playerAlive) {
      return { over: true, winner: "enemy" };
    }
    if (!enemyAlive) {
      return { over: true, winner: "player" };
    }
    return { over: false, winner: null };
  }

  private checkBattleEnd(events: BattleEvent[]): boolean {
    const result = this.isBattleOver();
    if (result.over && !this.state.over) {
      this.state.over = true;
      this.state.winner = result.winner;
      events.push({ type: "battleEnd", winner: result.winner! });
      return true;
    }
    return this.state.over;
  }

  // ── Enemy AI ─────────────────────────────────────────────
  // Strategy: prefer super-effective moves, then highest power

  chooseEnemyAction(): BattleAction {
    const enemy = this.getActiveEnemy();
    const player = this.getActivePlayer();

    // Filter moves with remaining PP
    const availableMoves = enemy.moves.filter(
      (mId) => (enemy.pp[mId] ?? 0) > 0,
    );

    if (availableMoves.length === 0) {
      // Struggle: no moves left, pick first move anyway (0 PP)
      return { type: "move", moveId: enemy.moves[0] };
    }

    // Score each move
    let bestMove = availableMoves[0];
    let bestScore = -Infinity;

    for (const moveId of availableMoves) {
      const move = this.moves.get(moveId);
      if (!move) continue;

      let score = 0;

      if (move.category === "status") {
        // Status moves get a base score
        score = 20;
        // Prefer status moves only if player has no status and enemy has decent HP
        if (player.status !== null) score = 5;
        if (enemy.currentHp < enemy.maxHp * 0.3) score = 2; // don't waste time if low HP

        // Heal moves are high priority when low HP
        if (move.effect === "heal" && enemy.currentHp < enemy.maxHp * 0.5) {
          score = 60;
        }
      } else {
        // Damaging moves: estimate effective power
        const effectiveness = this.getTypeEffectiveness(
          move.type,
          player.species.types,
        );
        const stab = this.getStab(enemy, move.type);
        score = move.power * effectiveness * stab * (move.accuracy / 100);
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = moveId;
      }
    }

    return { type: "move", moveId: bestMove };
  }
}
