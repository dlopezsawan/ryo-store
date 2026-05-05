// ─── Enrola Legends – FarmaPorroScene (interior, Farmatodo-inspired) ─────────
// Grid-based indoor scene. Layout: entrance → cash registers → aisles → pharmacy.
// Player walks in from the south door, interacts with NPCs by stepping on them.

import * as Phaser from "phaser";
import { SaveManager } from "../lib/SaveManager";
import type { PlayerSave, ItemData } from "../lib/types";

const FONT = "Arial, Helvetica, sans-serif";
const TILE = 16;
const MAP_W = 16; // 256 px
const MAP_H = 20; // 320 px (taller for spacious pharmacy area)
const MOVE_SPEED = 100;

/* ══════ TILE IDS ══════ */
const TF = 0; // floor (cream ceramic)
const TW = 1; // wall
const TC = 2; // counter (Farmatodo blue)
const TS = 3; // shelf (brown wood)
const TD = 4; // door mat

/* ══════ TILE COLORS — high contrast ══════ */
const TCOL: number[][] = [
  /* TF */ [0xe0dcd0, 0xd8d4c8, 0xe4e0d4, 0xdcd8cc], // warm cream floor
  /* TW */ [0x4466aa, 0x3d5ea0, 0x4b6eb2, 0x3656a0], // Farmatodo blue walls
  /* TC */ [0x3355aa, 0x2d4ea0, 0x3a5cb2, 0x284698], // darker blue counters
  /* TS */ [0x8a7050, 0x836a4a, 0x907658, 0x7c6444], // brown wooden shelves
  /* TD */ [0x888878, 0x828272, 0x8e8e7e, 0x7c7c6c], // gray doormat
];

function th(x: number, y: number): number {
  return ((x * 7 + y * 13 + x * y * 3) >>> 0) % 4;
}

/* ══════ NPC POSITIONS ══════ */
interface NPC {
  tx: number; ty: number;
  label: string;
  type: "cashier" | "pharmacist";
}

const NPCS: NPC[] = [
  { tx: 5,  ty: 14, label: "ITEMS",       type: "cashier" },   // behind counter (row 15)
  { tx: 10, ty: 14, label: "ENROLABALLS", type: "cashier" },   // behind counter
  { tx: 7,  ty: 3,  label: "",           type: "pharmacist" }, // behind pharmacy counter (row 4)
  { tx: 8,  ty: 3,  label: "",           type: "pharmacist" },
];

/* ══════ TILE MAP (16×20, Farmatodo layout — spacious) ══════ */
// Row 0-3:   Blue wall (back wall — logo, cross, brand stripe)
// Row 4:     Pharmacy counter
// Row 5:     Floor (pharmacist walk zone)
// Row 6:     Floor gap
// Row 7-8:   Shelf aisles (products — 3 columns)
// Row 9-10:  Floor (walking aisle between shelves)
// Row 11-12: Shelf aisles (products — 3 columns)
// Row 13:    Floor gap
// Row 14:    Floor approach
// Row 15:    Cash register counters
// Row 16:    Floor (cashier interaction zone)
// Row 17:    Floor
// Row 18:    Door mat / entrance
// Row 19:    Wall (south, with door gap)

function buildTileMap(): number[][] {
  const m: number[][] = [];
  for (let y = 0; y < MAP_H; y++) m[y] = new Array(MAP_W).fill(TF);

  // Top wall (rows 0-2) — blue Farmatodo wall
  for (let x = 0; x < MAP_W; x++) {
    m[0][x] = TW; m[1][x] = TW; m[2][x] = TW;
  }
  // Row 3 stays floor — pharmacist NPCs stand here behind counter

  // Side walls
  for (let y = 0; y < MAP_H; y++) { m[y][0] = TW; m[y][MAP_W - 1] = TW; }

  // Bottom wall (row 19) with door gap at center
  for (let x = 0; x < MAP_W; x++) m[19][x] = TW;
  m[19][7] = TD; m[19][8] = TD; // door

  // Pharmacy counter (row 4, cols 4-11)
  for (let x = 4; x <= 11; x++) m[4][x] = TC;

  // Shelf aisles (rows 7-8, three blocks)
  for (let y = 7; y <= 8; y++) {
    for (let x = 2; x <= 4; x++) m[y][x] = TS;
    for (let x = 6; x <= 9; x++) m[y][x] = TS;
    for (let x = 11; x <= 13; x++) m[y][x] = TS;
  }

  // Shelf aisles (rows 11-12, three blocks)
  for (let y = 11; y <= 12; y++) {
    for (let x = 2; x <= 4; x++) m[y][x] = TS;
    for (let x = 6; x <= 9; x++) m[y][x] = TS;
    for (let x = 11; x <= 13; x++) m[y][x] = TS;
  }

  // Cash register counters (row 15, two stations)
  for (let x = 3; x <= 6; x++) m[15][x] = TC;
  for (let x = 9; x <= 12; x++) m[15][x] = TC;

  // Door mat (row 18)
  m[18][7] = TD; m[18][8] = TD;

  return m;
}

