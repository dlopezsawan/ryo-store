import * as Phaser from "phaser";
import { BattleManager, BattleEvent, CreatureInstance as BMCreature, MoveData } from "../lib/BattleManager";
import { CreatureManager } from "../lib/CreatureManager";
import { SaveManager } from "../lib/SaveManager";
import type { CreatureInstance as CMCreature, CreatureData, ItemData } from "../lib/types";

const ORANGE = 0xe84b2b;
const CREAM = 0xf5f0e8;
const DARK = 0x1a1a1a;
const GREEN = 0x44cc44;
const YELLOW = 0xcccc44;
const RED = 0xcc4444;

/** Convert CreatureManager instance → BattleManager instance */
function toBattleCreature(cm: CMCreature, movesData: MoveData[]): BMCreature {
  const pp: Record<number, number> = {};
  for (const mId of cm.moves) {
    const move = movesData.find(m => m.id === mId);
    pp[mId] = move?.pp ?? 10;
  }
  const data = cm.data as CreatureData;
  return {
    uid: `${data.id}-${Math.random().toString(36).slice(2, 8)}`,
    species: {
      id: data.id,
      name: data.name,
      types: data.types,
      stats: data.stats,
      movesLearn: data.movesLearn,
      evolution: data.evolution,
      rarity: data.rarity,
      catchRate: data.catchRate,
      sprite: data.sprite,
    },
    nickname: data.name,
    level: cm.level,
    xp: cm.xp,
    xpToNext: cm.xpToNext,
    currentHp: cm.currentHp,
    maxHp: cm.maxHp,
    atk: Math.floor((data.stats.atk * 2 * cm.level / 100) + 5),
    def: Math.floor((data.stats.def * 2 * cm.level / 100) + 5),
    spd: Math.floor((data.stats.spd * 2 * cm.level / 100) + 5),
    spe: Math.floor((data.stats.spe * 2 * cm.level / 100) + 5),
    moves: cm.moves,
    pp,
    status: null,
    statusTurns: 0,
    statStages: { atk: 0, def: 0, spd: 0, spe: 0 },
    fainted: false,
  };
}

type Phase = "menu" | "moves" | "animating" | "switch" | "items" | "gameover";

/** Data passed to BattleScene from DungeonScene or other callers */
interface BattleInitData {
  wildCreatureId?: number;
  wildLevel?: number;
  bgKey?: string;
  returnScene?: string;
  dungeonId?: number;
  floor?: number;
  isBoss?: boolean;
}

export class BattleScene extends Phaser.Scene {
  private battleManager!: BattleManager;
  private creatureManager!: CreatureManager;

  // Init data from caller
  private initData: BattleInitData = {};

  // UI elements
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerNameText!: Phaser.GameObjects.Text;
  private enemyNameText!: Phaser.GameObjects.Text;
  private playerSprite!: Phaser.GameObjects.Rectangle;
  private enemySprite!: Phaser.GameObjects.Rectangle;
  private playerSpriteLabel!: Phaser.GameObjects.Text;
  private enemySpriteLabel!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private menuButtons: { bg: any; text: Phaser.GameObjects.Text }[] = [];
  private moveButtons: { bg: any; text: Phaser.GameObjects.Text }[] = [];

  // XP bar
  private playerXpBar!: Phaser.GameObjects.Rectangle;

  // Sub-menu elements for items and switch
  private subMenuContainer!: Phaser.GameObjects.Container;

  // Design system constants (stored for reuse in methods)
  private C = {
    bg: 0x0c0c0c,
    panel: 0x111111,
    panelHi: 0x1a1a1a,
    border: 0xc4b48a,
    borderDim: 0x3a3a3a,
    accent: 0xe84b2b,
    text: 0xf5f0e8,
    textDim: 0x8a8070,
    textAccent: 0xe84b2b,
    hpGreen: 0x6abf4b,
    hpYellow: 0xd4a832,
    hpRed: 0xcc3333,
    track: 0x1e1e1e,
  };
  private FONT = "Arial, Helvetica, sans-serif";

  // Layout references
  private menuY = 0;
  private bX0 = 0;
  private bY0 = 0;
  private cW = 118;
  private cH = 32;

  private phase: Phase = "menu";
  private eventQueue: BattleEvent[] = [];
  private isProcessing = false;

  // Track which side is attacking for attack animations
  private lastAttackerSide: "player" | "enemy" | null = null;

  // Track if a capture was successful this battle
  private capturedEnemy = false;

  constructor() {
    super({ key: "BattleScene" });
  }

  init(data?: BattleInitData) {
    this.initData = data || {};
  }

  create() {
    const creaturesData = this.registry.get("creaturesData") || [];
    const movesData = this.registry.get("movesData") || [];
    const typeChart = this.registry.get("typeChart") || {};

    this.creatureManager = new CreatureManager(creaturesData, movesData);
    this.battleManager = new BattleManager(typeChart, movesData);

    // ── Build player team from save (if available) or fallback ────────────
    let playerTeam: BMCreature[];

    const save = this.registry.get("playerSave") as import("../lib/types").PlayerSave | undefined;
    if (save && save.team.length > 0) {
      playerTeam = save.team
        .filter(c => c.currentHp > 0)
        .map(c => toBattleCreature(c, movesData));
      // Fallback if entire team is dead (shouldn't happen normally)
      if (playerTeam.length === 0) {
        const fallback = this.creatureManager.createInstance(4, 7);
        playerTeam = [toBattleCreature(fallback, movesData)];
      }
    } else {
      const playerCM = this.creatureManager.createInstance(4, 7); // Mechita lv7 fallback
      playerTeam = [toBattleCreature(playerCM, movesData)];
    }

    // ── Build enemy team from initData or fallback ───────────────────────
    let enemyTeam: BMCreature[];

    if (this.initData.wildCreatureId) {
      const enemyCM = this.creatureManager.createInstance(
        this.initData.wildCreatureId,
        this.initData.wildLevel ?? 5
      );
      enemyTeam = [toBattleCreature(enemyCM, movesData)];
    } else {
      const enemyCM = this.creatureManager.createInstance(1, 5); // Cogollito lv5 fallback
      enemyTeam = [toBattleCreature(enemyCM, movesData)];
    }

    this.battleManager.initBattle(playerTeam, enemyTeam, true);

    this.cameras.main.fadeIn(300);
    this.cameras.main.setBackgroundColor(DARK);

    this.buildBattleUI();
    this.updateUI();

    // Boss battle intro
    if (this.initData.isBoss) {
      this.phase = "animating";
      this.setMenuVisible(false);
      this.cameras.main.flash(400, 200, 30, 30);
      this.logText?.setText("¡JEFE DE MAZMORRA!");
      this.time.delayedCall(1500, () => {
        this.showMenu();
      });
    } else {
      this.showMenu();
    }
  }

