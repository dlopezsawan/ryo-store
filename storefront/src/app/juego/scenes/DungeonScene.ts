// ─── Enrola Legends – DungeonScene (procedural exploration) ──────────────────

import * as Phaser from "phaser";
import { generateFloorSync, DungeonFloor } from "../lib/DungeonGenerator";
import { SaveManager } from "../lib/SaveManager";
import type { PlayerSave, DungeonData, CreatureInstance } from "../lib/types";

const TILE = 16;
const MOVE_SPEED = 100; // ms per grid step
const FONT = "Arial, Helvetica, sans-serif";

// ── Wang tile index → spritesheet grid position ─────────────────────────────
// The forest tileset PNG is a 4x4 grid (16 tiles, 16x16px each).
// Each Wang index (0-15) maps to a specific grid position in the spritesheet.
const WANG_TO_GRID: Record<number, number> = {
  0: 6,   // all floor
  1: 7,
  2: 10,
  3: 9,
  4: 2,
  5: 11,
  6: 4,
  7: 15,
  8: 5,
  9: 14,
  10: 1,
  11: 8,
  12: 3,
  13: 0,
  14: 13,
  15: 12, // all wall
};

export class DungeonScene extends Phaser.Scene {
  private save!: PlayerSave;
  private dungeonId = 1;
  private dungeonData!: DungeonData;
  private floor = 1;
  private floorData!: DungeonFloor;

  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerDir: "south" | "north" | "east" | "west" = "south";
  private playerTileX = 0;
  private playerTileY = 0;
  private isMoving = false;
  private stepCount = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  private tileContainer!: Phaser.GameObjects.Container;
  private overlayGfx!: Phaser.GameObjects.Graphics;
  private hudFloorText!: Phaser.GameObjects.Text;
  private hudHpTexts: Phaser.GameObjects.Text[] = [];
  private messageText!: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: "DungeonScene" });
  }

  init(data?: { dungeonId?: number; floor?: number }) {
    this.dungeonId = data?.dungeonId ?? 1;
    this.floor = data?.floor ?? 1;
    this.stepCount = 0;
  }

  create() {
    // ── Load save ───────────────────────────────────────────────────────────
    const registrySave = this.registry.get("playerSave") as PlayerSave | undefined;
    const diskSave = SaveManager.load();
    this.save = registrySave || diskSave || this.defaultSave();

    // ── Load dungeon data from registry ─────────────────────────────────────
    const dungeonsData = this.registry.get("dungeonsData") as DungeonData[] | undefined;
    const dungeon = dungeonsData?.find(d => d.id === this.dungeonId);
    if (!dungeon) {
      this.showMessage("Error: mazmorra no encontrada");
      this.time.delayedCall(1500, () => this.scene.start("HubScene"));
      return;
    }
    this.dungeonData = dungeon;

    // Clamp floor
    if (this.floor < 1) this.floor = 1;
    if (this.floor > this.dungeonData.floors) this.floor = this.dungeonData.floors;

    // ── Generate floor ──────────────────────────────────────────────────────
    this.generateCurrentFloor();

    // ── Create tileset frames from the forest tileset spritesheet ────────────
    this.createTilesetFrames();

    // ── Camera ──────────────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor(0x050508);
    this.cameras.main.fadeIn(300);
    // Set world bounds for camera scrolling
    this.cameras.main.setBounds(0, 0, this.floorData.width * TILE, this.floorData.height * TILE);

    // ── Render tiles ────────────────────────────────────────────────────────
    this.tileContainer = this.add.container(0, 0).setDepth(0);
    this.overlayGfx = this.add.graphics().setDepth(1);
    this.renderFloor();

    // ── Player ──────────────────────────────────────────────────────────────
    this.playerTileX = this.floorData.spawnX;
    this.playerTileY = this.floorData.spawnY;
    this.playerDir = "south";
    this.playerSprite = this.add.sprite(
      this.playerTileX * TILE + TILE / 2,
      this.playerTileY * TILE + TILE / 2,
      "player-south"
    ).setDepth(3).setDisplaySize(TILE * 1.4, TILE * 1.4);

    // Camera follows player — zoomed in like Pokemon Crystal (~15x10 tiles visible)
    this.cameras.main.setZoom(2);
    this.cameras.main.startFollow(this.playerSprite, true, 0.15, 0.15);

    // ── HUD (fixed to camera) ───────────────────────────────────────────────
    this.buildHUD();

    // ── Input ───────────────────────────────────────────────────────────────
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

    this.showMessage(`${this.dungeonData.name} - Piso ${this.floor}/${this.dungeonData.floors}`);
  }

  update() {
    if (this.isMoving) return;

    // ESC -> return to hub
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.returnToHub("Escapaste de la mazmorra.");
      return;
    }

    // Movement
    let dx = 0, dy = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) { dx = -1; this.setPlayerDir("west"); }
    else if (this.cursors?.right.isDown || this.wasd?.D.isDown) { dx = 1; this.setPlayerDir("east"); }
    else if (this.cursors?.up.isDown || this.wasd?.W.isDown) { dy = -1; this.setPlayerDir("north"); }
    else if (this.cursors?.down.isDown || this.wasd?.S.isDown) { dy = 1; this.setPlayerDir("south"); }

    if (dx !== 0 || dy !== 0) {
      const nx = this.playerTileX + dx;
      const ny = this.playerTileY + dy;

      // Check bounds and walkability
      if (this.isWalkable(nx, ny)) {
        this.movePlayer(nx, ny);
      }
    }
  }

  // ── Floor generation & rendering ──────────────────────────────────────────

  private generateCurrentFloor() {
    this.floorData = generateFloorSync(this.dungeonData, this.floor);
  }

  /** Create named frames from the tileset-forest spritesheet using PixelLab Wang metadata */
  private createTilesetFrames() {
    const tex = this.textures.get("tileset-forest");
    if (!tex) return;
    // Wang index → position in spritesheet (from PixelLab metadata)
    const WANG_MAP: Record<number, { x: number; y: number }> = {
      13: { x: 0, y: 0 },  10: { x: 16, y: 0 },  4: { x: 32, y: 0 },  12: { x: 48, y: 0 },
      6: { x: 0, y: 16 },   8: { x: 16, y: 16 },  0: { x: 32, y: 16 },  1: { x: 48, y: 16 },
      11: { x: 0, y: 32 },  3: { x: 16, y: 32 },  2: { x: 32, y: 32 },  5: { x: 48, y: 32 },
      15: { x: 0, y: 48 }, 14: { x: 16, y: 48 },  9: { x: 32, y: 48 },  7: { x: 48, y: 48 },
    };
    for (const [wangId, pos] of Object.entries(WANG_MAP)) {
      const key = `forest-${wangId}`;
      if (!tex.has(key)) {
        tex.add(key, 0, pos.x, pos.y, 16, 16);
      }
    }
  }

  /** Determine if a tile position is a "wall" for Wang tiling purposes */
  private isWallTile(x: number, y: number): boolean {
    const fd = this.floorData;
    if (x < 0 || x >= fd.width || y < 0 || y >= fd.height) return true; // out of bounds = wall
    return fd.tiles[y][x] === 0;
  }

  /**
   * Compute the Wang tile index (0-15) for a given position.
   * Each corner's terrain is determined by adjacent cardinal neighbors:
   *   NW = upper if north OR west is wall
   *   NE = upper if north OR east is wall
   *   SW = upper if south OR west is wall
   *   SE = upper if south OR east is wall
   * Wang index = NW*1 + NE*2 + SW*4 + SE*8
   */
  private getWangIndex(x: number, y: number): number {
    const n = this.isWallTile(x, y - 1);
    const s = this.isWallTile(x, y + 1);
    const w = this.isWallTile(x - 1, y);
    const e = this.isWallTile(x + 1, y);

    const nw = (n || w) ? 1 : 0;
    const ne = (n || e) ? 1 : 0;
    const sw = (s || w) ? 1 : 0;
    const se = (s || e) ? 1 : 0;

    return nw * 1 + ne * 2 + sw * 4 + se * 8;
  }

  /** Get the spritesheet frame name for a given Wang index */
  private getWangFrame(wangIdx: number): string {
    return `forest-${wangIdx}`;
  }

  private renderFloor() {
    // Clear previous tile images
    this.tileContainer.removeAll(true);
    this.overlayGfx.clear();
    const fd = this.floorData;

    for (let y = 0; y < fd.height; y++) {
      for (let x = 0; x < fd.width; x++) {
        const tile = fd.tiles[y][x];
        const px = x * TILE + TILE / 2;
        const py = y * TILE + TILE / 2;

        if (tile === 0) {
          // Wall tile: use the all-upper Wang tile (index 15)
          const img = this.add.image(px, py, "tileset-forest", this.getWangFrame(15));
          this.tileContainer.add(img);
        } else {
          // Floor/corridor/special: use Wang transition tile based on neighbors
          const wangIdx = this.getWangIndex(x, y);
          const img = this.add.image(px, py, "tileset-forest", this.getWangFrame(wangIdx));
          this.tileContainer.add(img);

          // Slight blue tint for corridors
          if (tile === 2) {
            img.setTint(0xccccee);
          }

          // ── Special tile overlays ──────────────────────────────────────
          if (tile === 3) {
            // Stairs down - yellow downward arrow
            this.overlayGfx.fillStyle(0xffff88, 0.7);
            this.overlayGfx.fillTriangle(
              x * TILE + 4, y * TILE + 4,
              x * TILE + TILE - 4, y * TILE + 4,
              x * TILE + TILE / 2, y * TILE + TILE - 4
            );
          } else if (tile === 4) {
            // Item sparkle - blue diamond
            this.overlayGfx.fillStyle(0x88ccff, 0.8);
            const cx = x * TILE + TILE / 2;
            const cy = y * TILE + TILE / 2;
            this.overlayGfx.fillCircle(cx, cy, 3);
            // Small sparkle lines
            this.overlayGfx.lineStyle(1, 0xaaddff, 0.6);
            this.overlayGfx.lineBetween(cx - 5, cy, cx + 5, cy);
            this.overlayGfx.lineBetween(cx, cy - 5, cx, cy + 5);
          } else if (tile === 5) {
            // Boss - red glowing circle
            this.overlayGfx.fillStyle(0xcc2222, 0.3);
            this.overlayGfx.fillCircle(x * TILE + TILE / 2, y * TILE + TILE / 2, 6);
            this.overlayGfx.fillStyle(0xff4444, 0.8);
            this.overlayGfx.fillCircle(x * TILE + TILE / 2, y * TILE + TILE / 2, 3);
          } else if (tile === 6) {
            // Stairs up - green upward arrow
            this.overlayGfx.fillStyle(0x88ff88, 0.7);
            this.overlayGfx.fillTriangle(
              x * TILE + TILE / 2, y * TILE + 4,
              x * TILE + 4, y * TILE + TILE - 4,
              x * TILE + TILE - 4, y * TILE + TILE - 4
            );
          }
        }
      }
    }
  }

  private isWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.floorData.width || y < 0 || y >= this.floorData.height) return false;
    return this.floorData.tiles[y][x] !== 0; // anything except wall
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  /** Update the player sprite texture/animation based on facing direction */
  private setPlayerDir(dir: "south" | "north" | "east" | "west") {
    if (this.playerDir !== dir) {
      this.playerDir = dir;
    }
    const animKey = `player-walk-${dir}`;
    if (this.anims.exists(animKey)) {
      this.playerSprite.play(animKey, true);
    } else {
      this.playerSprite.setTexture(`player-${dir}`);
    }
  }

  private stopPlayerAnim() {
    if (this.playerSprite.anims?.isPlaying) {
      this.playerSprite.stop();
      this.playerSprite.setTexture(`player-${this.playerDir}`);
    }
  }

  private movePlayer(nx: number, ny: number) {
    this.isMoving = true;
    this.playerTileX = nx;
    this.playerTileY = ny;

    this.tweens.add({
      targets: this.playerSprite,
      x: nx * TILE + TILE / 2,
      y: ny * TILE + TILE / 2,
      duration: MOVE_SPEED,
      onComplete: () => {
        this.isMoving = false;
        this.stopPlayerAnim();
        this.onStepComplete(nx, ny);
      },
    });
  }

  private onStepComplete(x: number, y: number) {
    const tile = this.floorData.tiles[y][x];
    this.stepCount++;

    switch (tile) {
      case 1: // floor
      case 2: // corridor
        this.checkRandomEncounter();
        break;
      case 3: // stairs down
        this.descendStairs();
        break;
      case 4: // item
        this.pickupItem(x, y);
        break;
      case 5: // boss
        this.triggerBossBattle();
        break;
      case 6: // stairs up
        this.ascendStairs();
        break;
    }
  }

  // ── Encounters ────────────────────────────────────────────────────────────

  private checkRandomEncounter() {
    const rate = this.floorData.encounterRate / 100;
    if (Math.random() < rate) {
      this.triggerWildEncounter();
    }
  }

  private triggerWildEncounter() {
    // Pick random creature from dungeon encounter list
    const encounters = this.dungeonData.encounters;
    if (!encounters || encounters.length === 0) return;

    const creatureId = encounters[Math.floor(Math.random() * encounters.length)];
    const [minLv, maxLv] = this.dungeonData.levelRange;
    const level = Math.floor(Math.random() * (maxLv - minLv + 1)) + minLv;

    this.startBattle({
      wildCreatureId: creatureId,
      wildLevel: level,
      bgKey: this.dungeonData.bgBattle,
      returnScene: "DungeonScene",
      dungeonId: this.dungeonId,
      floor: this.floor,
      isBoss: false,
    });
  }

  private triggerBossBattle() {
    const boss = this.dungeonData.boss;

    // Dramatic boss intro: show text and flash red
    this.isMoving = true; // prevent movement during intro
    this.showMessage("¡JEFE DE MAZMORRA!");
    this.cameras.main.flash(500, 200, 30, 30);

    this.time.delayedCall(1200, () => {
      this.startBattle({
        wildCreatureId: boss.creatureId,
        wildLevel: boss.level,
        bgKey: this.dungeonData.bgBattle,
        returnScene: "DungeonScene",
        dungeonId: this.dungeonId,
        floor: this.floor,
        isBoss: true,
      });
    });
  }

  private startBattle(data: {
    wildCreatureId: number;
    wildLevel: number;
    bgKey: string;
    returnScene: string;
    dungeonId: number;
    floor: number;
    isBoss: boolean;
  }) {
    // Flash white
    this.cameras.main.flash(300, 255, 255, 255);

    // Save state before battle
    this.save.currentDungeon = this.dungeonId;
    this.save.currentFloor = this.floor;
    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);

    this.time.delayedCall(300, () => {
      this.scene.start("BattleScene", data);
    });
  }

  // ── Stairs ────────────────────────────────────────────────────────────────

  private descendStairs() {
    if (this.floor >= this.dungeonData.floors) {
      this.showMessage("No hay mas pisos.");
      return;
    }

    this.floor++;
    this.save.currentFloor = this.floor;
    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.restart({ dungeonId: this.dungeonId, floor: this.floor });
    });
  }

  private ascendStairs() {
    if (this.floor <= 1) {
      this.returnToHub("Saliste de la mazmorra.");
      return;
    }

    this.floor--;
    this.save.currentFloor = this.floor;
    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.restart({ dungeonId: this.dungeonId, floor: this.floor });
    });
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  private pickupItem(x: number, y: number) {
    const itemEntry = this.floorData.items.find(i => i.x === x && i.y === y);
    if (!itemEntry) {
      this.showMessage("No hay nada aqui.");
      return;
    }

    // Add to inventory
    const existing = this.save.inventory.find(i => i.itemId === itemEntry.itemId);
    if (existing) {
      existing.quantity++;
    } else {
      this.save.inventory.push({ itemId: itemEntry.itemId, quantity: 1 });
    }

    // Remove from floor (change to regular floor tile)
    this.floorData.tiles[y][x] = 1;
    this.floorData.items = this.floorData.items.filter(i => !(i.x === x && i.y === y));
    this.renderFloor();

    // Get item name from registry
    const itemsData = this.registry.get("itemsData") as { id: number; name: string }[] | undefined;
    const itemInfo = itemsData?.find(i => i.id === itemEntry.itemId);
    const itemName = itemInfo?.name ?? `Item #${itemEntry.itemId}`;

    this.showMessage(`Encontraste: ${itemName}!`);
    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);
  }

  // ── Return to hub ─────────────────────────────────────────────────────────

  private returnToHub(msg?: string) {
    this.save.currentDungeon = null;
    this.save.currentFloor = 0;
    SaveManager.save(this.save);
    this.registry.set("playerSave", this.save);

    if (msg) this.showMessage(msg);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(400, () => {
      this.scene.start("HubScene");
    });
  }

  /** Check if entire team is fainted, return to hub if so */
  checkTeamWipe() {
    const allFainted = this.save.team.every(c => c.currentHp <= 0);
    if (allFainted) {
      this.returnToHub("Todas tus criaturas cayeron... Volviste al Vinedo.");
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private buildHUD() {
    const w = this.cameras.main.width;

    // Floor indicator (top-left, fixed to camera via scrollFactor 0)
    this.hudFloorText = this.add.text(6, 6, "", {
      fontFamily: FONT,
      fontSize: "9px",
      fontStyle: "bold",
      color: "#C4B48A",
      stroke: "#000000",
      strokeThickness: 2,
    }).setDepth(10).setScrollFactor(0);

    // Team HP indicator (top-right, fixed to camera)
    this.updateHUD();

    // Message text (bottom, fixed to camera)
    this.messageText = this.add.text(w / 2, this.cameras.main.height - 16, "", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#F5F0E8",
      stroke: "#000000",
      strokeThickness: 2,
      align: "center",
    }).setOrigin(0.5, 1).setDepth(10).setScrollFactor(0);
  }

  private updateHUD() {
    const w = this.cameras.main.width;

    this.hudFloorText.setText(`Piso ${this.floor}/${this.dungeonData.floors}`);

    // Clear old HP texts
    this.hudHpTexts.forEach(t => t.destroy());
    this.hudHpTexts = [];

    // Show team HP compact (top-right)
    for (let i = 0; i < this.save.team.length && i < 3; i++) {
      const c = this.save.team[i];
      const name = (c.nickname || c.data?.name || "?").substring(0, 6);
      const ratio = c.maxHp > 0 ? Math.max(0, c.currentHp / c.maxHp) : 0;
      const color = ratio > 0.5 ? "#6ABF4B" : ratio > 0.25 ? "#D4A832" : "#CC3333";
      const dead = c.currentHp <= 0;

      const text = this.add.text(w - 8, 6 + i * 14, `${name} ${c.currentHp}/${c.maxHp}`, {
        fontFamily: FONT,
        fontSize: "8px",
        fontStyle: "bold",
        color: dead ? "#555555" : color,
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(10).setScrollFactor(0);

      this.hudHpTexts.push(text);
    }
  }

  private showMessage(msg: string) {
    if (!this.messageText) return;
    this.messageText.setText(msg);
    if (this.messageTimer) this.messageTimer.destroy();
    this.messageTimer = this.time.delayedCall(2500, () => {
      if (this.messageText) this.messageText.setText("");
    });
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
