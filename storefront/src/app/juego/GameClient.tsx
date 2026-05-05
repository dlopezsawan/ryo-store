"use client";

import { useEffect, useRef, useState } from "react";

const GAME_WIDTH = 480;
const GAME_HEIGHT = 320;
const TARGET_FPS = 24;

interface Props {
  customerId: string;
}

export default function GameClient({ customerId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    let mounted = true;

    async function initGame() {
      try {
        const Phaser = await import("phaser");
        const { BootScene } = await import("./scenes/BootScene");
        const { TitleScene } = await import("./scenes/TitleScene");
        const { StarterSelectScene } = await import("./scenes/StarterSelectScene");
        const { BattleScene } = await import("./scenes/BattleScene");
        const { HubScene } = await import("./scenes/HubScene");
        const { DungeonScene } = await import("./scenes/DungeonScene");
        const { DexScene } = await import("./scenes/DexScene");
        const { FarmaPorroScene } = await import("./scenes/FarmaPorroScene");

        if (!mounted || !containerRef.current) return;

        const RexUIPlugin = (await import("phaser3-rex-plugins/templates/ui/ui-plugin.js")).default;

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.WEBGL,
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          parent: containerRef.current,
          pixelArt: true,
          roundPixels: true,
          antialias: false,
          fps: {
            target: TARGET_FPS,
            forceSetTimeOut: true,
          },
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          backgroundColor: "#1A1A1A",
          scene: [BootScene, TitleScene, StarterSelectScene, BattleScene, HubScene, DungeonScene, DexScene, FarmaPorroScene],
          plugins: {
            scene: [{
              key: "rexUI",
              plugin: RexUIPlugin,
              mapping: "rexUI",
            }],
          },
        };

        gameRef.current = new Phaser.Game(config);
        gameRef.current.registry.set("customerId", customerId);
        setLoading(false);
      } catch (err) {
        if (mounted) setError(String(err));
      }
    }

    initGame();

    return () => {
      mounted = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [customerId]);

  if (error) {
    return (
      <div className="text-red-500 text-center p-4 font-mono text-sm">
        Error cargando el juego: {error}
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1A] z-10">
          <div className="text-center">
            <p className="text-[#E84B2B] font-black text-xl uppercase tracking-widest animate-pulse">
              Cargando...
            </p>
            <p className="text-[#F5F0E8] text-xs mt-2 opacity-60">
              Enrola Legends
            </p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-screen h-screen"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
