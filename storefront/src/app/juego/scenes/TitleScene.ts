import * as Phaser from "phaser";
import { SaveManager } from "../lib/SaveManager";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Background image stretched to fill canvas
    const bg = this.add.image(w / 2, h / 2, "title-bg");
    bg.setDisplaySize(w, h);

    // Title with shadow for readability over background
    const title = this.add.text(w / 2, h / 3, "ENROLA\nLEGENDS", {
      fontFamily: "monospace",
      fontSize: "36px",
      color: "#E84B2B",
      align: "center",
      fontStyle: "bold",
      lineSpacing: 4,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#000000",
        blur: 4,
        fill: true,
        stroke: true,
      },
      stroke: "#000000",
      strokeThickness: 3,
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(w / 2, h / 3 + 55, "Valencia, Venezuela", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#F5F0E8",
      shadow: {
        offsetX: 1,
        offsetY: 1,
        color: "#000000",
        blur: 2,
        fill: true,
      },
    });
    subtitle.setOrigin(0.5);
    subtitle.setAlpha(0.8);

    // Flashing "press to start"
    const startText = this.add.text(w / 2, h * 0.7, "TOCA PARA COMENZAR", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#F5F0E8",
      shadow: {
        offsetX: 1,
        offsetY: 1,
        color: "#000000",
        blur: 3,
        fill: true,
      },
    });
    startText.setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Version
    this.add
      .text(w - 4, h - 4, "v0.1.0", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#F5F0E8",
      })
      .setOrigin(1, 1)
      .setAlpha(0.3);

    // Click/tap to start
    this.input.once("pointerdown", () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => {
        if (SaveManager.hasSave()) {
          this.scene.start("HubScene");
        } else {
          this.scene.start("StarterSelectScene");
        }
      });
    });
  }
}