  private buildBattleUI() {
    const rexUI = (this as any).rexUI;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const menuH = 80; // compact menu strip at bottom
    const menuY = h - menuH;
    this.menuY = menuY;

    // Battle background — cover (crop) instead of stretch to maintain aspect ratio
    if (this.textures.exists("bg-penalver")) {
      const bg = this.add.image(w / 2, menuY / 2, "bg-penalver");
      const tex = this.textures.get("bg-penalver").getSourceImage();
      const scaleX = w / tex.width;
      const scaleY = menuY / tex.height;
      const scale = Math.max(scaleX, scaleY); // cover = use the larger scale
      bg.setScale(scale);
      bg.setDepth(0);
      // Crop anything below the menu line
      bg.setCrop(0, 0, tex.width, tex.height);
    }

    const C = this.C;
    const FONT = this.FONT;
    const T = {
      label: "8px",
      body: "10px",
      name: "11px",
      title: "9px",
    };

    // Sprite + platform positions — Pokemon-style layout
    const state = this.battleManager.getState();
    const enemyData = state.enemyTeam[state.activeEnemyIndex];
    const playerData = state.playerTeam[state.activePlayerIndex];

    // Use PixelLab pro sprites (SW for enemy, NE for player), fallback to old front/back
    const eSpriteKey = this.textures.exists(`sw-${enemyData.species.sprite}`)
      ? `sw-${enemyData.species.sprite}` : `front-${enemyData.species.sprite}`;
    const pSpriteKey = this.textures.exists(`ne-${playerData.species.sprite}`)
      ? `ne-${playerData.species.sprite}` : `back-${playerData.species.sprite}`;

    // Player: bottom-left, bigger (like Pokemon — player creature is closer)
    const pX = w * 0.18, pY = menuY * 0.78 + 36;
    // Enemy: upper-right, smaller (farther away)
    const eX = w * 0.72, eY = menuY * 0.52;

    // ── PLATFORM OVALS — depth 2, BEHIND creatures ──
    const platforms = this.add.graphics().setDepth(2);
    // Player platform — larger green oval
    platforms.fillStyle(0x509e3c, 0.7);
    platforms.fillEllipse(pX, pY + 10, 147, 34);
    platforms.fillStyle(0x3a7a2c, 0.4);
    platforms.fillEllipse(pX, pY + 12, 158, 29);
    // Enemy platform — green oval
    platforms.fillStyle(0x509e3c, 0.7);
    platforms.fillEllipse(eX, eY + 8, 116, 26);
    platforms.fillStyle(0x3a7a2c, 0.4);
    platforms.fillEllipse(eX, eY + 10, 124, 22);

    // ── CREATURE SPRITES — depth 3, ABOVE platforms ──
    const playerSize = 100;
    const enemySize = 75;

    if (this.textures.exists(eSpriteKey)) {
      const e = this.add.image(eX, eY, eSpriteKey).setDepth(3);
      const eAspect = e.height / e.width;
      e.setDisplaySize(enemySize, enemySize * eAspect);
      // Position: bottom of sprite sits on platform (eY + 8 is platform center)
      e.setOrigin(0.5, 1); // origin at bottom-center
      e.setY(eY + 10); // feet touch top of oval
      if (e.preFX) { e.preFX.setPadding(4); e.preFX.addGlow(0xffc864, 0.25, 0, false); }
      this.enemySprite = e as any;
    } else {
      this.enemySprite = this.add.rectangle(eX, eY - 30, 48, 48, 0x444444).setDepth(3);
    }
    this.enemySpriteLabel = this.add.text(0, 0, "").setVisible(false);

    if (this.textures.exists(pSpriteKey)) {
      const p = this.add.image(pX, pY, pSpriteKey).setDepth(3);
      const pAspect = p.height / p.width;
      p.setDisplaySize(playerSize, playerSize * pAspect);
      // Position: bottom of sprite sits on platform (pY + 10 is platform center)
      p.setOrigin(0.5, 1); // origin at bottom-center
      p.setY(pY + 14); // feet touch top of oval
      if (p.preFX) { p.preFX.setPadding(4); p.preFX.addGlow(0xffc864, 0.25, 0, false); }
      this.playerSprite = p as any;
    } else {
      this.playerSprite = this.add.rectangle(pX, pY - 40, 56, 56, 0x444444).setDepth(3);
    }
    this.playerSpriteLabel = this.add.text(0, 0, "").setVisible(false);

    // ── ENEMY HUD PANEL — Rex roundRectangle, top-left ──
    const eW = 180, eH = 38;
    const enemyPanel = rexUI.add.roundRectangle(8 + eW / 2, 8 + eH / 2, eW, eH, 6, C.panel, 0.88).setDepth(5);
    enemyPanel.setStrokeStyle(1, C.border, 0.45);
    // Orange accent glow line at top via a thin roundRectangle
    const enemyAccent = rexUI.add.roundRectangle(8 + eW / 2, 8 + 1, eW - 4, 2, 1, C.border, 0.6).setDepth(5);

    const enemyNameColor = this.initData.isBoss ? "#CC3333" : "#F5F0E8";
    this.enemyNameText = this.add.text(14, 13, "", {
      fontFamily: FONT, fontStyle: "bold", fontSize: T.name, color: enemyNameColor,
    }).setDepth(6);

    // Boss HP bar red border glow
    if (this.initData.isBoss) {
      const bossGlow = rexUI.add.roundRectangle(14 + (eW - 40) / 2, 30 + 4, eW - 40 + 4, 12, 3, 0x000000, 0).setDepth(5);
      bossGlow.setStrokeStyle(2, 0xcc3333, 0.8);
    }

    // HP bar track (rounded)
    const eBarX = 14, eBarY = 30, eBarW = eW - 40;
    const enemyHpTrack = rexUI.add.roundRectangle(eBarX + eBarW / 2, eBarY + 4, eBarW, 8, 3, C.track).setDepth(5);
    this.enemyHpBar = this.add.rectangle(eBarX, eBarY, eBarW, 8, C.hpGreen).setOrigin(0, 0).setDepth(6);
    this.enemyHpText = this.add.text(eBarX + eBarW + 4, eBarY - 1, "", {
      fontFamily: FONT, fontStyle: "bold", fontSize: T.body, color: "#C4B48A",
    }).setDepth(7);

    // ── PLAYER HUD PANEL — Rex roundRectangle, bottom-right above menu ──
    const pW = 180, pH = 48; // slightly taller to fit XP bar
    const piX = w - pW - 8, piY = menuY - pH - 8;
    const playerPanel = rexUI.add.roundRectangle(piX + pW / 2, piY + pH / 2, pW, pH, 6, C.panel, 0.88).setDepth(5);
    playerPanel.setStrokeStyle(1, C.accent, 0.45);
    // Orange accent line at top
    const playerAccent = rexUI.add.roundRectangle(piX + pW / 2, piY + 1, pW - 4, 2, 1, C.accent, 0.6).setDepth(5);

    this.playerNameText = this.add.text(piX + 6, piY + 5, "", {
      fontFamily: FONT, fontStyle: "bold", fontSize: T.name, color: "#F5F0E8",
    }).setDepth(6);

    const pBarX = piX + 6, pBarY = piY + 22, pBarW = pW - 40;
    const playerHpTrack = rexUI.add.roundRectangle(pBarX + pBarW / 2, pBarY + 4, pBarW, 8, 3, C.track).setDepth(5);
    this.playerHpBar = this.add.rectangle(pBarX, pBarY, pBarW, 8, C.hpGreen).setOrigin(0, 0).setDepth(6);
    this.playerHpText = this.add.text(pBarX + pBarW + 4, pBarY - 1, "", {
      fontFamily: FONT, fontStyle: "bold", fontSize: T.body, color: "#E84B2B",
    }).setDepth(7);

    // ── XP BAR — thin yellow bar below HP bar ──
    const xpBarY = pBarY + 12;
    const xpTrack = rexUI.add.roundRectangle(pBarX + pBarW / 2, xpBarY + 2, pBarW, 4, 2, C.track).setDepth(5);
    this.playerXpBar = this.add.rectangle(pBarX, xpBarY, 0, 4, 0xd4a832).setOrigin(0, 0).setDepth(6);
    // "XP" label
    this.add.text(pBarX + pBarW + 4, xpBarY - 2, "XP", {
      fontFamily: FONT, fontStyle: "bold", fontSize: "7px", color: "#8A8070",
    }).setDepth(7);

    // ── MENU PANEL — Rex roundRectangle dark panel at bottom ──
    const menuPanel = rexUI.add.roundRectangle(w / 2, menuY + menuH / 2, w, menuH, 0, C.bg, 0.95).setDepth(8);
    // Orange accent line at the top edge
    const menuAccentLine = rexUI.add.roundRectangle(w / 2, menuY + 1, w - 2, 2, 1, C.accent, 0.5).setDepth(8);

    // Log — left half
    this.logText = this.add.text(10, menuY + 8, "", {
      fontFamily: FONT, fontStyle: "bold", fontSize: T.name, color: "#C4B48A",
      wordWrap: { width: w * 0.44 }, lineSpacing: 5,
    }).setDepth(9);

    // Thin vertical separator via Rex roundRectangle
    const separator = rexUI.add.roundRectangle(w * 0.48, menuY + menuH / 2, 1, menuH - 8, 0, C.borderDim, 0.3).setDepth(8);

    // ── BUTTONS — Rex roundRectangle backgrounds: ATACAR=red, CAMBIAR=blue, ITEM=green, HUIR=yellow ──
    const acts = ["ATACAR", "CAMBIAR", "ITEM", "HUIR"];
    const btnColors = [0xcc3333, 0x3366aa, 0x44884a, 0xbb8833]; // red, blue, green, gold
    const btnHoverColors = [0xee5555, 0x5588cc, 0x66aa6c, 0xddaa55]; // brighter on hover
    const btnTextColors = ["#FFCCCC", "#CCDDFF", "#CCFFCC", "#FFEECC"];
    const bX0 = w * 0.50, bY0 = menuY + 6, cW = this.cW, cH = this.cH;
    this.bX0 = bX0;
    this.bY0 = bY0;

    acts.forEach((label, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = bX0 + col * cW, y = bY0 + row * cH;
      const bw = cW - 6, bh = cH - 4;
      const cx = x + bw / 2, cy = y + bh / 2;

      // Rex roundRectangle button background
      const bg = rexUI.add.roundRectangle(cx, cy, bw, bh, 8, btnColors[i], 0.85).setDepth(9);
      bg.setStrokeStyle(1, 0x000000, 0.4);
      bg.setInteractive({ useHandCursor: true });

      const text = this.add.text(cx, cy, label, {
        fontFamily: FONT, fontStyle: "bold", fontSize: T.body, color: btnTextColors[i],
        stroke: "#000000", strokeThickness: 1,
      }).setOrigin(0.5).setDepth(10);

      // Disable HUIR button for boss battles
      if (i === 3 && this.initData.isBoss) {
        text.setColor("#555555");
        text.setText("---");
        bg.setFillStyle(0x333333, 0.5);
        bg.disableInteractive();
      } else {
        bg.on("pointerover", () => {
          bg.setFillStyle(btnHoverColors[i], 1);
          bg.setStrokeStyle(2, 0xffffff, 0.3);
          text.setColor("#FFFFFF");
        });
        bg.on("pointerout", () => {
          bg.setFillStyle(btnColors[i], 0.85);
          bg.setStrokeStyle(1, 0x000000, 0.4);
          text.setColor(btnTextColors[i]);
        });
        bg.on("pointerdown", () => this.onMenuSelect(i));
      }
      this.menuButtons.push({ bg, text });
    });

    // ── MOVE BUTTONS (hidden, Rex roundRectangle, red-tinted like FIGHT) ──
    const moveBtnColor = 0x882222;
    const moveBtnHover = 0xaa3333;

    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = bX0 + col * cW, y = bY0 + row * cH;
      const bw = cW - 6, bh = cH - 4;
      const cx = x + bw / 2, cy = y + bh / 2;

      const bg = rexUI.add.roundRectangle(cx, cy, bw, bh, 8, moveBtnColor, 0.85).setDepth(9);
      bg.setStrokeStyle(1, 0x000000, 0.4);
      bg.setInteractive({ useHandCursor: true }).setVisible(false);

      const text = this.add.text(cx, cy, "", {
        fontFamily: FONT, fontStyle: "bold", fontSize: "8px", color: "#FFCCCC",
        stroke: "#000000", strokeThickness: 1,
      }).setOrigin(0.5).setDepth(10).setVisible(false);

      bg.on("pointerover", () => {
        bg.setFillStyle(moveBtnHover, 1);
        bg.setStrokeStyle(2, 0xffffff, 0.25);
        text.setColor("#FFFFFF");
      });
      bg.on("pointerout", () => {
        bg.setFillStyle(moveBtnColor, 0.85);
        bg.setStrokeStyle(1, 0x000000, 0.4);
        text.setColor("#FFCCCC");
      });
      bg.on("pointerdown", () => this.onMoveSelect(i));
      this.moveButtons.push({ bg, text });
    }

