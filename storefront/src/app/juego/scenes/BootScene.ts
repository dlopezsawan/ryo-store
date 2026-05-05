import * as Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const barBg = this.add.rectangle(w / 2, h / 2, 200, 16, 0x333333);
    const bar = this.add.rectangle(w / 2 - 98, h / 2, 0, 12, 0xe84b2b);
    bar.setOrigin(0, 0.5);

    const loadText = this.add.text(w / 2, h / 2 - 20, "CARGANDO...", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#F5F0E8",
    });
    loadText.setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      bar.width = 196 * value;
    });

    this.load.on("complete", () => {
      barBg.destroy();
      bar.destroy();
      loadText.destroy();
    });

    // Load data files
    this.load.json("creatures", "/game/data/creatures.json");
    this.load.json("moves", "/game/data/moves.json");
    this.load.json("typeChart", "/game/data/type-chart.json");
    this.load.json("items", "/game/data/items.json");
    this.load.json("dungeons", "/game/data/dungeons.json");

    // Load starter + early creature sprites for quick demo
    // In production, load on-demand per dungeon
    const demoCreatures = [
      "001-cogollito", "002-cogollero", "003-cogolord",
      "004-mechita", "005-flamero", "006-infernal",
      "007-gotirro", "008-cabrialin", "009-cabriator",
      "010-jalita", "011-ventolero", "012-huracanal",
    ];

    for (const sprite of demoCreatures) {
      this.load.image(`front-${sprite}`, `/game/sprites/front/${sprite}.png`);
      this.load.image(`back-${sprite}`, `/game/sprites/back/${sprite}.png`);
      // PixelLab pro sprites: SW = enemy front view, NE = player back view
      this.load.image(`sw-${sprite}`, `/game/sprites/sw/${sprite}.png`);
      this.load.image(`ne-${sprite}`, `/game/sprites/ne/${sprite}.png`);
    }

    // Title screen
    this.load.image("title-bg", "/game/sprites/ui/title-bg.png");

    // Hub objects — Plaza de las Esculturas, El Viñedo
    this.load.image("hub-shop", "/game/sprites/hub/tienda-v3.png");
    this.load.image("hub-heal", "/game/sprites/hub/farmaporro-v4.png");
    this.load.image("hub-farmaporro", "/game/sprites/hub/farmaporro.png");
    // hub-park-entrance removed — dungeons accessed via mototaxi
    this.load.image("hub-fountain", "/game/sprites/hub/fountain.png");
    this.load.image("hub-palm", "/game/sprites/hub/palm-tree.png");
    this.load.image("hub-sculpture", "/game/sprites/hub/sculpture.png");
    this.load.image("hub-sculpture-bronze", "/game/sprites/hub/sculpture-bronze.png");
    this.load.image("hub-sculpture-marble", "/game/sprites/hub/sculpture-marble.png");
    this.load.image("hub-sculpture-iron", "/game/sprites/hub/sculpture-iron.png");
    this.load.image("hub-dex", "/game/sprites/hub/museo-v2.png");
    this.load.image("hub-mototaxi", "/game/sprites/hub/mototaxi-v4.png");
    this.load.image("hub-bench", "/game/sprites/hub/bench.png");
    this.load.image("hub-lamp", "/game/sprites/hub/lamp.png");
    this.load.image("hub-bush", "/game/sprites/hub/bush-flowers.png");
    this.load.image("hub-flowerbed", "/game/sprites/hub/flower-bed.png");
    this.load.image("hub-mango", "/game/sprites/hub/mango-tree.png");
    this.load.image("hub-pot", "/game/sprites/hub/potted-plant.png");
    this.load.image("hub-plaza-bg", "/game/sprites/hub/plaza-bg.png");

    // Hub and dungeon tilesets
    this.load.image("tileset-hub", "/game/tilesets/hub-tileset.png");
    this.load.image("tileset-forest", "/game/tilesets/forest-tileset.png");
    // Detail tiles: 3x3 grid (9 tiles, 16px each) for variety
    this.load.image("detail-tiles", "/game/tilesets/detail-tiles.png");

    // Player character — static directions
    this.load.image("player-south", "/game/sprites/player/player-south.png");
    this.load.image("player-north", "/game/sprites/player/player-north.png");
    this.load.image("player-east", "/game/sprites/player/player-east.png");
    this.load.image("player-west", "/game/sprites/player/player-west.png");
    // Player walk spritesheets — female (4 frames each, 36px per frame, 144x36)
    this.load.spritesheet("player-f-walk-south", "/game/sprites/player/player-f-walk-south.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-f-walk-north", "/game/sprites/player/player-f-walk-north.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-f-walk-east", "/game/sprites/player/player-f-walk-east.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-f-walk-west", "/game/sprites/player/player-f-walk-west.png", { frameWidth: 36, frameHeight: 36 });
    // Player walk spritesheets — male
    this.load.spritesheet("player-m-walk-south", "/game/sprites/player/player-m-walk-south.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-m-walk-north", "/game/sprites/player/player-m-walk-north.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-m-walk-east", "/game/sprites/player/player-m-walk-east.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-m-walk-west", "/game/sprites/player/player-m-walk-west.png", { frameWidth: 36, frameHeight: 36 });
    // Keep old spritesheets as default (female) — backward compat
    this.load.spritesheet("player-walk-south", "/game/sprites/player/player-f-walk-south.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-walk-north", "/game/sprites/player/player-f-walk-north.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-walk-east", "/game/sprites/player/player-f-walk-east.png", { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet("player-walk-west", "/game/sprites/player/player-f-walk-west.png", { frameWidth: 36, frameHeight: 36 });
    // NPC sprites
    this.load.image("npc-cashier", "/game/sprites/npcs/cashier-south.png");
    this.load.image("npc-pharmacist", "/game/sprites/npcs/pharmacist-south.png");

    // Load battle backgrounds (original OpenAI versions)
    const zones = ["penalver", "cuevas", "cabriales", "reda", "sambil", "casupo", "casco", "caribbean", "vinedo"];
    const bgNums = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];
    zones.forEach((z, i) => {
      // Try v2 first, fallback to original
      this.load.image(`bg-${z}`, `/game/sprites/zones/bg-${bgNums[i]}-${z}.png`);
    });
  }

  create() {
    this.registry.set("creaturesData", this.cache.json.get("creatures"));
    this.registry.set("movesData", this.cache.json.get("moves"));
    this.registry.set("typeChart", this.cache.json.get("typeChart"));
    this.registry.set("itemsData", this.cache.json.get("items"));
    this.registry.set("dungeonsData", this.cache.json.get("dungeons"));

    // Create walk + idle animations for both genders (8 fps, 4 frames)
    const walkDirs = ["south", "north", "east", "west"];
    const genders = ["f", "m"];
    for (const g of genders) {
      for (const dir of walkDirs) {
        const sheetKey = `player-${g}-walk-${dir}`;
        this.anims.create({
          key: `player-${g}-walk-${dir}`,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: 3 }),
          frameRate: 8,
          repeat: -1,
        });
        this.anims.create({
          key: `player-${g}-idle-${dir}`,
          frames: [{ key: sheetKey, frame: 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }
    // Default aliases (backward compat — uses female)
    for (const dir of walkDirs) {
      this.anims.create({
        key: `player-walk-${dir}`,
        frames: this.anims.generateFrameNumbers(`player-walk-${dir}`, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `player-idle-${dir}`,
        frames: [{ key: `player-walk-${dir}`, frame: 0 }],
        frameRate: 1,
        repeat: 0,
      });
    }

    this.scene.start("TitleScene");
  }
}
