// ─── Enrola Legends – Procedural Dungeon Generator (BSP) ────────────────────

import type { DungeonData } from "./types";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface DungeonFloor {
  width: number;
  height: number;
  tiles: number[][]; // 0=wall, 1=floor, 2=corridor, 3=stairs_down, 4=item, 5=boss, 6=stairs_up
  rooms: { x: number; y: number; w: number; h: number }[];
  spawnX: number;
  spawnY: number;
  stairsX: number;
  stairsY: number;
  items: { x: number; y: number; itemId: number }[];
  encounterRate: number; // base % per step
}

// ─── Seeded PRNG (simple LCG) ───────────────────────────────────────────────

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// ─── BSP Node ───────────────────────────────────────────────────────────────

interface BSPNode {
  x: number;
  y: number;
  w: number;
  h: number;
  left: BSPNode | null;
  right: BSPNode | null;
  room: { x: number; y: number; w: number; h: number } | null;
}

// ─── Dungeon Generator ─────────────────────────────────────────────────────

// Pickable item IDs for dungeon floor pickups (heals, repels, capture balls)
const PICKUP_ITEM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

let dungeonsCache: DungeonData[] | null = null;

async function loadDungeons(): Promise<DungeonData[]> {
  if (dungeonsCache) return dungeonsCache;
  const res = await fetch("/game/data/dungeons.json");
  dungeonsCache = (await res.json()) as DungeonData[];
  return dungeonsCache;
}

/**
 * Synchronous generator that accepts pre-loaded dungeon data.
 * Prefer `generateFloor` for the async version that auto-loads data.
 */