/* ══════ COLLISION ══════ */
let collisionGrid: boolean[][] = [];

function isBlocked(tx: number, ty: number): boolean {
  if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return true;
  return collisionGrid[ty]?.[tx] ?? true;
}

function buildCollisionGrid(tileMap: number[][]): boolean[][] {
  const g: boolean[][] = [];
  for (let y = 0; y < MAP_H; y++) {
    g[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      const t = tileMap[y][x];
      g[y][x] = t === TW || t === TC || t === TS;
    }
  }
  // Door gap is walkable
  g[19][7] = false; g[19][8] = false;
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  FARMAPORRO SCENE
 * ══════════════════════════════════════════════════════════════════════════ */

export class FarmaPorroScene extends Phaser.Scene {
  private save!: PlayerSave;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerDirection: "south" | "north" | "east" | "west" = "north";
  private playerTileX = 5;
  private playerTileY = 12;
  private isMoving = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private messageText!: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;
  private shopOverlay?: Phaser.GameObjects.Container;
  private isShopOpen = false;
  private genderPrefix = "f";

  constructor() {
    super({ key: "FarmaPorroScene" });
  }

  create() {
    const regSave = this.registry.get("playerSave") as PlayerSave | undefined;
    const diskSave = SaveManager.load();
    this.save = regSave || diskSave || { team: [], box: [], inventory: [], dex: [], currentDungeon: null, currentFloor: 0, points: 0, gender: "m" as const, badges: [] };
    this.registry.set("playerSave", this.save);
    this.genderPrefix = this.save.gender === "m" ? "m" : "f";

    const mapPxW = MAP_W * TILE;
    const mapPxH = MAP_H * TILE;

    // Camera
    this.cameras.main.setBackgroundColor(0xd0d8e0);
    this.cameras.main.fadeIn(300);
    this.cameras.main.setZoom(2);
    this.cameras.main.setBounds(0, 0, mapPxW, mapPxH);

    // Build & render
    const tileMap = buildTileMap();
    this.renderInterior(tileMap);
    collisionGrid = buildCollisionGrid(tileMap);

    // Place NPCs
    this.placeNPCs();

    // Player (enters from door at bottom)
    this.playerTileX = 7;
    this.playerTileY = 18;
    this.playerDirection = "north";
    this.playerSprite = this.add.sprite(
      this.playerTileX * TILE + TILE / 2,
      this.playerTileY * TILE + TILE / 2,
      `player-${this.genderPrefix}-walk-north`, 0
    ).setDisplaySize(TILE * 1.4, TILE * 1.4).setDepth(300);

    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);

    // HUD — positioned in world coords, updated when camera moves
    // For now, place message text as a world object that we reposition before showing
    this.messageText = this.add.text(0, 0, "", {
      fontFamily: FONT, fontSize: "6px", fontStyle: "bold",
      color: "#222222", align: "center", backgroundColor: "#FFFFFFDD",
      padding: { x: 6, y: 3 }, resolution: 2,
    }).setOrigin(0.5, 1).setDepth(600).setVisible(false);

    // Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    this.showMessage("Bienvenido a FarmaPorro. Acercate a las cajas o la farmacia.");
  }

  /* ═══════ INTERIOR RENDERING ═══════ */

  private renderInterior(tileMap: number[][]) {
    const gfx = this.add.graphics().setDepth(0);

    // ── Base tile fill ──
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = tileMap[y][x];
        gfx.fillStyle(TCOL[t][th(x, y)], 1);
        gfx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    const det = this.add.graphics().setDepth(1);

    // ── Floor: subtle ceramic tile grid ──
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (tileMap[y][x] !== TF && tileMap[y][x] !== TD) continue;
        const px = x * TILE, py = y * TILE;
        det.lineStyle(1, 0xc0bca8, 0.15);
        det.lineBetween(px, py, px + TILE, py);
        det.lineBetween(px, py, px, py + TILE);
      }
    }

    // ── Wall detail: Farmatodo branding on 3-row wall ──
    // Green pharmacy cross (top center, row 0)
    const crossX = MAP_W * TILE / 2, crossY = TILE * 0.3;
    det.fillStyle(0x44cc66, 1);
    det.fillRect(crossX - 5, crossY, 10, 3);
    det.fillRect(crossX - 1.5, crossY - 4, 3, 11);
    // White stripe (row 1)
    det.fillStyle(0xffffff, 0.9);
    det.fillRect(TILE * 2, TILE * 1 + 4, (MAP_W - 4) * TILE, 8);
    // "FARMAPORRO" text on the stripe
    this.add.text(MAP_W * TILE / 2, TILE * 1 + 3, "FARMAPORRO", {
      fontFamily: FONT, fontSize: "8px", fontStyle: "bold",
      color: "#1a3a7a", resolution: 2,
    }).setOrigin(0.5, 0).setDepth(2);

    // ── Shelf detail: wooden shelves with colorful products ──
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (tileMap[y][x] !== TS) continue;
        const px = x * TILE, py = y * TILE;
        // Shelf frame (lighter border on brown)
        det.lineStyle(1, 0xa08860, 0.6);
        det.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        // Top shelf row — colorful product boxes
        const colors = [0xee3333, 0x3366ee, 0x33bb55, 0xee8833, 0xaa33cc, 0xeecc33];
        for (let i = 0; i < 3; i++) {
          const col = colors[th(x * (i + 1), y * (i + 3)) % colors.length];
          det.fillStyle(col, 0.85);
          det.fillRect(px + 2 + i * 4, py + 2, 3, 5);
        }
        // Bottom shelf row
        for (let i = 0; i < 3; i++) {
          const col = colors[th(x * (i + 4), y * (i + 1)) % colors.length];
          det.fillStyle(col, 0.7);
          det.fillRect(px + 2 + i * 4, py + 9, 3, 4);
        }
      }
    }

    // ── Counter detail: blue with register screens & pharmacy items ──
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (tileMap[y][x] !== TC) continue;
        const px = x * TILE, py = y * TILE;
        // Counter highlight edge
        det.lineStyle(1, 0x4488cc, 0.6);
        det.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        // Cash register screens (row 15)
        if (y === 15) {
          det.fillStyle(0x111111, 0.8);
          det.fillRect(px + 4, py + 2, 8, 5);
          det.fillStyle(0x44ee66, 0.7);
          det.fillRect(px + 5, py + 3, 6, 3);
          // Keypad dots
          det.fillStyle(0x888888, 0.5);
          det.fillRect(px + 4, py + 9, 8, 4);
        }
        // Pharmacy counter — medicine boxes & bottles (row 4)
        if (y === 4) {
          det.fillStyle(0xffffff, 0.7);
          det.fillRect(px + 2, py + 2, 5, 4);
          det.fillRect(px + 9, py + 2, 5, 4);
          det.fillStyle(0xee3333, 0.5);
          det.fillRect(px + 3, py + 3, 3, 2); // red cross on medicine
          det.fillStyle(0x44aaee, 0.5);
          det.fillRect(px + 10, py + 3, 3, 2);
        }
      }
    }

    // ── Door mat with entrance arrow ──
    det.fillStyle(0x555555, 0.3);
    det.fillRect(7 * TILE + 2, 18 * TILE + 2, 2 * TILE - 4, TILE - 4);
    det.fillStyle(0xffffff, 0.2);
    det.fillRect(7 * TILE + 12, 18 * TILE + 8, 8, 2);
    det.fillRect(7 * TILE + 14, 18 * TILE + 5, 4, 3);

    // ── Aisle labels on floor (between shelf rows) ──
    const aisleStyle = { fontFamily: FONT, fontSize: "4px", color: "#999988", resolution: 2 };
    this.add.text(3 * TILE + 8, 6 * TILE + 4, "HIGIENE", aisleStyle as any).setOrigin(0.5, 0).setDepth(1);
    this.add.text(7.5 * TILE, 6 * TILE + 4, "BEBIDAS", aisleStyle as any).setOrigin(0.5, 0).setDepth(1);
    this.add.text(12 * TILE, 6 * TILE + 4, "SNACKS", aisleStyle as any).setOrigin(0.5, 0).setDepth(1);
    this.add.text(3 * TILE + 8, 10 * TILE + 4, "BELLEZA", aisleStyle as any).setOrigin(0.5, 0).setDepth(1);
    this.add.text(7.5 * TILE, 10 * TILE + 4, "HOGAR", aisleStyle as any).setOrigin(0.5, 0).setDepth(1);
    this.add.text(12 * TILE, 10 * TILE + 4, "VITAMINAS", aisleStyle as any).setOrigin(0.5, 0).setDepth(1);
  }

  /* ═══════ NPC PLACEMENT ═══════ */

  private placeNPCs() {
    for (const npc of NPCS) {
      const cx = npc.tx * TILE + TILE / 2;
      const cy = npc.ty * TILE + TILE / 2;

      // NPC sprite image (facing south toward player)
      const spriteKey = npc.type === "cashier" ? "npc-cashier" : "npc-pharmacist";
      if (this.textures.exists(spriteKey)) {
        this.add.image(cx, cy - 2, spriteKey)
          .setDisplaySize(TILE * 1.4, TILE * 1.4)
          .setDepth((npc.ty + 1) * TILE);
      }

      // Label above NPC
      if (npc.label) {
        this.add.text(cx, cy - 10, npc.label, {
          fontFamily: FONT, fontSize: "5px", fontStyle: "bold",
          color: "#FFFFFF", stroke: "#000000", strokeThickness: 2, resolution: 2,
        }).setOrigin(0.5, 1).setDepth(200);
      }
    }

    // Interaction hint tiles — glowing squares on floor
    const hint = this.add.graphics().setDepth(2);
    // Cashier interaction spots (row 16)
    hint.fillStyle(0x4488cc, 0.15);
    hint.fillRect(5 * TILE + 2, 16 * TILE + 2, TILE - 4, TILE - 4);
    hint.fillRect(10 * TILE + 2, 16 * TILE + 2, TILE - 4, TILE - 4);
    hint.fillStyle(0x4488cc, 0.25);
    hint.fillRect(5 * TILE + 6, 16 * TILE + 5, 4, 6);
    hint.fillRect(10 * TILE + 6, 16 * TILE + 5, 4, 6);
    // Pharmacy interaction spots (row 5)
    hint.fillStyle(0x44aa66, 0.15);
    hint.fillRect(7 * TILE + 2, 5 * TILE + 2, 2 * TILE - 4, TILE - 4);
    hint.fillStyle(0x44aa66, 0.25);
    hint.fillRect(7 * TILE + 12, 5 * TILE + 5, 8, 6);
  }

  /* ═══════ UPDATE ═══════ */

  update() {
    if (this.isShopOpen || this.isMoving) return;

    let dx = 0, dy = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) dx = -1;
    else if (this.cursors?.right.isDown || this.wasd?.D.isDown) dx = 1;
    else if (this.cursors?.up.isDown || this.wasd?.W.isDown) dy = -1;
    else if (this.cursors?.down.isDown || this.wasd?.S.isDown) dy = 1;

    if (dx !== 0 || dy !== 0) {
      if (dx === -1) this.playerDirection = "west";
      else if (dx === 1) this.playerDirection = "east";
      else if (dy === -1) this.playerDirection = "north";
      else if (dy === 1) this.playerDirection = "south";

      const animKey = `player-${this.genderPrefix}-walk-${this.playerDirection}`;
      if (this.anims.exists(animKey)) {
        this.playerSprite.play(animKey, true);
      } else {
        this.playerSprite.setTexture(`player-${this.playerDirection}`);
      }
      const nx = this.playerTileX + dx;
      const ny = this.playerTileY + dy;

      // Exit through door (walk south past row 19)
      if (ny >= MAP_H - 1 && (nx === 7 || nx === 8)) {
        this.exitToHub();
        return;
      }

      if (!isBlocked(nx, ny)) this.movePlayer(nx, ny);
    } else {
      // No input — stop walk animation, show idle frame
      if (this.playerSprite.anims?.isPlaying) {
        this.playerSprite.play(`player-${this.genderPrefix}-idle-${this.playerDirection}`);
      }
    }
  }

  private movePlayer(nx: number, ny: number) {
    this.isMoving = true;
    this.playerTileX = nx;
    this.playerTileY = ny;
    this.playerSprite.setDepth(300 + ny);

    this.tweens.add({
      targets: this.playerSprite,
      x: nx * TILE + TILE / 2,
      y: ny * TILE + TILE / 2,
      duration: MOVE_SPEED,
      onComplete: () => {
        this.isMoving = false;
        this.checkNPCInteraction();
      },
    });
  }

  /* ═══════ NPC INTERACTION ═══════ */

  private checkNPCInteraction() {
    // Caja 1 (col 5, row 16): items generales (pociones, boosts, etc)
    if (this.playerTileY === 16 && this.playerTileX === 5) {
      this.showMessage("Cajero: Bienvenido! Tenemos pociones y mas.");
      this.time.delayedCall(600, () => this.openShop("general"));
      return;
    }
    // Caja 2 (col 10, row 16): Enrolaballs exclusivamente
    if (this.playerTileY === 16 && this.playerTileX === 10) {
      this.showMessage("Cajero: Buscas Enrolaballs? Tenemos de todo!");
      this.time.delayedCall(600, () => this.openShop("enrolaballs"));
      return;
    }
    // Pharmacist: stand in row 5 at col 7 or 8
    if (this.playerTileY === 5 && (this.playerTileX === 7 || this.playerTileX === 8)) {
      this.healTeam();
      return;
    }
  }

  /* ═══════ SHOP (at cash register) ═══════ */

  private openShop(section: "general" | "enrolaballs" = "general") {
    if (this.isShopOpen) return;
    this.isShopOpen = true;

    const allItems: ItemData[] = this.registry.get("itemsData") || [];
    // Filter by section
    const itemsData = section === "enrolaballs"
      ? allItems.filter(i => i.category === "capture")
      : allItems.filter(i => i.category !== "capture");

    if (itemsData.length === 0) {
      this.showMessage("No hay productos disponibles.");
      this.isShopOpen = false;
      return;
    }

    const shopTitle = section === "enrolaballs" ? "ENROLABALLS" : "CAJA — FARMAPORRO";

    // Use camera.worldView for exact visible world bounds (accounts for zoom+scroll)
    const view = this.cameras.main.worldView;
    const w = view.width;   // visible world width (240 at zoom 2)
    const h = view.height;  // visible world height (160 at zoom 2)
    const cx = view.centerX; // center X in world coords
    const cy = view.centerY; // center Y in world coords
    const left = view.x;
    const top = view.y;

    const container = this.add.container(0, 0).setDepth(700);
    container.add(this.add.rectangle(cx, cy, w + 4, h + 4, 0x000000, 0.8));

    const panelW = w * 0.88;
    const panelH = h * 0.85;
    const panelL = cx - panelW / 2;  // panel left edge in world
    const panelT = cy - panelH / 2;  // panel top edge in world

    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0xf0ece4, 0.98);
    panelGfx.fillRoundedRect(panelL, panelT, panelW, panelH, 3);
    panelGfx.lineStyle(1, 0x2060a0, 0.8);
    panelGfx.strokeRoundedRect(panelL, panelT, panelW, panelH, 3);
    container.add(panelGfx);

    container.add(this.add.text(cx, panelT + 4, shopTitle, {
      fontFamily: FONT, fontSize: "7px", fontStyle: "bold", color: "#2060A0", resolution: 2,
    }).setOrigin(0.5, 0));

    container.add(this.add.text(cx, panelT + 14, `Puntos: ${this.save.points ?? 0}`, {
      fontFamily: FONT, fontSize: "5px", color: "#666666", resolution: 2,
    }).setOrigin(0.5, 0));

    const listY = panelT + 22;
    const rowH = 12;
    const maxVisible = Math.floor((panelH - 34) / rowH);
    const shopItems = itemsData.slice(0, maxVisible);

    shopItems.forEach((item, i) => {
      const yOff = listY + i * rowH;
      const price = item.price;
      const canAfford = (this.save.points ?? 0) >= price;

      const rowBg = this.add.rectangle(cx, yOff + rowH / 2, panelW - 8, rowH - 1,
        canAfford ? 0xe4f0e8 : 0xf0f0f0, 0.9);
      rowBg.setStrokeStyle(1, canAfford ? 0x40a060 : 0xcccccc, 0.4);
      container.add(rowBg);

      container.add(this.add.text(panelL + 6, yOff + 2, item.name, {
        fontFamily: FONT, fontSize: "5px", fontStyle: "bold",
        color: canAfford ? "#333333" : "#aaaaaa", resolution: 2,
      }));

      container.add(this.add.text(panelL + panelW - 6, yOff + 2, `${price} pts`, {
        fontFamily: FONT, fontSize: "5px", fontStyle: "bold",
        color: canAfford ? "#2060A0" : "#cccccc", resolution: 2,
      }).setOrigin(1, 0));

      if (canAfford) {
        rowBg.setInteractive({ useHandCursor: true });
        rowBg.on("pointerover", () => rowBg.setFillStyle(0xd0e8d4, 0.95));
        rowBg.on("pointerout", () => rowBg.setFillStyle(0xe4f0e8, 0.9));
        rowBg.on("pointerdown", () => {
          this.buyItem(item);
          container.destroy();
          this.shopOverlay = undefined;
          this.isShopOpen = false;
          this.openShop();
        });
      }
    });

    const closeBg = this.add.rectangle(cx, panelT + panelH - 7, 50, 10, 0x2060a0);
    closeBg.setInteractive({ useHandCursor: true });
    const closeText = this.add.text(cx, panelT + panelH - 7, "SALIR", {
      fontFamily: FONT, fontSize: "5px", fontStyle: "bold", color: "#FFFFFF", resolution: 2,
    }).setOrigin(0.5);
    closeBg.on("pointerover", () => closeBg.setFillStyle(0x3070b0));
    closeBg.on("pointerout", () => closeBg.setFillStyle(0x2060a0));
    closeBg.on("pointerdown", () => {
      container.destroy();
      this.shopOverlay = undefined;
      this.isShopOpen = false;
    });
    container.add(closeBg);
    container.add(closeText);

    this.shopOverlay = container;
  }

  private buyItem(item: ItemData) {
    const price = item.price;
    if ((this.save.points ?? 0) < price) return;

    this.save.points -= price;
    const existing = this.save.inventory.find(inv => inv.itemId === item.id);
    if (existing) existing.quantity++;
    else this.save.inventory.push({ itemId: item.id, quantity: 1 });

    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);
    this.showMessage(`Compraste ${item.name}! (-${price} pts)`);
  }

  /* ═══════ HEAL (at pharmacy counter) ═══════ */

  private healTeam() {
    if (this.save.team.length === 0) {
      this.showMessage("Farmaceutico: No tienes criaturas aun!");
      return;
    }

    let healed = false;
    for (const creature of this.save.team) {
      if (creature.currentHp < creature.maxHp) {
        creature.currentHp = creature.maxHp;
        healed = true;
      }
      if (creature.status) {
        creature.status = null;
        healed = true;
      }
    }

    if (healed) {
      this.showMessage("Farmaceutico: Listo! Tu equipo esta como nuevo. Vuelve cuando quieras!");
      SaveManager.save(this.save);
      this.registry.set("playerSave", this.save);
    } else {
      this.showMessage("Farmaceutico: Tu equipo esta en perfecto estado. Suerte alla afuera!");
    }
  }

  /* ═══════ EXIT ═══════ */

  private exitToHub() {
    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start("HubScene");
    });
  }

  /* ═══════ MESSAGE ═══════ */

  private showMessage(msg: string) {
    const view = this.cameras.main.worldView;
    this.messageText.setPosition(view.centerX, view.bottom - 4);
    this.messageText.setText(msg);
    this.messageText.setVisible(true);
    if (this.messageTimer) this.messageTimer.destroy();
    this.messageTimer = this.time.delayedCall(4000, () => {
      this.messageText.setText("");
      this.messageText.setVisible(false);
    });
  }
}
