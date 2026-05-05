// ─── Enrola Legends – SaveManager ──────────────────────────────────────────

import type { PlayerSave } from "./types";

const SAVE_KEY = "enrola-legends-save";
const SCHEMA_VERSION = 1;

interface SaveEnvelope {
  version: number;
  data: PlayerSave;
}

export class SaveManager {
  static save(data: PlayerSave): void {
    const envelope: SaveEnvelope = {
      version: SCHEMA_VERSION,
      data,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
  }

  static load(): PlayerSave | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;

      const envelope: SaveEnvelope = JSON.parse(raw);
      if (!envelope || envelope.version !== SCHEMA_VERSION || !envelope.data) {
        return null;
      }

      return envelope.data;
    } catch {
      // Corrupted data – discard silently
      return null;
    }
  }

  static hasSave(): boolean {
    return this.load() !== null;
  }

  static deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
