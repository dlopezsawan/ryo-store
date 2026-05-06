// ─── Enrola Legends – HubScene ("Plaza de las Esculturas, El Viñedo") ────────
// Layout based on real Plaza Andrés Pérez Mujica satellite imagery.
// 30×22 tile grid, procedural tile rendering, y-depth sorting.

import * as Phaser from "phaser";
import { SaveManager } from "../lib/SaveManager";
import type { PlayerSave } from "../lib/types";

/* ══════ PALETTE ══════ */
const FONT = "Arial, Helvetica, sans-serif";

/* ══════ GRID ══════ */
const TILE = 16;
const MAP_W = 30; // 480 px
const MAP_H = 22; // 352 px
const MOVE_SPEED = 110;

/* ══════ TILE IDS ══════ */
const TG = 0; // grass
const TP = 1; // cobblestone path
const TR = 2; // road (asphalt)
const TS = 3; // sidewalk (concrete)
const TC = 4; // central plaza stone

/* ══════ TILE COLORS (4 variants for texture) ══════ */
const TCOL: number[][] = [
  /* TG */ [0x4a8c32, 0x448628, 0x509838, 0x3e7c2a],
  /* TP */ [0xc4a87a, 0xbda274, 0xcab080, 0xb89c70],
  /* TR */ [0x3a3a3a, 0x363636, 0x3e3e3e, 0x343434],
  /* TS */ [0x9a9a8a, 0x949488, 0xa0a090, 0x8e8e80],
  /* TC */ [0xd4c090, 0xceba88, 0xdac898, 0xc8b482],
];

/** Deterministic per-tile hash for consistent color variation */
function th(x: number, y: number): number {
  return ((x * 7 + y * 13 + x * y * 3) >>> 0) % 4;
}

/* ══════ INTERACTIVE ZONES (buildings) ══════ */
interface Zone {
  x: number; y: number; w: number; h: number; label: string;
  doorX: number; doorY: number; // tile where player steps to enter (Pokemon-style)
}

const ZONES: Zone[] = [
  { x: 13, y: 3,  w: 3, h: 3, label: "FARMAPORRO",   doorX: 14, doorY: 6  }, // 0 — center-north
  { x: 23, y: 16, w: 3, h: 3, label: "MOTOTAXI",     doorX: 24, doorY: 15 }, // 1 — SE
];

const BLDGS = [
  { zi: 0, key: "hub-heal",     w: 48, h: 48 },
  { zi: 1, key: "hub-mototaxi", w: 48, h: 48 },
];

/* ══════ DECORATIONS ══════ */
interface Deco {
  tx: number; ty: number; key: string;
  w: number; h: number; blocks: boolean; oy?: number;
}

