// ─── Enrola Legends – DexScene (Collection/Dex screen) ───────────────────────

import * as Phaser from "phaser";
import { SaveManager } from "../lib/SaveManager";
import type { PlayerSave, CreatureData, CreatureType } from "../lib/types";

const FONT = "Arial, Helvetica, sans-serif";
const DARK = 0x1a1a1a;
const ORANGE = 0xe84b2b;
const CREAM = 0xf5f0e8;

/** Type color mapping from the GDD (10 types) */
const TYPE_COLORS: Record<string, number> = {
  HUMO: 0x888899,
  BRASA: 0xcc4422,
  HIERBA: 0x44aa44,
  CRISTAL: 0x66aadd,
  TIERRA: 0x997744,
  AGUA: 0x3388cc,
  VIENTO: 0x88ccaa,
  RESINA: 0xccaa33,
  METAL: 0x778899,
  ESPIRITU: 0xaa66cc,
};

const TYPE_HEX: Record<string, string> = {
  HUMO: "#888899",
  BRASA: "#CC4422",
  HIERBA: "#44AA44",
  CRISTAL: "#66AADD",
  TIERRA: "#997744",
  AGUA: "#3388CC",
  VIENTO: "#88CCAA",
  RESINA: "#CCAA33",
  METAL: "#778899",
  ESPIRITU: "#AA66CC",
};

const COLS = 5;
const CELL_W = 88;
const CELL_H = 68;
const GRID_X = 12;
const GRID_Y = 40;
const TOTAL_CREATURES = 150;

