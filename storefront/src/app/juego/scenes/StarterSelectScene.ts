import * as Phaser from "phaser";
import { CreatureManager } from "../lib/CreatureManager";
import { SaveManager } from "../lib/SaveManager";
import type { CreatureData, MoveData, PlayerSave } from "../lib/types";

const ORANGE = 0xe84b2b;
const DARK = 0x1a1a1a;
const CREAM = 0xf5f0e8;

const STARTERS = [
  { id: 1, name: "Cogollito", type: "HIERBA", sprite: "sw-001-cogollito", desc: "Criatura planta.\nLeal y resistente." },
  { id: 4, name: "Mechita", type: "BRASA", sprite: "sw-004-mechita", desc: "Espiritu de fuego.\nAgresivo y veloz." },
  { id: 7, name: "Gotirro", type: "AGUA", sprite: "sw-007-gotirro", desc: "Ser acuatico.\nTranquilo y adaptable." },
] as const;

export class StarterSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "StarterSelectScene" });
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(DARK);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Title
    const title = this.add.text(w / 2, 40, "ELIGE TU CRIATURA", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#E84B2B",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(w / 2, 62, "Tu companero de aventura", {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#F5F0E8",
    });
    subtitle.setOrigin(0.5);
    subtitle.setAlpha(0.6);

    // Layout: 3 columns
    const colWidth = w / 3;
    const spriteY = h * 0.38;
    const nameY = spriteY + 70;
    const typeY = nameY + 20;
    const descY = typeY + 22;

    STARTERS.forEach((starter, i) => {
      const cx = colWidth * i + colWidth / 2;

      // Sprite (or fallback circle)
      const spriteKey = starter.sprite;
      let spriteObj: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;

      if (this.textures.exists(spriteKey)) {
        spriteObj = this.add.image(cx, spriteY, spriteKey).setDisplaySize(64, 64);
      } else {
        // Fallback colored circle
        const colors = [0x4caf50, 0xff5722, 0x2196f3];
        spriteObj = this.add.circle(cx, spriteY, 28, colors[i]);
        this.add.text(cx, spriteY, "?", {
          fontFamily: "Arial",
          fontSize: "24px",
          color: "#FFFFFF",
          fontStyle: "bold",
        }).setOrigin(0.5);
      }

      // Name
      this.add.text(cx, nameY, starter.name.toUpperCase(), {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#F5F0E8",
        fontStyle: "bold",
      }).setOrigin(0.5);

      // Type badge
      const typeBadge = this.add.text(cx, typeY, starter.type, {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#1A1A1A",
        backgroundColor: "#E84B2B",
        padding: { x: 6, y: 2 },
        fontStyle: "bold",
      }).setOrigin(0.5);

      // Description
      this.add.text(cx, descY, starter.desc, {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#F5F0E8",
        align: "center",
        lineSpacing: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7);

      // Clickable zone
      const hitZone = this.add.rectangle(cx, spriteY + 20, colWidth - 10, 160, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });

      // Hover effect
      hitZone.on("pointerover", () => {
        if (spriteObj instanceof Phaser.GameObjects.Image) {
          spriteObj.setScale(spriteObj.scaleX * 1.15, spriteObj.scaleY * 1.15);
        } else {
          spriteObj.setScale(1.15);
        }
      });

      hitZone.on("pointerout", () => {
        if (spriteObj instanceof Phaser.GameObjects.Image) {
          spriteObj.setDisplaySize(64, 64);
        } else {
          spriteObj.setScale(1);
        }
      });

      // Selection
      hitZone.on("pointerdown", () => {
        this.selectStarter(starter.id);
      });
    });
  }

  private selectStarter(creatureId: number): void {
    // Disable further input
    this.input.enabled = false;

    // Build CreatureManager from registry data
    const creaturesData = this.registry.get("creaturesData") as CreatureData[];
    const movesData = this.registry.get("movesData") as MoveData[];
    const cm = new CreatureManager(creaturesData, movesData);

    // Create starter at level 5
    const starter = cm.createInstance(creatureId, 5);

    // Build initial save
    const save: PlayerSave = {
      team: [starter],
      box: [],
      inventory: [],
      dex: [creatureId],
      currentDungeon: null,
      currentFloor: 0,
      points: 0,
      gender: "m",
      badges: [],
    };

    SaveManager.save(save);

    // Store save in registry for immediate use
    this.registry.set("playerSave", save);

    // Transition
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(400, () => {
      this.scene.start("HubScene");
    });
  }
}