const DECOS: Deco[] = [
  // ── Mango trees (large canopy — samanes from satellite, dense NW) ──
  { tx: 3,  ty: 5,  key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },
  { tx: 8,  ty: 4,  key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },
  { tx: 3,  ty: 9,  key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },
  { tx: 9,  ty: 8,  key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },
  { tx: 26, ty: 5,  key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },
  { tx: 8,  ty: 14, key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },
  { tx: 3,  ty: 14, key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },
  { tx: 26, ty: 14, key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },
  { tx: 21, ty: 18, key: "hub-mango", w: 36, h: 36, blocks: true, oy: -8 },

  // ── Palm trees ──
  { tx: 7,  ty: 7,  key: "hub-palm", w: 24, h: 24, blocks: true, oy: -4 },
  { tx: 22, ty: 8,  key: "hub-palm", w: 24, h: 24, blocks: true, oy: -4 },
  { tx: 10, ty: 3,  key: "hub-palm", w: 24, h: 24, blocks: true, oy: -4 },
  { tx: 19, ty: 3,  key: "hub-palm", w: 24, h: 24, blocks: true, oy: -4 },
  { tx: 10, ty: 18, key: "hub-palm", w: 24, h: 24, blocks: true, oy: -4 },
  { tx: 19, ty: 18, key: "hub-palm", w: 24, h: 24, blocks: true, oy: -4 },
  { tx: 27, ty: 9,  key: "hub-palm", w: 24, h: 24, blocks: true, oy: -4 },
  { tx: 2,  ty: 12, key: "hub-palm", w: 24, h: 24, blocks: true, oy: -4 },

  // ── Fountain (center of the plaza, spans 2×2 tiles) ──
  { tx: 14, ty: 10, key: "hub-fountain", w: 30, h: 30, blocks: true },

  // ── Sculptures (4 unique types — all on GRASS tiles, never on paths/plaza) ──
  { tx: 6,  ty: 9,  key: "hub-sculpture-bronze", w: 18, h: 18, blocks: true },
  { tx: 9,  ty: 13, key: "hub-sculpture-marble",  w: 18, h: 18, blocks: true },
  { tx: 10, ty: 8,  key: "hub-sculpture-iron",    w: 18, h: 18, blocks: true },
  { tx: 19, ty: 7,  key: "hub-sculpture",         w: 18, h: 18, blocks: true },
  { tx: 20, ty: 13, key: "hub-sculpture-bronze",  w: 18, h: 18, blocks: true },
  { tx: 23, ty: 13, key: "hub-sculpture-marble",  w: 18, h: 18, blocks: true },
  { tx: 12, ty: 5,  key: "hub-sculpture-iron",    w: 18, h: 18, blocks: true },
  { tx: 16, ty: 16, key: "hub-sculpture",         w: 18, h: 18, blocks: true },
  { tx: 10, ty: 15, key: "hub-sculpture-marble",  w: 18, h: 18, blocks: true },
  { tx: 19, ty: 15, key: "hub-sculpture-bronze",  w: 18, h: 18, blocks: true },
  { tx: 6,  ty: 13, key: "hub-sculpture-iron",    w: 18, h: 18, blocks: true },
  { tx: 23, ty: 7,  key: "hub-sculpture",         w: 18, h: 18, blocks: true },

  // ── Benches (on GRASS tiles adjacent to paths, never ON paths/plaza) ──
  { tx: 10, ty: 9,  key: "hub-bench", w: 22, h: 12, blocks: true },
  { tx: 19, ty: 9,  key: "hub-bench", w: 22, h: 12, blocks: true },
  { tx: 10, ty: 12, key: "hub-bench", w: 22, h: 12, blocks: true },
  { tx: 19, ty: 12, key: "hub-bench", w: 22, h: 12, blocks: true },
  { tx: 6,  ty: 10, key: "hub-bench", w: 22, h: 12, blocks: true },
  { tx: 23, ty: 11, key: "hub-bench", w: 22, h: 12, blocks: true },

  // ── Lamps along main walkway (larger, more visible) ──
  { tx: 4,  ty: 10, key: "hub-lamp", w: 14, h: 22, blocks: false },
  { tx: 7,  ty: 11, key: "hub-lamp", w: 14, h: 22, blocks: false },
  { tx: 10, ty: 10, key: "hub-lamp", w: 14, h: 22, blocks: false },
  { tx: 19, ty: 11, key: "hub-lamp", w: 14, h: 22, blocks: false },
  { tx: 22, ty: 10, key: "hub-lamp", w: 14, h: 22, blocks: false },
  { tx: 25, ty: 11, key: "hub-lamp", w: 14, h: 22, blocks: false },
  { tx: 14, ty: 4,  key: "hub-lamp", w: 14, h: 22, blocks: false },
  { tx: 15, ty: 17, key: "hub-lamp", w: 14, h: 22, blocks: false },

  // ── Flower beds & bushes ──
  { tx: 7,  ty: 3,  key: "hub-flowerbed", w: 16, h: 16, blocks: true },
  { tx: 22, ty: 6,  key: "hub-bush",      w: 16, h: 16, blocks: true },
  { tx: 7,  ty: 17, key: "hub-bush",      w: 16, h: 16, blocks: true },
  { tx: 22, ty: 17, key: "hub-flowerbed", w: 16, h: 16, blocks: true },
  { tx: 13, ty: 7,  key: "hub-bush",      w: 16, h: 16, blocks: true },
  { tx: 16, ty: 14, key: "hub-bush",      w: 16, h: 16, blocks: true },
  { tx: 9,  ty: 16, key: "hub-flowerbed", w: 16, h: 16, blocks: true },
  { tx: 20, ty: 5,  key: "hub-bush",      w: 16, h: 16, blocks: true },
];