export class DexScene extends Phaser.Scene {
  private save!: PlayerSave;
  private creaturesData: CreatureData[] = [];
  private scrollY = 0;
  private maxScrollY = 0;
  private gridContainer!: Phaser.GameObjects.Container;
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "DexScene" });
  }

  create() {
    // Load save
    const registrySave = this.registry.get("playerSave") as PlayerSave | undefined;
    const diskSave = SaveManager.load();
    this.save = registrySave || diskSave || this.defaultSave();

    // Load creatures data
    this.creaturesData = this.registry.get("creaturesData") as CreatureData[] || [];

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(0x0c0c0c);
    this.cameras.main.fadeIn(300);

    // ── Header ──────────────────────────────────────────────────────────────
    const caught = this.save.dex.length;
    this.add.text(w / 2, 6, "DEX ENROLA", {
      fontFamily: FONT,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#E84B2B",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(10);

    this.add.text(w / 2, 24, `${caught}/${TOTAL_CREATURES} capturados`, {
      fontFamily: FONT,
      fontSize: "9px",
      fontStyle: "bold",
      color: "#C4B48A",
    }).setOrigin(0.5, 0).setDepth(10);

    // ── Back button ─────────────────────────────────────────────────────────
    const backBg = this.add.rectangle(36, 14, 56, 18, 0x333333).setDepth(10);
    backBg.setInteractive({ useHandCursor: true });
    const backText = this.add.text(36, 14, "< VOLVER", {
      fontFamily: FONT,
      fontSize: "8px",
      fontStyle: "bold",
      color: "#F5F0E8",
    }).setOrigin(0.5).setDepth(11);

    backBg.on("pointerover", () => backText.setColor("#E84B2B"));
    backBg.on("pointerout", () => backText.setColor("#F5F0E8"));
    backBg.on("pointerdown", () => {
      this.scene.start("HubScene");
    });

    // ── ESC key ─────────────────────────────────────────────────────────────
    if (this.input.keyboard) {
      this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    // ── Build grid ──────────────────────────────────────────────────────────
    this.gridContainer = this.add.container(0, 0).setDepth(5);
    this.buildGrid();

    // Calculate scroll bounds
    const totalRows = Math.ceil(TOTAL_CREATURES / COLS);
    const gridHeight = totalRows * CELL_H;
    const visibleHeight = h - GRID_Y;
    this.maxScrollY = Math.max(0, gridHeight - visibleHeight + 10);

    // ── Scroll input ────────────────────────────────────────────────────────
    this.input.on("wheel", (_pointer: any, _gx: any, _gy: any, _gz: any, deltaX: number, deltaY: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
      this.gridContainer.y = GRID_Y - this.scrollY;
    });

    // Touch drag scrolling
    let dragStartY = 0;
    let dragScrollStart = 0;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > GRID_Y) {
        dragStartY = pointer.y;
        dragScrollStart = this.scrollY;
      }
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && dragStartY > 0) {
        const dy = dragStartY - pointer.y;
        this.scrollY = Phaser.Math.Clamp(dragScrollStart + dy, 0, this.maxScrollY);
        this.gridContainer.y = GRID_Y - this.scrollY;
      }
    });

    // ── Mask to clip grid to visible area ───────────────────────────────────
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, GRID_Y, w, h - GRID_Y);
    const mask = maskShape.createGeometryMask();
    this.gridContainer.setMask(mask);
  }

  update() {
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.scene.start("HubScene");
    }
  }

  private buildGrid() {
    const dex = this.save.dex;

    for (let i = 0; i < TOTAL_CREATURES; i++) {
      const creatureId = i + 1;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GRID_X + col * CELL_W + CELL_W / 2;
      const y = row * CELL_H + CELL_H / 2;

      const isCaught = dex.includes(creatureId);
      const creatureData = this.creaturesData.find(c => c.id === creatureId);

      // Cell background
      const primaryType = creatureData?.types?.[0] || "HUMO";
      const bgColor = isCaught ? (TYPE_COLORS[primaryType] ?? 0x333333) : 0x111118;
      const cellBg = this.add.rectangle(x, y, CELL_W - 4, CELL_H - 4, bgColor, isCaught ? 0.25 : 0.4);
      cellBg.setStrokeStyle(1, isCaught ? (TYPE_COLORS[primaryType] ?? 0x444444) : 0x222222, 0.5);
      this.gridContainer.add(cellBg);

      if (isCaught && creatureData) {
        // Show sprite if available
        const spriteKey = `sw-${creatureData.sprite}`;
        if (this.textures.exists(spriteKey)) {
          const sprite = this.add.image(x, y - 8, spriteKey);
          const aspect = sprite.height / sprite.width;
          sprite.setDisplaySize(36, 36 * aspect);
          this.gridContainer.add(sprite);
        } else {
          // Fallback: colored circle
          const circle = this.add.circle(x, y - 8, 14, TYPE_COLORS[primaryType] ?? 0x666666, 0.6);
          this.gridContainer.add(circle);
        }

        // Name
        const nameText = this.add.text(x, y + 16, creatureData.name, {
          fontFamily: FONT,
          fontSize: "7px",
          fontStyle: "bold",
          color: "#F5F0E8",
          stroke: "#000000",
          strokeThickness: 1,
        }).setOrigin(0.5);
        this.gridContainer.add(nameText);

        // Types
        const typeStr = creatureData.types.join("/");
        const typeColor = TYPE_HEX[primaryType] ?? "#888888";
        const typeText = this.add.text(x, y + 26, typeStr, {
          fontFamily: FONT,
          fontSize: "6px",
          color: typeColor,
        }).setOrigin(0.5);
        this.gridContainer.add(typeText);
      } else {
        // Unknown: show "???"
        const qText = this.add.text(x, y - 4, "???", {
          fontFamily: FONT,
          fontSize: "14px",
          fontStyle: "bold",
          color: "#222222",
        }).setOrigin(0.5);
        this.gridContainer.add(qText);

        // Number
        const numText = this.add.text(x, y + 18, `#${String(creatureId).padStart(3, "0")}`, {
          fontFamily: FONT,
          fontSize: "7px",
          color: "#333333",
        }).setOrigin(0.5);
        this.gridContainer.add(numText);
      }
    }
  }

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