    // ── SUB-MENU CONTAINER (for items / switch overlays) ──
    this.subMenuContainer = this.add.container(0, 0).setDepth(15).setVisible(false);
  }

  private updateUI(forceReal?: boolean) {
    const state = this.battleManager.getState();
    const player = state.playerTeam[state.activePlayerIndex];
    const enemy = state.enemyTeam[state.activeEnemyIndex];

    // Use snapshot HP during animations to prevent spoiling damage before it shows
    const snap = (!forceReal && this.hpSnapshot) ? this.hpSnapshot : null;
    const pHp = snap ? snap.playerHp : player.currentHp;
    const pMax = snap ? snap.playerMaxHp : player.maxHp;
    const eHp = snap ? snap.enemyHp : enemy.currentHp;
    const eMax = snap ? snap.enemyMaxHp : enemy.maxHp;

    // Player info
    const pName = player.nickname || player.species?.name || "???";
    this.playerNameText.setText(`${pName.toUpperCase()}  Lv.${player.level}`);
    this.playerHpText.setText(`${pHp}/${pMax}`);
    const pRatio = pMax > 0 ? Math.max(0, pHp / pMax) : 0;
    this.playerHpBar.width = 140 * pRatio;
    this.playerHpBar.fillColor = pRatio > 0.5 ? 0x6abf4b : pRatio > 0.25 ? 0xd4a832 : 0xcc3333;

    // XP bar
    const xpRatio = player.xpToNext > 0 ? Math.min(1, player.xp / player.xpToNext) : 0;
    this.playerXpBar.width = 140 * xpRatio;

    // Enemy info
    const eName = enemy.nickname || enemy.species?.name || "???";
    this.enemyNameText.setText(`${eName.toUpperCase()}  Lv.${enemy.level}`);
    this.enemyHpText.setText(`${eHp}/${eMax}`);
    const eRatio = eMax > 0 ? Math.max(0, eHp / eMax) : 0;
    this.enemyHpBar.width = 140 * eRatio;
    this.enemyHpBar.fillColor = eRatio > 0.5 ? 0x6abf4b : eRatio > 0.25 ? 0xd4a832 : 0xcc3333;

    // Sprite labels (will be replaced with real sprites later)
    const pLabel = pName.substring(0, 3).toUpperCase();
    const eLabel = eName.substring(0, 3).toUpperCase();
    this.playerSpriteLabel.setText(pLabel);
    this.enemySpriteLabel.setText(eLabel);
  }

  private showMenu() {
    this.phase = "menu";
    const state = this.battleManager.getState();
    const player = state.playerTeam[state.activePlayerIndex];
    const pName = player.nickname || player.species?.name || "???";
    this.logText.setText(`¿Qué debería hacer ${pName.toUpperCase()}?`);
    this.setMenuVisible(true);
    this.setMovesVisible(false);
    this.hideSubMenu();
  }

  private showMoves() {
    this.phase = "moves";
    const state = this.battleManager.getState();
    const player = state.playerTeam[state.activePlayerIndex];
    const movesData = this.registry.get("movesData") || [];

    for (let i = 0; i < 4; i++) {
      if (i < player.moves.length) {
        const moveId = player.moves[i];
        const move = movesData.find((m: { id: number }) => m.id === moveId);
        const pp = player.pp?.[moveId] ?? 0;
        if (move && this.moveButtons[i]) {
          this.moveButtons[i].text.setText(`${move.name}  PP:${pp}`);
          this.moveButtons[i].text.setFontSize("9px");
          this.moveButtons[i].bg.setInteractive({ useHandCursor: true });
        }
      } else if (this.moveButtons[i]) {
        this.moveButtons[i].text.setText("—");
        this.moveButtons[i].bg.disableInteractive();
      }
    }

    this.setMenuVisible(false);
    this.setMovesVisible(true);
    this.logText.setText("Elige un movimiento:");
  }

  /** Show the switch creature sub-menu */
  private showSwitchMenu() {
    this.phase = "switch";
    this.setMenuVisible(false);
    this.setMovesVisible(false);
    this.hideSubMenu();

    const state = this.battleManager.getState();
    const team = state.playerTeam;
    const activeIdx = state.activePlayerIndex;

    const w = this.cameras.main.width;
    const FONT = this.FONT;
    const C = this.C;

    // Build sub-menu overlay
    const container = this.subMenuContainer;
    container.removeAll(true);

    // Background panel over right half of menu area
    const panelX = w * 0.02;
    const panelY = this.menuY - (team.length * 28 + 32);
    const panelW = w * 0.96;
    const panelH = team.length * 28 + 32;

    const bg = this.add.graphics();
    bg.fillStyle(C.panel, 0.95);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 4);
    bg.lineStyle(1, C.border, 0.5);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 4);
    container.add(bg);

    // Title
    const title = this.add.text(panelX + 8, panelY + 6, "CAMBIAR CRIATURA", {
      fontFamily: FONT, fontStyle: "bold", fontSize: "9px", color: "#C4B48A",
    });
    container.add(title);

    // List team members
    team.forEach((creature, i) => {
      const yOff = panelY + 24 + i * 28;
      const isFainted = creature.fainted || creature.currentHp <= 0;
      const isActive = i === activeIdx;

      // Row bg
      const rowBg = this.add.rectangle(panelX + panelW / 2, yOff + 12, panelW - 8, 24,
        isActive ? 0x333355 : (isFainted ? 0x331111 : 0x1a1a1a), 0.8)
        .setDepth(0);
      container.add(rowBg);

      const cName = creature.nickname || creature.species?.name || "???";
      const hpRatio = creature.maxHp > 0 ? creature.currentHp / creature.maxHp : 0;
      const hpColor = isFainted ? "#cc3333" : (hpRatio > 0.5 ? "#6abf4b" : (hpRatio > 0.25 ? "#d4a832" : "#cc3333"));

      const label = isActive ? `> ${cName.toUpperCase()} Lv.${creature.level}` : `  ${cName.toUpperCase()} Lv.${creature.level}`;
      const statusSuffix = isFainted ? " [KO]" : (isActive ? " [Activo]" : "");

      const nameText = this.add.text(panelX + 12, yOff + 4, `${label}${statusSuffix}`, {
        fontFamily: FONT, fontStyle: "bold", fontSize: "9px",
        color: isFainted ? "#666666" : (isActive ? "#8888cc" : "#F5F0E8"),
      });
      container.add(nameText);

      // HP text
      const hpText = this.add.text(panelX + panelW - 70, yOff + 4, `${creature.currentHp}/${creature.maxHp}`, {
        fontFamily: FONT, fontStyle: "bold", fontSize: "9px", color: hpColor,
      });
      container.add(hpText);

      // Clickable area (only for non-fainted, non-active)
      if (!isFainted && !isActive) {
        rowBg.setInteractive({ useHandCursor: true });
        rowBg.on("pointerover", () => rowBg.setFillStyle(0x224422, 0.9));
        rowBg.on("pointerout", () => rowBg.setFillStyle(0x1a1a1a, 0.8));
        rowBg.on("pointerdown", () => {
          this.hideSubMenu();
          this.executeTurn({ type: "switch", index: i });
        });
      }
    });

    // Back button
    const backY = panelY + panelH - 4;
    const backText = this.add.text(panelX + 8, backY, "< VOLVER", {
      fontFamily: FONT, fontStyle: "bold", fontSize: "9px", color: "#bb8833",
    }).setInteractive({ useHandCursor: true });
    backText.on("pointerdown", () => this.showMenu());
    container.add(backText);

    container.setVisible(true);
    this.logText.setText("Elige una criatura:");
  }

  /** Show the items sub-menu */
  private showItemsMenu() {
    this.phase = "items";
    this.setMenuVisible(false);
    this.setMovesVisible(false);
    this.hideSubMenu();

    const save = this.registry.get("playerSave") as import("../lib/types").PlayerSave | undefined;
    const itemsData: ItemData[] = this.registry.get("itemsData") || [];

    // Get battle-usable items from inventory
    const battleItems: { itemData: ItemData; quantity: number }[] = [];
    if (save && save.inventory) {
      for (const inv of save.inventory) {
        if (inv.quantity <= 0) continue;
        const data = itemsData.find((it: ItemData) => it.id === inv.itemId);
        if (data && data.usableInBattle) {
          battleItems.push({ itemData: data, quantity: inv.quantity });
        }
      }
    }

    const w = this.cameras.main.width;
    const FONT = this.FONT;
    const C = this.C;

    const container = this.subMenuContainer;
    container.removeAll(true);

    const itemCount = Math.max(battleItems.length, 1);
    const panelX = w * 0.02;
    const panelY = this.menuY - (itemCount * 28 + 32);
    const panelW = w * 0.96;
    const panelH = itemCount * 28 + 32;

    const bg = this.add.graphics();
    bg.fillStyle(C.panel, 0.95);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 4);
    bg.lineStyle(1, C.border, 0.5);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 4);
    container.add(bg);

    const title = this.add.text(panelX + 8, panelY + 6, "ITEMS", {
      fontFamily: FONT, fontStyle: "bold", fontSize: "9px", color: "#C4B48A",
    });
    container.add(title);

    if (battleItems.length === 0) {
      const emptyText = this.add.text(panelX + 12, panelY + 26, "No tienes items para usar en batalla.", {
        fontFamily: FONT, fontSize: "9px", color: "#666666",
      });
      container.add(emptyText);
    } else {
      battleItems.forEach((entry, i) => {
        const yOff = panelY + 24 + i * 28;
        const isCapture = entry.itemData.category === "capture";
        const btnColor = isCapture ? 0x44884a : 0x3366aa;

        const rowBg = this.add.rectangle(panelX + panelW / 2, yOff + 12, panelW - 8, 24,
          btnColor, 0.3).setDepth(0);
        container.add(rowBg);

        const nameText = this.add.text(panelX + 12, yOff + 4,
          `${entry.itemData.name} x${entry.quantity}`, {
          fontFamily: FONT, fontStyle: "bold", fontSize: "9px", color: "#F5F0E8",
        });
        container.add(nameText);

        // Description
        const descText = this.add.text(panelX + panelW - 120, yOff + 4,
          entry.itemData.description?.substring(0, 20) || "", {
          fontFamily: FONT, fontSize: "8px", color: "#8A8070",
        });
        container.add(descText);

        rowBg.setInteractive({ useHandCursor: true });
        rowBg.on("pointerover", () => rowBg.setFillStyle(btnColor, 0.6));
        rowBg.on("pointerout", () => rowBg.setFillStyle(btnColor, 0.3));
        rowBg.on("pointerdown", () => {
          this.hideSubMenu();
          this.useItem(entry.itemData, save!);
        });
      });
    }

    // Back button
    const backY = panelY + panelH - 4;
    const backText = this.add.text(panelX + 8, backY, "< VOLVER", {
      fontFamily: FONT, fontStyle: "bold", fontSize: "9px", color: "#bb8833",
    }).setInteractive({ useHandCursor: true });
    backText.on("pointerdown", () => this.showMenu());
    container.add(backText);

    container.setVisible(true);
    this.logText.setText("Elige un item:");
  }

  /** Use an item from inventory */
  private useItem(item: ItemData, save: import("../lib/types").PlayerSave) {
    // Consume item from inventory
    const invEntry = save.inventory.find(e => e.itemId === item.id);
    if (!invEntry || invEntry.quantity <= 0) {
      this.logText.setText("No tienes ese item.");
      this.time.delayedCall(800, () => this.showMenu());
      return;
    }
    invEntry.quantity--;
    SaveManager.save(save);
    this.registry.set("playerSave", save);

    const effect = item.effect as any;

    if (item.category === "capture" || (effect && effect.type === "capture")) {
      // Capture item: execute capture via BattleManager
      const ballMultiplier = effect?.value ?? 1;
      this.executeTurn({ type: "capture", ballMultiplier });
    } else if (effect && effect.type === "heal_hp") {
      // Heal item: heal active creature
      const state = this.battleManager.getState();
      const player = state.playerTeam[state.activePlayerIndex];
      const healAmt = Math.min(effect.value, player.maxHp - player.currentHp);
      player.currentHp = Math.min(player.maxHp, player.currentHp + effect.value);
      this.phase = "animating";
      this.setMenuVisible(false);
      this.logText.setText(`${player.nickname} recuperó ${healAmt} HP!`);
      this.updateUI();
      // Enemy gets a turn
      const enemyEvents = this.battleManager.executeEnemyTurn();
      this.eventQueue = [...enemyEvents];
      this.time.delayedCall(800, () => this.processNextEvent());
    } else {
      // Generic item: just show message and give enemy a turn
      this.phase = "animating";
      this.setMenuVisible(false);
      this.logText.setText(`Usaste ${item.name}.`);
      const enemyEvents = this.battleManager.executeEnemyTurn();
      this.eventQueue = [...enemyEvents];
      this.time.delayedCall(800, () => this.processNextEvent());
    }
  }

  private hideSubMenu() {
    if (this.subMenuContainer) {
      this.subMenuContainer.removeAll(true);
      this.subMenuContainer.setVisible(false);
    }
  }

  private setMenuVisible(visible: boolean) {
    this.menuButtons.forEach(b => {
      b.bg.setVisible(visible);
      b.text.setVisible(visible);
      if (visible) b.bg.setInteractive({ useHandCursor: true });
      else b.bg.disableInteractive();
    });
  }

  private setMovesVisible(visible: boolean) {
    this.moveButtons.forEach(b => {
      b.bg.setVisible(visible);
      b.text.setVisible(visible);
      if (visible) b.bg.setInteractive({ useHandCursor: true });
      else b.bg.disableInteractive();
    });
  }

  private onMenuSelect(index: number) {
    if (this.phase !== "menu") return;

    switch (index) {
      case 0: // ATACAR
        this.showMoves();
        break;
      case 1: // CAMBIAR
        this.showSwitchMenu();
        break;
      case 2: // ITEM
        this.showItemsMenu();
        break;
      case 3: // HUIR
        this.executeTurn({ type: "run" });
        break;
    }
  }

  private onMoveSelect(index: number) {
    if (this.phase !== "moves") return;
    const state = this.battleManager.getState();
    const player = state.playerTeam[state.activePlayerIndex];
    if (index >= player.moves.length) return;

    this.executeTurn({ type: "move", moveId: player.moves[index] });
  }

  // Snapshot HP values to prevent UI from showing damage before animation
  private hpSnapshot: { playerHp: number; playerMaxHp: number; enemyHp: number; enemyMaxHp: number } | null = null;

  private executeTurn(action: { type: string; moveId?: number; index?: number; ballMultiplier?: number }) {
    this.phase = "animating";
    this.setMenuVisible(false);
    this.setMovesVisible(false);
    this.hideSubMenu();

    // Snapshot HP BEFORE executing (BattleManager mutates HP immediately)
    const state = this.battleManager.getState();
    const p = state.playerTeam[state.activePlayerIndex];
    const e = state.enemyTeam[state.activeEnemyIndex];
    this.hpSnapshot = {
      playerHp: p.currentHp, playerMaxHp: p.maxHp,
      enemyHp: e.currentHp, enemyMaxHp: e.maxHp,
    };

    // Execute player action — BattleManager mutates state and returns events to animate
    const events = this.battleManager.executePlayerAction(action as any);

    // Queue all events
    this.eventQueue = [...events];
    this.processNextEvent();
  }

  private processNextEvent() {
    if (this.eventQueue.length === 0) {
      this.hpSnapshot = null; // Clear snapshot, show real values
      this.updateUI(true);
      const battleOver = this.battleManager.isBattleOver();
      if (battleOver.over) {
        this.phase = "gameover";
        const isCapture = this.capturedEnemy;
        const isVictory = battleOver.winner === "player";

        // Calculate points preview
        let pointsPreview = 0;
        if (isCapture) pointsPreview = 5;
        else if (isVictory && this.initData.isBoss) pointsPreview = 50;
        else if (isVictory) pointsPreview = 10;

        let msg = isCapture ? "¡Captura exitosa!" : (isVictory ? "¡VICTORIA!" : "Has sido derrotado...");

        // Boss victory special message
        if (isVictory && this.initData.isBoss) {
          msg = "¡Mazmorra completada! Insignia conseguida.";
        }

        this.logText.setText(msg);

        // Show points earned after brief delay
        if (pointsPreview > 0) {
          this.time.delayedCall(800, () => {
            this.showFloatingPoints(pointsPreview);
          });
        }

        this.time.delayedCall(2500, () => {
          const endResult = isCapture ? "capture" : (isVictory ? "victory" : "defeat");
          this.endBattle(endResult);
        });
        return;
      }
      this.showMenu();
      return;
    }

    const event = this.eventQueue.shift()!;
    this.animateEvent(event);
  }

  private animateEvent(event: BattleEvent) {
    switch (event.type) {
      case "message": {
        this.logText.setText(event.text);
        // Track attacker side from "usa" messages for attack animation
        const usaMatch = event.text.match(/^(.+) usa (.+)!$/);
        if (usaMatch) {
          // Determine which side is attacking based on the name
          const state = this.battleManager.getState();
          const player = state.playerTeam[state.activePlayerIndex];
          const enemy = state.enemyTeam[state.activeEnemyIndex];
          const attackerName = usaMatch[1];
          if (attackerName === player.nickname) {
            this.lastAttackerSide = "player";
          } else if (attackerName === enemy.nickname) {
            this.lastAttackerSide = "enemy";
          }
        }
        this.time.delayedCall(800, () => {
          this.updateUI();
          this.processNextEvent();
        });
        break;
      }

      case "damage": {
        const target = event.target === "player" ? this.playerSprite : this.enemySprite;
        const attacker = event.target === "player" ? this.enemySprite : this.playerSprite;

        // Determine direction for attack lunge
        const dirX = event.target === "player" ? 1 : -1; // lunge toward target
        const attackerOrigX = attacker.x;

        // Attack lunge animation: move attacker toward target, then back
        this.tweens.add({
          targets: attacker,
          x: attackerOrigX + (dirX * 20),
          duration: 150,
          ease: "Quad.easeIn",
          yoyo: true,
          onComplete: () => {
            attacker.x = attackerOrigX; // ensure reset

            // Now do damage flash on target
            const flash = this.add.rectangle(target.x, target.y, 56, 56, 0xffffff, 0.8).setDepth(20);
            this.time.delayedCall(100, () => flash.destroy());

            // Shake target
            const targetOrigX = target.x;
            this.tweens.add({
              targets: target,
              x: targetOrigX + 4,
              duration: 50,
              yoyo: true,
              repeat: 3,
              onComplete: () => {
                target.x = targetOrigX; // ensure reset
                // Update snapshot to real HP now that damage animation played
                const st = this.battleManager.getState();
                const pp = st.playerTeam[st.activePlayerIndex];
                const ee = st.enemyTeam[st.activeEnemyIndex];
                this.hpSnapshot = { playerHp: pp.currentHp, playerMaxHp: pp.maxHp, enemyHp: ee.currentHp, enemyMaxHp: ee.maxHp };
                this.updateUI();

                // Show effectiveness text if not neutral
                if (event.effectiveness > 1) {
                  this.showEffectivenessText("¡Super efectivo!", "#44cc44", target.x, target.y - 30, () => {
                    this.processNextEvent();
                  });
                } else if (event.effectiveness > 0 && event.effectiveness < 1) {
                  this.showEffectivenessText("Poco efectivo...", "#8a8070", target.x, target.y - 30, () => {
                    this.processNextEvent();
                  });
                } else if (event.effectiveness === 0) {
                  this.showEffectivenessText("Sin efecto", "#666666", target.x, target.y - 30, () => {
                    this.processNextEvent();
                  });
                } else {
                  this.time.delayedCall(300, () => this.processNextEvent());
                }
              }
            });
          }
        });
        break;
      }

      case "faint": {
        const target = event.target === "player" ? this.playerSprite : this.enemySprite;
        const label = event.target === "player" ? this.playerSpriteLabel : this.enemySpriteLabel;
        this.tweens.add({
          targets: [target, label],
          alpha: 0,
          y: target.y + 30,
          duration: 500,
          onComplete: () => {
            this.time.delayedCall(300, () => this.processNextEvent());
          }
        });
        break;
      }

      case "capture": {
        // Capture animation: enemy sprite shakes 1-3 times then captured or breaks free
        const enemySprite = this.enemySprite;
        const origX = enemySprite.x;
        const shakes = event.shakes;
        const success = event.success;

        this.logText.setText("...");

        let shakesDone = 0;
        const doShake = () => {
          if (shakesDone >= shakes) {
            // Done shaking
            if (success) {
              this.capturedEnemy = true;
              // Capture success: shrink and fade
              this.tweens.add({
                targets: enemySprite,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: 400,
                ease: "Back.easeIn",
                onComplete: () => {
                  this.time.delayedCall(300, () => this.processNextEvent());
                }
              });
            } else {
              // Break free: enemy pops back
              this.tweens.add({
                targets: enemySprite,
                x: origX + 8,
                duration: 60,
                yoyo: true,
                repeat: 2,
                onComplete: () => {
                  enemySprite.x = origX;
                  this.time.delayedCall(300, () => this.processNextEvent());
                }
              });
            }
            return;
          }

          // One shake cycle: left-right wobble
          this.tweens.add({
            targets: enemySprite,
            x: origX - 6,
            duration: 100,
            yoyo: true,
            onComplete: () => {
              this.tweens.add({
                targets: enemySprite,
                x: origX + 6,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                  enemySprite.x = origX;
                  shakesDone++;
                  this.time.delayedCall(300, () => doShake());
                }
              });
            }
          });
        };

        // Start shaking after a brief pause
        this.time.delayedCall(400, () => doShake());
        break;
      }

      case "switch": {
        // Handle creature switch: refresh sprite references and UI
        this.updateUI();
        this.time.delayedCall(300, () => this.processNextEvent());
        break;
      }

      case "run":
        if (event.success) {
          this.logText.setText("¡Escapaste con éxito!");
          this.time.delayedCall(1000, () => this.endBattle("run"));
        } else {
          this.logText.setText("¡No pudiste escapar!");
          this.time.delayedCall(800, () => this.processNextEvent());
        }
        break;

      case "xp": {
        this.logText.setText(`+${event.amount} XP`);

        // Animate XP bar fill
        const state = this.battleManager.getState();
        const player = state.playerTeam[state.activePlayerIndex];
        const xpRatio = player.xpToNext > 0 ? Math.min(1, player.xp / player.xpToNext) : 0;
        this.tweens.add({
          targets: this.playerXpBar,
          width: 140 * xpRatio,
          duration: 400,
          ease: "Quad.easeOut",
        });

        if (event.levelUp) {
          this.time.delayedCall(600, () => {
            this.logText.setText(`¡Subió a nivel ${event.newLevel}!`);
            this.updateUI();

            const afterLevelUp = () => {
              // Check for new move
              if (event.newMove !== null) {
                const movesData = this.registry.get("movesData") || [];
                const move = movesData.find((m: { id: number }) => m.id === event.newMove);
                if (move) {
                  this.time.delayedCall(800, () => {
                    this.logText.setText(`¡Aprendió ${move.name}!`);
                    this.time.delayedCall(800, () => this.processNextEvent());
                  });
                  return;
                }
              }
              this.time.delayedCall(800, () => this.processNextEvent());
            };

            // Check for evolution
            if (event.evolved) {
              this.time.delayedCall(800, () => {
                this.playEvolutionAnimation(player, afterLevelUp);
              });
            } else {
              afterLevelUp();
            }
          });
        } else {
          this.time.delayedCall(600, () => this.processNextEvent());
        }
        break;
      }

      case "battleEnd":
        this.updateUI();
        this.processNextEvent();
        break;

      default:
        // For unhandled events, just continue
        this.time.delayedCall(400, () => this.processNextEvent());
    }
  }

  /** Show floating effectiveness text that fades out */
  private showEffectivenessText(text: string, color: string, x: number, y: number, onDone: () => void) {
    const FONT = this.FONT;
    const effText = this.add.text(x, y, text, {
      fontFamily: FONT, fontStyle: "bold", fontSize: "10px", color,
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);

    this.tweens.add({
      targets: effText,
      y: y - 15,
      alpha: 0,
      duration: 600,
      ease: "Quad.easeOut",
      onComplete: () => {
        effText.destroy();
        onDone();
      }
    });
  }

  /** Show floating "+X puntos Enrola" text */
  private showFloatingPoints(points: number) {
    const w = this.cameras.main.width;
    const y = this.menuY - 20;
    const text = this.add.text(w / 2, y, `+${points} puntos Enrola`, {
      fontFamily: this.FONT,
      fontStyle: "bold",
      fontSize: "12px",
      color: "#E84B2B",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: text,
      y: y - 25,
      alpha: 0,
      duration: 1200,
      ease: "Quad.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  /**
   * Play evolution animation: flash white 3 times, swap sprite, show messages.
   */
  private playEvolutionAnimation(player: BMCreature, onDone: () => void) {
    const oldName = player.nickname || player.species?.name || "???";
    this.logText.setText(`¡${oldName} está evolucionando!`);

    // Flash white 3 times on player sprite
    let flashCount = 0;
    const doFlash = () => {
      if (flashCount >= 3) {
        // Swap sprite texture to evolved form
        const newSpriteKey = this.textures.exists(`ne-${player.species.sprite}`)
          ? `ne-${player.species.sprite}` : `back-${player.species.sprite}`;

        if (this.playerSprite && "setTexture" in this.playerSprite && this.textures.exists(newSpriteKey)) {
          (this.playerSprite as unknown as Phaser.GameObjects.Image).setTexture(newSpriteKey);
          const img = this.playerSprite as unknown as Phaser.GameObjects.Image;
          const aspect = img.height / img.width;
          img.setDisplaySize(100, 100 * aspect);
        }

        // Show evolved message
        const newName = player.nickname || player.species?.name || "???";
        this.logText.setText(`¡${oldName} evolucionó a ${newName}!`);
        this.updateUI();

        this.time.delayedCall(1500, () => {
          onDone();
        });
        return;
      }

      // Flash: alpha 0 -> 1 with white tint effect
      this.tweens.add({
        targets: this.playerSprite,
        alpha: 0,
        duration: 150,
        yoyo: true,
        onYoyo: () => {
          // Create brief white flash overlay on sprite
          const flash = this.add.rectangle(
            this.playerSprite.x, this.playerSprite.y,
            110, 110, 0xffffff, 0.9
          ).setDepth(25);
          this.time.delayedCall(100, () => flash.destroy());
        },
        onComplete: () => {
          flashCount++;
          this.time.delayedCall(200, () => doFlash());
        }
      });
    };

    this.time.delayedCall(800, () => doFlash());
  }

  /**
   * End battle and transition to the appropriate scene.
   * Updates the player save with post-battle creature HP.
   */
  private endBattle(result: "victory" | "defeat" | "run" | "capture") {
    // Sync battle creature HP back to save
    const save = this.registry.get("playerSave") as import("../lib/types").PlayerSave | undefined;
    if (save) {
      const state = this.battleManager.getState();
      // Update HP for each team member based on battle state
      for (let i = 0; i < state.playerTeam.length && i < save.team.length; i++) {
        save.team[i].currentHp = Math.max(0, state.playerTeam[i].currentHp);
      }

      // ── Award Club Enrola points ────────────────────────────────────────
      let pointsEarned = 0;
      if (result === "victory") {
        if (this.initData.isBoss) {
          pointsEarned = 50;
        } else {
          pointsEarned = 10;
        }
      } else if (result === "capture") {
        pointsEarned = 5;
      }

      if (pointsEarned > 0) {
        save.points = (save.points ?? 0) + pointsEarned;
      }

      // Sync XP/levels from battle back to save (evolution data etc.)
      for (let i = 0; i < state.playerTeam.length && i < save.team.length; i++) {
        const bm = state.playerTeam[i];
        save.team[i].level = bm.level;
        save.team[i].xp = bm.xp;
        save.team[i].xpToNext = bm.xpToNext;
        save.team[i].maxHp = bm.maxHp;
        save.team[i].moves = [...bm.moves];
        // Update species data if evolution occurred
        const creaturesData = this.registry.get("creaturesData") || [];
        const speciesData = creaturesData.find((c: CreatureData) => c.id === bm.species.id);
        if (speciesData) {
          save.team[i].data = speciesData;
        }
      }

      // Add enemy to dex on encounter (seen)
      const enemySpeciesId = state.enemyTeam[state.activeEnemyIndex]?.species?.id;
      if (enemySpeciesId && !save.dex.includes(enemySpeciesId)) {
        save.dex.push(enemySpeciesId);
      }

      // If boss victory, mark dungeon as completed
      if (result === "victory" && this.initData.isBoss && this.initData.dungeonId) {
        if (!save.badges.includes(this.initData.dungeonId)) {
          save.badges.push(this.initData.dungeonId);
        }
      }

      // If capture, add enemy creature to team/box
      if (result === "capture") {
        const enemyState = state.enemyTeam[state.activeEnemyIndex];
        if (enemyState) {
          // Convert BM creature back to save format (types.ts CreatureInstance)
          const creaturesData = this.registry.get("creaturesData") || [];
          const speciesData = creaturesData.find((c: CreatureData) => c.id === enemyState.species.id);
          const captured: CMCreature = {
            data: speciesData || enemyState.species as any,
            nickname: null,
            level: enemyState.level,
            xp: enemyState.xp,
            xpToNext: enemyState.xpToNext,
            currentHp: enemyState.currentHp,
            maxHp: enemyState.maxHp,
            moves: [...enemyState.moves],
            status: null,
            statStages: { atk: 0, def: 0, spd: 0, spe: 0 },
          };
          if (save.team.length < 6) {
            save.team.push(captured);
          } else {
            save.box.push(captured);
          }
          // Add to dex
          if (!save.dex.includes(enemyState.species.id)) {
            save.dex.push(enemyState.species.id);
          }
        }
      }

      SaveManager.save(save);
      this.registry.set("playerSave", save);
    }

    // Determine return scene
    const returnScene = this.initData.returnScene || "TitleScene";
    const returnData: Record<string, unknown> = {};

    if (returnScene === "DungeonScene") {
      returnData.dungeonId = this.initData.dungeonId;
      returnData.floor = this.initData.floor;
    }

    // On defeat, go to hub instead of dungeon
    if (result === "defeat") {
      if (save) {
        save.currentDungeon = null;
        save.currentFloor = 0;
        SaveManager.save(save);
        this.registry.set("playerSave", save);
      }
      this.scene.start("HubScene");
      return;
    }

    // On boss victory, return to hub with badge
    if (result === "victory" && this.initData.isBoss) {
      if (save) {
        save.currentDungeon = null;
        save.currentFloor = 0;
        SaveManager.save(save);
        this.registry.set("playerSave", save);
      }
      this.scene.start("HubScene");
      return;
    }

    this.scene.start(returnScene, returnData);
  }
}