export function generateFloorSync(
  dungeonData: DungeonData,
  floorNumber: number
): DungeonFloor {
  const WIDTH = 30;
  const HEIGHT = 20;
  const seed = dungeonData.id * 1000 + floorNumber;
  const rng = new SeededRandom(seed);

  const isFinalFloor = floorNumber === dungeonData.floors;

  // ── 1. Create empty grid (all walls) ─────────────────────────────────────
  const tiles: number[][] = [];
  for (let y = 0; y < HEIGHT; y++) {
    tiles[y] = new Array(WIDTH).fill(0);
  }

  // ── 2. BSP split ─────────────────────────────────────────────────────────
  const root: BSPNode = { x: 1, y: 1, w: WIDTH - 2, h: HEIGHT - 2, left: null, right: null, room: null };
  const leaves: BSPNode[] = [];

  function split(node: BSPNode, depth: number): void {
    // Target 4-6 rooms: split 2-3 times deep
    if (depth >= 3 || (depth >= 2 && rng.next() < 0.4)) {
      leaves.push(node);
      return;
    }

    const canSplitH = node.h >= 10;
    const canSplitV = node.w >= 10;

    if (!canSplitH && !canSplitV) {
      leaves.push(node);
      return;
    }

    let horizontal: boolean;
    if (canSplitH && canSplitV) {
      horizontal = rng.next() < 0.5;
    } else {
      horizontal = canSplitH;
    }

    if (horizontal) {
      const splitAt = rng.nextInt(Math.floor(node.h * 0.3), Math.floor(node.h * 0.7));
      node.left = { x: node.x, y: node.y, w: node.w, h: splitAt, left: null, right: null, room: null };
      node.right = { x: node.x, y: node.y + splitAt, w: node.w, h: node.h - splitAt, left: null, right: null, room: null };
    } else {
      const splitAt = rng.nextInt(Math.floor(node.w * 0.3), Math.floor(node.w * 0.7));
      node.left = { x: node.x, y: node.y, w: splitAt, h: node.h, left: null, right: null, room: null };
      node.right = { x: node.x + splitAt, y: node.y, w: node.w - splitAt, h: node.h, left: null, right: null, room: null };
    }

    split(node.left, depth + 1);
    split(node.right, depth + 1);
  }

  split(root, 0);

  // ── 3. Create rooms inside each BSP leaf ─────────────────────────────────
  const rooms: { x: number; y: number; w: number; h: number }[] = [];

  for (const leaf of leaves) {
    const roomW = rng.nextInt(4, Math.min(8, leaf.w - 2));
    const roomH = rng.nextInt(4, Math.min(6, leaf.h - 2));
    const roomX = rng.nextInt(leaf.x + 1, leaf.x + leaf.w - roomW - 1);
    const roomY = rng.nextInt(leaf.y + 1, leaf.y + leaf.h - roomH - 1);

    const room = {
      x: Math.max(1, roomX),
      y: Math.max(1, roomY),
      w: Math.min(roomW, WIDTH - roomX - 1),
      h: Math.min(roomH, HEIGHT - roomY - 1),
    };
    leaf.room = room;
    rooms.push(room);

    // Carve room into tiles
    for (let ry = room.y; ry < room.y + room.h && ry < HEIGHT - 1; ry++) {
      for (let rx = room.x; rx < room.x + room.w && rx < WIDTH - 1; rx++) {
        tiles[ry][rx] = 1;
      }
    }
  }

  // ── 4. Connect rooms with L-shaped corridors ─────────────────────────────
  function roomCenter(r: { x: number; y: number; w: number; h: number }): [number, number] {
    return [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];
  }

  function carveCorridor(x1: number, y1: number, x2: number, y2: number): void {
    // L-shape: go horizontal first, then vertical
    let cx = x1;
    let cy = y1;

    // Horizontal segment
    while (cx !== x2) {
      if (cy >= 0 && cy < HEIGHT && cx >= 0 && cx < WIDTH && tiles[cy][cx] === 0) {
        tiles[cy][cx] = 2;
      }
      cx += cx < x2 ? 1 : -1;
    }

    // Vertical segment
    while (cy !== y2) {
      if (cy >= 0 && cy < HEIGHT && cx >= 0 && cx < WIDTH && tiles[cy][cx] === 0) {
        tiles[cy][cx] = 2;
      }
      cy += cy < y2 ? 1 : -1;
    }

    // Mark the corner/end
    if (cy >= 0 && cy < HEIGHT && cx >= 0 && cx < WIDTH && tiles[cy][cx] === 0) {
      tiles[cy][cx] = 2;
    }
  }

  for (let i = 0; i < rooms.length - 1; i++) {
    const [cx1, cy1] = roomCenter(rooms[i]);
    const [cx2, cy2] = roomCenter(rooms[i + 1]);
    carveCorridor(cx1, cy1, cx2, cy2);
  }

  // ── 5. Choose spawn room (first room) and stairs room (farthest by BFS) ──
  const spawnRoom = rooms[0];
  const [spawnX, spawnY] = roomCenter(spawnRoom);

  // BFS to find distances from spawn
  function bfs(startX: number, startY: number): number[][] {
    const dist: number[][] = [];
    for (let y = 0; y < HEIGHT; y++) {
      dist[y] = new Array(WIDTH).fill(-1);
    }
    dist[startY][startX] = 0;
    const queue: [number, number][] = [[startX, startY]];
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    let head = 0;
    while (head < queue.length) {
      const [qx, qy] = queue[head++];
      for (const [dx, dy] of dirs) {
        const nx = qx + dx;
        const ny = qy + dy;
        if (
          nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT &&
          dist[ny][nx] === -1 &&
          tiles[ny][nx] !== 0
        ) {
          dist[ny][nx] = dist[qy][qx] + 1;
          queue.push([nx, ny]);
        }
      }
    }
    return dist;
  }

  const distFromSpawn = bfs(spawnX, spawnY);

  // Find the room with the farthest center from spawn
  let farthestRoom = rooms[rooms.length - 1];
  let maxDist = 0;
  for (let i = 1; i < rooms.length; i++) {
    const [cx, cy] = roomCenter(rooms[i]);
    const d = distFromSpawn[cy]?.[cx] ?? -1;
    if (d > maxDist) {
      maxDist = d;
      farthestRoom = rooms[i];
    }
  }

  const [stairsX, stairsY] = roomCenter(farthestRoom);

  // Place stairs or boss
  if (isFinalFloor) {
    tiles[stairsY][stairsX] = 5; // boss
  } else {
    tiles[stairsY][stairsX] = 3; // stairs down
  }

  // Place stairs-up at spawn (for going back)
  if (floorNumber > 1) {
    tiles[spawnY][spawnX] = 6; // stairs up
  }

  // ── 6. Place 1-3 item pickups in random rooms ────────────────────────────
  const itemCount = rng.nextInt(1, 3);
  const items: { x: number; y: number; itemId: number }[] = [];

  for (let i = 0; i < itemCount; i++) {
    const room = rooms[rng.nextInt(0, rooms.length - 1)];
    let ix: number, iy: number;
    let attempts = 0;

    // Find a floor tile that is not already occupied
    do {
      ix = rng.nextInt(room.x, room.x + room.w - 1);
      iy = rng.nextInt(room.y, room.y + room.h - 1);
      attempts++;
    } while (attempts < 20 && tiles[iy][ix] !== 1);

    if (tiles[iy][ix] === 1) {
      const itemId = PICKUP_ITEM_IDS[rng.nextInt(0, PICKUP_ITEM_IDS.length - 1)];
      tiles[iy][ix] = 4;
      items.push({ x: ix, y: iy, itemId });
    }
  }

  // ── 7. Validate path from spawn to stairs ────────────────────────────────
  // Already have distFromSpawn; just verify the stairs tile is reachable
  const stairsDist = distFromSpawn[stairsY]?.[stairsX] ?? -1;
  if (stairsDist === -1) {
    // Fallback: carve a direct corridor from spawn to stairs to guarantee connectivity
    carveCorridor(spawnX, spawnY, stairsX, stairsY);
    // Re-place the stairs/boss tile since the corridor may have overwritten it
    tiles[stairsY][stairsX] = isFinalFloor ? 5 : 3;
    if (floorNumber > 1) {
      tiles[spawnY][spawnX] = 6;
    }
  }

  // ── 8. Calculate encounter rate based on dungeon progression ─────────────
  const baseRate = 8; // 8% base
  const floorBonus = floorNumber * 0.5;
  const encounterRate = Math.min(baseRate + floorBonus, 15);

  return {
    width: WIDTH,
    height: HEIGHT,
    tiles,
    rooms,
    spawnX,
    spawnY,
    stairsX,
    stairsY,
    items,
    encounterRate,
  };
}

/**
 * Async version that loads dungeons.json automatically and generates a floor.
 *
 * @param dungeonId - The dungeon's ID (1-8)
 * @param floorNumber - 1-based floor number
 */
export async function generateFloor(
  dungeonId: number,
  floorNumber: number
): Promise<DungeonFloor> {
  const dungeons = await loadDungeons();
  const dungeon = dungeons.find((d) => d.id === dungeonId);
  if (!dungeon) {
    throw new Error(`Dungeon with id ${dungeonId} not found`);
  }
  return generateFloorSync(dungeon, floorNumber);
}
