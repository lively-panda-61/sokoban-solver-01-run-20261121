// Room / door decomposition.
//
// The generator lays a 1-wide hallway (the player starts in it) with one
// to four rooms off it, each opening through a single door cell. A box
// pushed out of its room can never return, so each room is an independent
// push problem and the level's push-optimum is the sum of the rooms'.
//
// Detection uses articulation points only: removing a door cell splits the
// free space into a player-side component and a room-side component. A
// candidate counts as a room when its side (including the door cell
// itself) holds 3 or 4 boxes and exactly as many goals. Minimal candidates
// win over larger ones that merely contain them (e.g. a hallway cell whose
// far side holds several rooms). The rooms must partition every box and
// every goal, or detection fails and the caller falls back.

import { isGoal, isWall, xOf, yOf } from "./level.ts";
import type { Level } from "./level.ts";

export interface Room {
  /** Room cells, door cell included (1 = in this room). */
  cells: Uint8Array;
  /** The door cell (room side of the opening). */
  door: number;
  /** The hallway cell adjacent to the door (player enters from here). */
  entryCell: number;
  boxes: number[];
  goals: number[];
}

export interface Decomposition {
  rooms: Room[];
  /** Free cells in no room, in the component holding the player start. */
  hallway: Uint8Array;
}

const DIRS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** Connected components of the free cells, with `blocked` removed. */
function components(level: Level, blocked: number): number[][] {
  const n = level.w * level.h;
  const seen = new Uint8Array(n);
  if (blocked >= 0) seen[blocked] = 1;
  const out: number[][] = [];
  for (let start = 0; start < n; start++) {
    if (isWall(level, start) || seen[start] === 1) continue;
    const comp: number[] = [];
    const queue = [start];
    seen[start] = 1;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      comp.push(cur);
      const cx = xOf(cur, level.w);
      const cy = yOf(cur, level.w);
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= level.w || ny < 0 || ny >= level.h) continue;
        const ni = ny * level.w + nx;
        if (isWall(level, ni) || seen[ni] === 1) continue;
        seen[ni] = 1;
        queue.push(ni);
      }
    }
    out.push(comp);
  }
  return out;
}

export function detectRooms(level: Level): Decomposition | null {
  const n = level.w * level.h;
  const free: number[] = [];
  for (let i = 0; i < n; i++) if (!isWall(level, i)) free.push(i);

  interface Candidate {
    door: number;
    side: number[]; // room-side component (door cell excluded)
    boxes: number[];
    goals: number[];
  }
  const candidates: Candidate[] = [];
  for (const c of free) {
    if (c === level.player) continue;
    const comps = components(level, c);
    const playerComp = comps.find((comp) => comp.includes(level.player));
    if (!playerComp) continue;
    for (const comp of comps) {
      if (comp === playerComp) continue;
      const boxes = comp.filter((i) => level.boxes.includes(i));
      if (level.boxes.includes(c)) boxes.push(c);
      if (boxes.length === 0) continue;
      const goals = comp.filter((i) => isGoal(level, i));
      if (isGoal(level, c)) goals.push(c);
      if (boxes.length >= 3 && boxes.length <= 4 && goals.length === boxes.length) {
        candidates.push({ door: c, side: comp, boxes, goals });
      }
    }
  }
  // Minimal first: a true door's side is the room alone; a hallway cell's
  // far side also holds other rooms and is larger.
  candidates.sort((a, b) => a.side.length - b.side.length);
  const rooms: Room[] = [];
  const usedCells = new Uint8Array(n);
  const usedBoxes = new Set<number>();
  for (const cand of candidates) {
    if (cand.boxes.some((b) => usedBoxes.has(b))) continue;
    if (cand.side.some((i) => usedCells[i] === 1)) continue;
    if (usedCells[cand.door] === 1) continue;
    const cells = new Uint8Array(n);
    for (const i of cand.side) {
      cells[i] = 1;
      usedCells[i] = 1;
    }
    cells[cand.door] = 1;
    usedCells[cand.door] = 1;
    for (const b of cand.boxes) usedBoxes.add(b);
    // Entry cell: a free neighbour of the door that is not a room cell.
    let entryCell = -1;
    const dx = xOf(cand.door, level.w);
    const dy = yOf(cand.door, level.w);
    for (const [ox, oy] of DIRS) {
      const nx = dx + ox;
      const ny = dy + oy;
      if (nx < 0 || nx >= level.w || ny < 0 || ny >= level.h) continue;
      const ni = ny * level.w + nx;
      if (isWall(level, ni) || cells[ni] === 1) continue;
      entryCell = ni;
      break;
    }
    if (entryCell < 0) continue;
    rooms.push({
      cells,
      door: cand.door,
      entryCell,
      boxes: [...cand.boxes].sort((a, b) => a - b),
      goals: [...cand.goals].sort((a, b) => a - b),
    });
  }
  // Validation: the rooms must partition every box and every goal.
  if (rooms.length === 0) return null;
  if (usedBoxes.size !== level.boxes.length) return null;
  const goalCount = rooms.reduce((sum, r) => sum + r.goals.length, 0);
  if (goalCount !== level.goals.length) return null;
  // Hallway: the free cells in no room, in the player's component.
  const hallway = new Uint8Array(n);
  const rest = components(level, -1).find((comp) =>
    comp.includes(level.player),
  );
  if (!rest) return null;
  for (const i of rest) {
    if (usedCells[i] === 0) hallway[i] = 1;
  }
  if (hallway[level.player] !== 1) return null;
  return { rooms, hallway };
}