// Fountain occupies 2×2 — extra blocked tiles beyond its anchor
const EXTRA_BLOCKED = [
  { x: 15, y: 10 }, { x: 14, y: 11 }, { x: 15, y: 11 },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  TILE MAP — procedurally generated based on real plaza layout
 * ══════════════════════════════════════════════════════════════════════════ */

function buildTileMap(): number[][] {
  const m: number[][] = [];
  for (let y = 0; y < MAP_H; y++) m[y] = new Array(MAP_W).fill(TG);

  // Perimeter roads (Av. Monseñor Adams N, Av. 106 W, streets S & E)
  for (let x = 0; x < MAP_W; x++) { m[0][x] = TR; m[MAP_H - 1][x] = TR; }
  for (let y = 0; y < MAP_H; y++) { m[y][0] = TR; m[y][MAP_W - 1] = TR; }

  // Sidewalks just inside roads
  for (let x = 1; x < MAP_W - 1; x++) { m[1][x] = TS; m[MAP_H - 2][x] = TS; }
  for (let y = 1; y < MAP_H - 1; y++) { m[y][1] = TS; m[y][MAP_W - 2] = TS; }

  // Building footprints → concrete pad
  for (const z of ZONES) {
    for (let by = z.y; by < z.y + z.h; by++)
      for (let bx = z.x; bx < z.x + z.w; bx++)
        if (by > 0 && by < MAP_H && bx > 0 && bx < MAP_W) m[by][bx] = TS;
  }

  // Central plaza (rows 8-13, cols 11-18) — open stone area around fountain
  for (let y = 8; y <= 13; y++)
    for (let x = 11; x <= 18; x++) m[y][x] = TC;

  // Main horizontal walkway (rows 10-11, full width of park)
  for (let y = 10; y <= 11; y++)
    for (let x = 2; x <= MAP_W - 3; x++)
      if (m[y][x] === TG) m[y][x] = TP;

  // Main vertical walkway (cols 14-15, full height of park)
  for (let y = 2; y <= MAP_H - 3; y++)
    for (let x = 14; x <= 15; x++)
      if (m[y][x] === TG) m[y][x] = TP;

  // Diagonal path (Calle 140 inspiration — NE to SW, 2 tiles wide)
  for (let row = 3; row <= 18; row++) {
    const col = Math.round(24 - (row - 3) * 1.25);
    if (col >= 2 && col <= 27 && m[row][col] === TG) m[row][col] = TP;
    const c2 = col + 1;
    if (c2 >= 2 && c2 <= 27 && m[row][c2] === TG) m[row][c2] = TP;
  }

  // Approach paths from main walkway to each building
  // FarmaPorro (center-north) — vertical approach from row 6→9
  for (let y = 6; y <= 9; y++) { m[y][14] = TP; }
  // SE (Mototaxi) — vertical approach from row 12→14
  for (let y = 12; y <= 14; y++) { m[y][24] = TP; }
  // Horizontal connectors at building entrances
  for (let x = 13; x <= 15; x++) { m[6][x] = TP; }  // FarmaPorro entrance
  for (let x = 23; x <= 25; x++) { m[15][x] = TP; } // Mototaxi entrance

  return m;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  COLLISION GRID
 * ══════════════════════════════════════════════════════════════════════════ */

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
      g[y][x] = tileMap[y][x] === TR; // only roads blocked by default
    }
  }
  // Buildings
  for (const z of ZONES) {
    for (let by = z.y; by < z.y + z.h; by++)
      for (let bx = z.x; bx < z.x + z.w; bx++)
        if (by >= 0 && by < MAP_H && bx >= 0 && bx < MAP_W) g[by][bx] = true;
  }
  // Blocking decorations
  for (const d of DECOS) {
    if (d.blocks && d.ty >= 0 && d.ty < MAP_H && d.tx >= 0 && d.tx < MAP_W)
      g[d.ty][d.tx] = true;
  }
  // Fountain extra tiles
  for (const b of EXTRA_BLOCKED) {
    if (b.y >= 0 && b.y < MAP_H && b.x >= 0 && b.x < MAP_W) g[b.y][b.x] = true;
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  HUB SCENE
 * ══════════════════════════════════════════════════════════════════════════ */

export class HubScene extends Phaser.Scene {
  private save!: PlayerSave;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerDirection: "south" | "north" | "east" | "west" = "south";
  private playerTileX = 14;
  private playerTileY = 12;
  private isMoving = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private zoneLabels: Phaser.GameObjects.Text[] = [];
  private hpTexts: Phaser.GameObjects.Text[] = [];
  private hpBars: Phaser.GameObjects.Rectangle[] = [];
  private messageText!: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private isPaused = false;
  private genderPrefix = "f"; // "f" or "m" — determines sprite set
  private pointsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "HubScene" });
  }

  create() {
    // ── Load save ──────────────────────────────────────────────────────────
    const regSave = this.registry.get("playerSave") as PlayerSave | undefined;
    const diskSave = SaveManager.load();
    this.save = regSave || diskSave || this.defaultSave();
    this.registry.set("playerSave", this.save);
    this.genderPrefix = this.save.gender === "m" ? "m" : "f";

    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    const mapPxW = MAP_W * TILE;
    const mapPxH = MAP_H * TILE;

    // ── Camera ─────────────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor(0x1b3a1b);
    this.cameras.main.fadeIn(300);
    this.cameras.main.setZoom(2);
    this.cameras.main.setBounds(0, 0, mapPxW, mapPxH);

    // ── Build & render tile map ────────────────────────────────────────────
    const tileMap = buildTileMap();
    this.renderTiles(tileMap);

    // ── Collision grid ─────────────────────────────────────────────────────
    collisionGrid = buildCollisionGrid(tileMap);

    // ── Place buildings ────────────────────────────────────────────────────
    for (const b of BLDGS) {
      const z = ZONES[b.zi];
      const bx = z.x * TILE + (z.w * TILE) / 2;
      const by = z.y * TILE + (z.h * TILE) / 2;
      if (this.textures.exists(b.key)) {
        this.add.image(bx, by, b.key)
          .setDisplaySize(b.w, b.h)
          .setDepth((z.y + z.h) * TILE);
      }
    }

    // ── Zone labels above buildings (with background panel for readability) ──
    for (const z of ZONES) {
      const zx = z.x * TILE + (z.w * TILE) / 2;
      const zy = z.y * TILE - 2;
      const label = this.add.text(zx, zy, z.label, {
        fontFamily: FONT, fontSize: "8px", fontStyle: "bold",
        color: "#F5F0E8", stroke: "#000000", strokeThickness: 3,
        resolution: 2,
      }).setOrigin(0.5, 1).setDepth(501);
      // Dark panel behind label for contrast
      const pad = 3;
      const bg = this.add.rectangle(
        zx, zy - label.height / 2,
        label.width + pad * 2, label.height + pad,
        0x000000, 0.55
      ).setDepth(500);
      this.zoneLabels.push(label);
    }

    // ── Place decorations ──────────────────────────────────────────────────
    this.placeDecorations();

    // ── Player character ───────────────────────────────────────────────────
    this.playerTileX = 14;
    this.playerTileY = 12;
    this.playerDirection = "south";
    if (isBlocked(this.playerTileX, this.playerTileY)) {
      this.playerTileX = 15;
      this.playerTileY = 12;
    }

    this.playerSprite = this.add.sprite(
      this.playerTileX * TILE + TILE / 2,
      this.playerTileY * TILE + TILE / 2,
      `player-${this.genderPrefix}-walk-south`, 0
    ).setDisplaySize(TILE * 1.4, TILE * 1.4)
     .setDepth((this.playerTileY + 1) * TILE);

    this.cameras.main.startFollow(this.playerSprite, true, 0.15, 0.15);

    // ── HUD: team HP ───────────────────────────────────────────────────────
    this.buildTeamHUD();

    // ── Club Enrola points (top-right) ─────────────────────────────────────
    this.pointsText = this.add.text(0, 0, `Club Enrola: ${this.save.points ?? 0} pts`, {
      fontFamily: FONT, fontSize: "8px", fontStyle: "bold", color: "#E84B2B",
    }).setOrigin(1, 0).setDepth(600).setScrollFactor(0);
    this.pointsText.setPosition(camW - 4, 4);

    // ── Title bar (bottom) ─────────────────────────────────────────────────
    this.add.text(camW / 2, camH - 10, "PLAZA DE LAS ESCULTURAS — EL VIÑEDO", {
      fontFamily: FONT, fontSize: "7px", fontStyle: "bold",
      color: "#C4B48A", stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(600).setScrollFactor(0);

    // ── Message text (bottom center) ───────────────────────────────────────
    this.messageText = this.add.text(camW / 2, camH - 22, "", {
      fontFamily: FONT, fontSize: "8px", fontStyle: "bold",
      color: "#F5F0E8", align: "center",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(600).setScrollFactor(0);

    // ── Input ──────────────────────────────────────────────────────────────
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    this.showMessage("Bienvenido a la Plaza de las Esculturas. WASD/flechas, ESPACIO interactuar.");
  }

  /* ═══════ TILE RENDERING (enhanced with sub-tile detail) ═══════ */

  private renderTiles(tileMap: number[][]) {
    const gfx = this.add.graphics().setDepth(0);

    // ── Base tile fill ──
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = tileMap[y][x];
        gfx.fillStyle(TCOL[t][th(x, y)], 1);
        gfx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // ── Detail layer 1: ground texture ──
    const det = this.add.graphics().setDepth(1);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = tileMap[y][x];
        const px = x * TILE, py = y * TILE;

        // ─ Cobblestone brick pattern on PATH tiles ─
        if (t === TP) {
          det.lineStyle(1, 0xa08a60, 0.18);
          det.lineBetween(px, py + 5, px + TILE, py + 5);
          det.lineBetween(px, py + 11, px + TILE, py + 11);
          const brickOff = (y % 2 === 0) ? 0 : 8;
          det.lineBetween(px + brickOff, py, px + brickOff, py + 5);
          det.lineBetween(px + ((brickOff + 8) % TILE), py + 5, px + ((brickOff + 8) % TILE), py + 11);
          det.lineBetween(px + brickOff, py + 11, px + brickOff, py + TILE);
          // Occasional worn stone patch
          if (th(x * 11, y * 7) === 0) {
            det.fillStyle(0x9a8460, 0.12);
            det.fillRect(px + 3, py + 3, 5, 3);
          }
        }

        // ─ Plaza stone pattern (larger flagstones) ─
        if (t === TC) {
          det.lineStyle(1, 0xb0a070, 0.12);
          det.lineBetween(px, py + 8, px + TILE, py + 8);
          const flagOff = (y % 2 === 0) ? 4 : 12;
          det.lineBetween(px + flagOff, py, px + flagOff, py + 8);
          det.lineBetween(px + ((flagOff + 8) % TILE), py + 8, px + ((flagOff + 8) % TILE), py + TILE);
          // Subtle color variation in each flagstone
          if (th(x * 9, y * 3) === 1) {
            det.fillStyle(0xc8b884, 0.08);
            det.fillRect(px + 1, py + 1, 7, 7);
          }
        }

        // ─ Grass: multiple detail types ─
        if (t === TG) {
          const seed = th(x * 3, y * 7);
          // Grass blades (tiny vertical marks in varying greens)
          if (seed <= 1) {
            for (let i = 0; i < 2 + seed; i++) {
              const gx = px + (th(x * (i + 3), y * (i + 7)) % 12) + 2;
              const gy = py + (th(x * (i + 5), y * (i + 2)) % 11) + 2;
              const shade = [0x5ca042, 0x3a7028, 0x6aaa4a, 0x448628][th(x + i, y + i * 3) % 4];
              det.fillStyle(shade, 0.6);
              det.fillRect(gx, gy, 1, 2);
            }
          }
          // Wildflowers (4 color types)
          if (th(x * 11, y * 17) === 0) {
            const fx = px + (th(x, y * 3) % 10) + 3;
            const fy = py + (th(x * 2, y) % 10) + 3;
            const flowerCol = [0xddaa44, 0xcc4488, 0xeeddff, 0xee6644][th(x * 7, y * 13) % 4];
            det.fillStyle(flowerCol, 0.65);
            det.fillRect(fx, fy, 2, 2);
            // Green stem
            det.fillStyle(0x3a6828, 0.45);
            det.fillRect(fx, fy + 2, 1, 2);
          }
          // Small pebbles
          if (th(x * 13, y * 23) === 2) {
            det.fillStyle(0x8a8a7a, 0.2);
            det.fillRect(px + (th(x * 4, y) % 8) + 4, py + (th(x, y * 4) % 8) + 6, 2, 1);
          }
          // Darker grass patches (natural variation)
          if (th(x * 17, y * 19) === 3) {
            det.fillStyle(0x3a7828, 0.15);
            det.fillRect(px + 2, py + 4, 4, 3);
          }
        }

        // ─ Path/plaza edge borders (where walkway meets grass) ─
        if (t === TP || t === TC) {
          const isGrassL = x > 0 && tileMap[y][x - 1] === TG;
          const isGrassR = x < MAP_W - 1 && tileMap[y][x + 1] === TG;
          const isGrassU = y > 0 && tileMap[y - 1][x] === TG;
          const isGrassD = y < MAP_H - 1 && tileMap[y + 1][x] === TG;

          // Dark edge line
          det.lineStyle(1, 0x7a6a4a, 0.35);
          if (isGrassL) det.lineBetween(px, py, px, py + TILE);
          if (isGrassR) det.lineBetween(px + TILE, py, px + TILE, py + TILE);
          if (isGrassU) det.lineBetween(px, py, px + TILE, py);
          if (isGrassD) det.lineBetween(px, py + TILE, px + TILE, py + TILE);

          // Grass creep: tiny green pixels growing into the path edges
          if (isGrassL && th(x * 5, y * 9) < 2) {
            det.fillStyle(0x4a8c32, 0.35);
            det.fillRect(px, py + (th(x, y * 6) % 10) + 3, 2, 2);
          }
          if (isGrassD && th(x * 3, y * 11) < 2) {
            det.fillStyle(0x4a8c32, 0.35);
            det.fillRect(px + (th(x * 8, y) % 10) + 3, py + TILE - 2, 2, 2);
          }
          if (isGrassR && th(x * 7, y * 3) === 0) {
            det.fillStyle(0x4a8c32, 0.3);
            det.fillRect(px + TILE - 2, py + (th(x * 4, y * 2) % 10) + 3, 2, 2);
          }
          if (isGrassU && th(x * 2, y * 7) === 0) {
            det.fillStyle(0x4a8c32, 0.3);
            det.fillRect(px + (th(x * 6, y * 3) % 10) + 3, py, 2, 2);
          }
        }
      }
    }

    // ── Road dashed center lines ──
    det.fillStyle(0x666666, 0.4);
    for (let x = 2; x < MAP_W - 2; x += 3) {
      det.fillRect(x * TILE + 4, 7, 8, 2);
      det.fillRect(x * TILE + 4, (MAP_H - 1) * TILE + 7, 8, 2);
    }
    for (let y = 2; y < MAP_H - 2; y += 3) {
      det.fillRect(7, y * TILE + 4, 2, 8);
      det.fillRect((MAP_W - 1) * TILE + 7, y * TILE + 4, 2, 8);
    }

    // ── Sidewalk curb lines ──
    det.lineStyle(1, 0x707060, 0.3);
    det.lineBetween(TILE, TILE, (MAP_W - 1) * TILE, TILE);
    det.lineBetween(TILE, (MAP_H - 2) * TILE, (MAP_W - 1) * TILE, (MAP_H - 2) * TILE);
    det.lineBetween(TILE, TILE, TILE, (MAP_H - 1) * TILE);
    det.lineBetween((MAP_W - 2) * TILE, TILE, (MAP_W - 2) * TILE, (MAP_H - 1) * TILE);

    // ── Detail layer 2: seamless vegetation ground integration ──
    const vegGfx = this.add.graphics().setDepth(0.5);

    for (const d of DECOS) {
      const isTree = d.key === "hub-mango" || d.key === "hub-palm";
      const isBush = d.key === "hub-bush" || d.key === "hub-flowerbed";
      if (!isTree && !isBush) continue;

      const cx = d.tx * TILE + TILE / 2;
      const cy = d.ty * TILE + TILE / 2;

      if (isTree) {
        const isMango = d.key === "hub-mango";
        const r = isMango ? 16 : 10;

        // Layer 1: wide dark grass blend (outermost)
        vegGfx.fillStyle(0x3a7828, 0.2);
        vegGfx.fillEllipse(cx, cy + 2, r * 2.6, r * 1.6);

        // Layer 2: medium darker grass ring
        vegGfx.fillStyle(0x3a6a24, 0.25);
        vegGfx.fillEllipse(cx, cy + 2, r * 2.0, r * 1.2);

        // Layer 3: earth/dirt core
        vegGfx.fillStyle(0x4a6028, 0.3);
        vegGfx.fillEllipse(cx, cy + 2, r * 1.3, r * 0.8);

        // Layer 4: darkest trunk base
        vegGfx.fillStyle(0x3a5020, 0.25);
        vegGfx.fillEllipse(cx, cy + 3, r * 0.6, r * 0.4);

        // Scattered undergrowth (tiny green/brown pixels blending outward)
        const spread = isMango ? 22 : 14;
        for (let i = 0; i < (isMango ? 16 : 10); i++) {
          const angle = (th(d.tx * (i + 1), d.ty * (i + 3)) / 4) * Math.PI * 2 + i * 0.9;
          const dist = (th(d.tx * (i + 5), d.ty * (i + 1)) / 4) * spread * 0.6 + spread * 0.3;
          const lx = cx + Math.cos(angle) * dist;
          const ly = cy + Math.sin(angle) * dist * 0.6 + 2;
          const leafCol = [0x5a8a2a, 0x7a9a3a, 0x4a7828, 0x6a8a32, 0x8a7a30, 0x3a6820][i % 6];
          vegGfx.fillStyle(leafCol, 0.45);
          vegGfx.fillRect(lx, ly, 2, 2);
          // Some become small leaf clusters (2-pixel wide)
          if (i % 3 === 0) {
            vegGfx.fillStyle(0x5a8830, 0.3);
            vegGfx.fillRect(lx + 1, ly - 1, 2, 1);
          }
        }

        // Root marks for mango trees
        if (isMango) {
          vegGfx.lineStyle(1, 0x3a5020, 0.12);
          for (let r2 = 0; r2 < 4; r2++) {
            const a = (r2 / 4) * Math.PI * 2 + 0.3;
            vegGfx.lineBetween(cx, cy + 3, cx + Math.cos(a) * 8, cy + 3 + Math.sin(a) * 5);
          }
        }
      }

      if (isBush) {
        // Subtle grass darkening around bushes
        vegGfx.fillStyle(0x3a7828, 0.2);
        vegGfx.fillEllipse(cx, cy + 2, 20, 14);
        vegGfx.fillStyle(0x4a7830, 0.15);
        vegGfx.fillEllipse(cx, cy + 2, 14, 10);
        // Tiny scattered petals/leaves around flower beds
        if (d.key === "hub-flowerbed") {
          for (let i = 0; i < 5; i++) {
            const px2 = cx + ((th(d.tx * i, d.ty * (i + 2)) % 16) - 8);
            const py2 = cy + ((th(d.tx * (i + 3), d.ty * i) % 12) - 6) + 2;
            vegGfx.fillStyle([0xdd9944, 0xcc4466, 0xee6644][i % 3], 0.3);
            vegGfx.fillRect(px2, py2, 1, 1);
          }
        }
      }
    }

    // ── Global grass enrichment: dense tufts near any vegetation ──
    // For each grass tile near a tree/bush, add extra detail
    for (let y = 2; y < MAP_H - 2; y++) {
      for (let x = 2; x < MAP_W - 2; x++) {
        if (tileMap[y][x] !== TG) continue;
        // Check if near any tree/bush
        let nearVeg = false;
        for (const d of DECOS) {
          if (d.key !== "hub-mango" && d.key !== "hub-palm" && d.key !== "hub-bush" && d.key !== "hub-flowerbed") continue;
          const dx = Math.abs(d.tx - x);
          const dy = Math.abs(d.ty - y);
          if (dx <= 2 && dy <= 2) { nearVeg = true; break; }
        }
        if (!nearVeg) continue;
        const px = x * TILE;
        const py = y * TILE;
        // Extra grass blades and darker patches near vegetation
        for (let i = 0; i < 3; i++) {
          const gx = px + (th(x * (i + 7), y * (i + 11)) % 12) + 2;
          const gy = py + (th(x * (i + 9), y * (i + 3)) % 12) + 2;
          vegGfx.fillStyle([0x3a7828, 0x4a8032, 0x3a6a24][i % 3], 0.4);
          vegGfx.fillRect(gx, gy, 1, 3);
        }
        // Occasional mushroom/moss spot
        if (th(x * 19, y * 23) === 0) {
          vegGfx.fillStyle(0x6a8a3a, 0.3);
          vegGfx.fillCircle(px + 8, py + 10, 2);
        }
      }
    }
  }

  /* ═══════ DECORATION PLACEMENT (enhanced with glow, shadows, integration) ═══════ */

  private placeDecorations() {
    // ── Ground-level effects (below sprites) ──
    const groundFx = this.add.graphics().setDepth(1.5);

    for (const d of DECOS) {
      const baseCx = d.tx * TILE + TILE / 2;
      const baseCy = d.ty * TILE + TILE / 2;

      // Tree shadows (larger, softer)
      if (d.key === "hub-mango" || d.key === "hub-palm") {
        groundFx.fillStyle(0x000000, 0.1);
        groundFx.fillEllipse(baseCx + 2, baseCy + 5, d.w * 0.7, d.h * 0.35);
        groundFx.fillStyle(0x000000, 0.06);
        groundFx.fillEllipse(baseCx + 2, baseCy + 5, d.w * 0.9, d.h * 0.45);
      }

      // Bench shadows
      if (d.key === "hub-bench") {
        groundFx.fillStyle(0x000000, 0.12);
        groundFx.fillRect(baseCx - 10, baseCy + 4, 20, 4);
      }

      // Sculpture pedestals (small stone base drawn on ground)
      if (d.key.startsWith("hub-sculpture")) {
        groundFx.fillStyle(0x888880, 0.25);
        groundFx.fillRect(baseCx - 5, baseCy + 4, 10, 4);
        groundFx.fillStyle(0x000000, 0.08);
        groundFx.fillRect(baseCx - 6, baseCy + 7, 12, 2);
      }

      // Lamp warm glow (circle of light on ground)
      if (d.key === "hub-lamp") {
        // Outer soft glow
        groundFx.fillStyle(0xffdd88, 0.06);
        groundFx.fillCircle(baseCx, baseCy, 14);
        // Inner warm glow
        groundFx.fillStyle(0xffcc66, 0.08);
        groundFx.fillCircle(baseCx, baseCy, 8);
        // Bright center spot
        groundFx.fillStyle(0xffeeaa, 0.1);
        groundFx.fillCircle(baseCx, baseCy - 2, 4);
      }
    }

    // ── Place sprite images ──
    for (const d of DECOS) {
      if (!this.textures.exists(d.key)) continue;

      const baseCx = d.tx * TILE + TILE / 2;
      const baseCy = d.ty * TILE + TILE / 2;

      // Fountain: center between 4 tiles (14,10)-(15,11)
      if (d.key === "hub-fountain") {
        this.add.image(14 * TILE + TILE, 10 * TILE + TILE, d.key)
          .setDisplaySize(d.w, d.h)
          .setDepth(12 * TILE);
        // Water shimmer pixels
        groundFx.fillStyle(0x88ccff, 0.15);
        groundFx.fillCircle(14 * TILE + TILE, 10 * TILE + TILE, 12);
        continue;
      }

      const img = this.add.image(baseCx, baseCy + (d.oy || 0), d.key)
        .setDisplaySize(d.w, d.h)
        .setDepth((d.ty + 1) * TILE);

      // Flip some sculptures horizontally for variety
      if (d.key.startsWith("hub-sculpture") && th(d.tx, d.ty) % 2 === 1) {
        img.setFlipX(true);
      }
    }
  }

  /* ═══════ UPDATE LOOP ═══════ */

  update() {
    if (this.isPaused) return;
    if (this.isMoving) return;

    // ESC → pause
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.togglePause();
      return;
    }

    // Interact (Space)
    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.tryInteract();
      return;
    }

    // Movement
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

      // Play walk animation
      const animKey = `player-${this.genderPrefix}-walk-${this.playerDirection}`;
      if (this.anims.exists(animKey)) {
        this.playerSprite.play(animKey, true);
      } else {
        this.playerSprite.setTexture(`player-${this.playerDirection}`);
      }
      const nx = this.playerTileX + dx;
      const ny = this.playerTileY + dy;
      if (!isBlocked(nx, ny)) this.movePlayer(nx, ny);
    } else {
      // No input — show idle frame (frame 0 of walk sheet)
      if (this.playerSprite.anims?.isPlaying) {
        this.playerSprite.play(`player-${this.genderPrefix}-idle-${this.playerDirection}`);
      }
    }
  }

  private movePlayer(nx: number, ny: number) {
    this.isMoving = true;
    this.playerTileX = nx;
    this.playerTileY = ny;
    this.playerSprite.setDepth((ny + 1) * TILE);

    this.tweens.add({
      targets: this.playerSprite,
      x: nx * TILE + TILE / 2,
      y: ny * TILE + TILE / 2,
      duration: MOVE_SPEED,
      onComplete: () => {
        this.isMoving = false;
        this.checkDoorEntry();
      },
    });
  }

  /* ═══════ INTERACTION ═══════ */

  /** Pokemon-style: stepping on a door tile triggers the building */
  private checkDoorEntry() {
    for (let i = 0; i < ZONES.length; i++) {
      const z = ZONES[i];
      if (this.playerTileX === z.doorX && this.playerTileY === z.doorY) {
        this.handleZone(i);
        return;
      }
    }
  }

  private tryInteract() {
    // Space bar still works as fallback — checks 1-tile proximity
    for (let i = 0; i < ZONES.length; i++) {
      const z = ZONES[i];
      if (
        this.playerTileX >= z.x - 1 && this.playerTileX < z.x + z.w + 1 &&
        this.playerTileY >= z.y - 1 && this.playerTileY < z.y + z.h + 1
      ) {
        this.handleZone(i);
        return;
      }
    }
    this.showMessage("Acercate a la puerta de un edificio para entrar.");
  }

  private handleZone(index: number) {
    switch (index) {
      case 0: this.enterFarmaPorro(); break; // FarmaPorro interior
      case 1: this.enterDungeon(); break;    // Mototaxi
    }
  }

  /* ═══════ ZONE ACTIONS ═══════ */

  private enterFarmaPorro() {
    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start("FarmaPorroScene");
    });
  }

  private enterDungeon() {
    this.save.currentDungeon = 1;
    this.save.currentFloor = 1;
    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(400, () => {
      this.scene.start("DungeonScene", { dungeonId: 1 });
    });
  }

  private updatePointsDisplay() {
    if (this.pointsText) {
      this.pointsText.setText(`Club Enrola: ${this.save.points ?? 0} pts`);
    }
  }

  /* ═══════ HUD ═══════ */

  private buildTeamHUD() {
    this.hpTexts.forEach(t => t.destroy());
    this.hpBars.forEach(b => b.destroy());
    this.hpTexts = [];
    this.hpBars = [];

    const startX = 4;
    const startY = 4;
    const barW = 50;
    const barH = 5;

    for (let i = 0; i < this.save.team.length && i < 3; i++) {
      const c = this.save.team[i];
      const x = startX;
      const y = startY + i * 16;
      const name = (c.nickname || c.data?.name || "???").substring(0, 10);
      const ratio = c.maxHp > 0 ? c.currentHp / c.maxHp : 0;

      const text = this.add.text(x, y, `${name} Lv${c.level}`, {
        fontFamily: FONT, fontSize: "7px",
        color: "#C4B48A", stroke: "#000000", strokeThickness: 2,
      }).setDepth(600).setScrollFactor(0);

      this.add.rectangle(x + barW / 2, y + 10, barW, barH, 0x1e1e1e)
        .setDepth(600).setScrollFactor(0);

      const hpColor = ratio > 0.5 ? 0x6abf4b : ratio > 0.25 ? 0xd4a832 : 0xcc3333;
      const bar = this.add.rectangle(x, y + 10 - barH / 2, barW * ratio, barH, hpColor)
        .setOrigin(0, 0).setDepth(601).setScrollFactor(0);

      this.hpTexts.push(text);
      this.hpBars.push(bar);
    }
  }

  private updateTeamHUD() {
    this.buildTeamHUD();
  }

  private showMessage(msg: string) {
    this.messageText.setText(msg);
    if (this.messageTimer) this.messageTimer.destroy();
    this.messageTimer = this.time.delayedCall(4000, () => {
      this.messageText.setText("");
    });
  }

  /* ═══════ PAUSE OVERLAY ═══════ */

  private togglePause() {
    if (this.isPaused) {
      this.pauseOverlay?.destroy();
      this.pauseOverlay = undefined;
      this.isPaused = false;
      return;
    }

    this.isPaused = true;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7)
      .setDepth(700).setScrollFactor(0);
    const title = this.add.text(w / 2, h / 2 - 30, "PAUSA", {
      fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#E84B2B",
    }).setOrigin(0.5).setDepth(701).setScrollFactor(0);

    const btnBg = this.add.rectangle(w / 2, h / 2 + 20, 200, 30, 0x333333)
      .setDepth(701).setScrollFactor(0);
    btnBg.setInteractive({ useHandCursor: true });
    const btnText = this.add.text(w / 2, h / 2 + 20, "GUARDAR Y SALIR", {
      fontFamily: FONT, fontSize: "11px", fontStyle: "bold", color: "#F5F0E8",
    }).setOrigin(0.5).setDepth(702).setScrollFactor(0);

    btnBg.on("pointerover", () => btnText.setColor("#E84B2B"));
    btnBg.on("pointerout", () => btnText.setColor("#F5F0E8"));
    btnBg.on("pointerdown", () => {
      SaveManager.save(this.save);
      this.scene.start("TitleScene");
    });

    const resumeText = this.add.text(w / 2, h / 2 + 60, "ESC para continuar", {
      fontFamily: FONT, fontSize: "9px", color: "#C4B48A",
    }).setOrigin(0.5).setDepth(701).setScrollFactor(0);

    this.pauseOverlay = this.add.container(0, 0, [bg, title, btnBg, btnText, resumeText])
      .setDepth(700).setScrollFactor(0);
  }

  /* ═══════ DEFAULT SAVE ═══════ */

  private defaultSave(): PlayerSave {
    return {
      team: [],
      box: [],
      inventory: [],
      dex: [],
      currentDungeon: null,
      currentFloor: 0,
      points: 0,
      gender: "m",
      badges: [],
    };
  }
}
