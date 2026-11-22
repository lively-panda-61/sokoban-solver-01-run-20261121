// Push-based A* solver for one room.
//
// State = (sorted box cells, player cell). The player position is
// canonicalised to the smallest cell of its reachable region, so states
// that differ only by where the player stands inside one open area
// collapse into one. Cost is pushes; the heuristic is the minimum
// Manhattan assignment of boxes to goals (admissible: one push moves one
// box by one cell), so the first goal state popped is push-optimal.
// Boxes are never pushed out of the room: the generator guarantees a box
// that leaves through the door can never return, so such pushes are
// doomed branches. The search is fully deterministic: tie-breaks use a
// monotone sequence number, and the only budget is a node cap, never the
// wall clock.

import { computeDeadSquares, hasDeadlock } from "./deadlock.ts";
import { DIR_LETTERS, isGoal, isWall, xOf, yOf } from "./level.ts";
import type { Level } from "./level.ts";
import type { Room } from "./rooms.ts";

export interface RoomSolution {
  pushes: number;
  moves: string;
  expansions: number;
  endPlayer: number;
  endBoxes: number[];
}

export interface SolveRoomOptions {
  room: Room;
  hallway: Uint8Array;
  boxes: number[];
  playerStart: number;
  exitRequired: boolean;
  nodeCap: number;
}

interface Flood {
  reached: Uint8Array;
  prev: Int32Array;
  prevDir: Int8Array;
}

interface Node {
  boxes: number[];
  player: number;
  g: number;
  f: number;
  h: number;
  seq: number;
  parent: Node | null;
  segment: string;
}

const DIRS = [
  { dx: 0, dy: -1, letter: "u" },
  { dx: 0, dy: 1, letter: "d" },
  { dx: -1, dy: 0, letter: "l" },
  { dx: 1, dy: 0, letter: "r" },
];

function floodFill(
  level: Level,
  region: Uint8Array,
  boxSet: ReadonlySet<number>,
  from: number,
): Flood {
  const n = level.w * level.h;
  const reached = new Uint8Array(n);
  const prev = new Int32Array(n).fill(-2);
  const prevDir = new Int8Array(n).fill(-1);
  reached[from] = 1;
  prev[from] = -1;
  const queue = [from];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const cx = xOf(cur, level.w);
    const cy = yOf(cur, level.w);
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d].dx;
      const ny = cy + DIRS[d].dy;
      if (nx < 0 || nx >= level.w || ny < 0 || ny >= level.h) continue;
      const ni = ny * level.w + nx;
      if (reached[ni] === 1) continue;
      if (region[ni] !== 1 || isWall(level, ni) || boxSet.has(ni)) continue;
      reached[ni] = 1;
      prev[ni] = cur;
      prevDir[ni] = d;
      queue.push(ni);
    }
  }
  return { reached, prev, prevDir };
}

function walkPath(flood: Flood, from: number, to: number): string {
  if (from === to) return "";
  const letters: string[] = [];
  let cur = to;
  while (cur !== from) {
    letters.push(DIR_LETTERS[flood.prevDir[cur]]);
    cur = flood.prev[cur];
  }
  letters.reverse();
  return letters.join("");
}

/** All permutations of [0..k-1], computed once per k. */
function permutations(k: number): number[][] {
  const out: number[][] = [];
  const arr = Array.from({ length: k }, (_, i) => i);
  const rec = (n: number) => {
    if (n === 1) {
      out.push([...arr]);
      return;
    }
    for (let i = 0; i < n; i++) {
      rec(n - 1);
      const j = n % 2 === 1 ? 0 : i;
      [arr[j], arr[n - 1]] = [arr[n - 1], arr[j]];
    }
  };
  rec(k);
  return out;
}

class Heap {
  private items: Node[] = [];
  get size(): number {
    return this.items.length;
  }
  push(node: Node): void {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (compare(items[i], items[p]) >= 0) break;
      [items[i], items[p]] = [items[p], items[i]];
      i = p;
    }
  }
  pop(): Node | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop() as Node;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && compare(items[l], items[m]) < 0) m = l;
        if (r < items.length && compare(items[r], items[m]) < 0) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m], items[i]];
        i = m;
      }
    }
    return top;
  }
}

function compare(a: Node, b: Node): number {
  if (a.f !== b.f) return a.f - b.f;
  if (a.h !== b.h) return a.h - b.h;
  return a.seq - b.seq;
}

export function solveRoom(level: Level, opts: SolveRoomOptions): RoomSolution | null {
  const { room, hallway, playerStart, exitRequired, nodeCap } = opts;
  const goals = [...room.goals].sort((a, b) => a - b);
  const startBoxes = [...opts.boxes].sort((a, b) => a - b);
  if (startBoxes.length === 0) {
    return { pushes: 0, moves: "", expansions: 0, endPlayer: playerStart, endBoxes: [] };
  }
  // Walkable region: the room plus the hallway (never another room).
  const region = new Uint8Array(level.w * level.h);
  for (let i = 0; i < region.length; i++) {
    region[i] = room.cells[i] === 1 || hallway[i] === 1 ? 1 : 0;
  }
  const dead = computeDeadSquares(level, region);
  if (hasDeadlock(level, startBoxes, dead)) return null;

  const perms = permutations(goals.length);
  const hCache = new Map<string, number>();
  const heuristic = (boxes: number[]): number => {
    const key = boxes.join(",");
    const cached = hCache.get(key);
    if (cached !== undefined) return cached;
    let best = Infinity;
    for (const perm of perms) {
      let sum = 0;
      for (let i = 0; i < boxes.length; i++) {
        const g = goals[perm[i]];
        sum += Math.abs(xOf(boxes[i], level.w) - xOf(g, level.w)) +
          Math.abs(yOf(boxes[i], level.w) - yOf(g, level.w));
      }
      if (sum < best) best = sum;
    }
    hCache.set(key, best);
    return best;
  };

  const canonicalPlayer = (boxes: number[], player: number): number => {
    const boxSet = new Set<number>(boxes);
    const flood = floodFill(level, region, boxSet, player);
    let min = player;
    for (let i = 0; i < flood.reached.length; i++) {
      if (flood.reached[i] === 1 && i < min) min = i;
    }
    return min;
  };

  const isSolved = (boxes: number[]): boolean =>
    boxes.every((b) => isGoal(level, b));

  const canExit = (boxes: number[], player: number): boolean => {
    const boxSet = new Set<number>(boxes);
    const flood = floodFill(level, region, boxSet, player);
    for (let i = 0; i < flood.reached.length; i++) {
      if (flood.reached[i] === 1 && hallway[i] === 1) return true;
    }
    return false;
  };

  let seq = 0;
  const open = new Heap();
  const closed = new Map<string, number>();
  const startH = heuristic(startBoxes);
  open.push({
    boxes: startBoxes,
    player: playerStart,
    g: 0,
    f: startH,
    h: startH,
    seq: seq++,
    parent: null,
    segment: "",
  });
  let expansions = 0;
  while (open.size > 0) {
    const node = open.pop() as Node;
    const canon = canonicalPlayer(node.boxes, node.player);
    const key = `${node.boxes.join(",")}|${canon}`;
    const bestG = closed.get(key);
    if (bestG !== undefined && bestG <= node.g) continue;
    closed.set(key, node.g);
    expansions++;
    if (expansions > nodeCap) return null;
    if (isSolved(node.boxes)) {
      if (!exitRequired || canExit(node.boxes, node.player)) {
        const segments: string[] = [];
        let cur: Node | null = node;
        while (cur && cur.parent) {
          segments.push(cur.segment);
          cur = cur.parent;
        }
        segments.reverse();
        return {
          pushes: node.g,
          moves: segments.join(""),
          expansions,
          endPlayer: node.player,
          endBoxes: [...node.boxes],
        };
      }
      // Solved but the player is trapped inside: fall through and expand.
      // Repositioning may need a box pushed off a goal and back on, so a
      // solved state is not a dead end for the exit-constrained search.
    }
    const boxSet = new Set<number>(node.boxes);
    const flood = floodFill(level, region, boxSet, node.player);
    for (let bi = 0; bi < node.boxes.length; bi++) {
      const b = node.boxes[bi];
      const bx = xOf(b, level.w);
      const by = yOf(b, level.w);
      for (let d = 0; d < 4; d++) {
        const dx = DIRS[d].dx;
        const dy = DIRS[d].dy;
        const destX = bx + dx;
        const destY = by + dy;
        const fromX = bx - dx;
        const fromY = by - dy;
        if (destX < 0 || destX >= level.w || destY < 0 || destY >= level.h) continue;
        if (fromX < 0 || fromX >= level.w || fromY < 0 || fromY >= level.h) continue;
        const dest = destY * level.w + destX;
        const from = fromY * level.w + fromX;
        if (room.cells[dest] !== 1) continue; // never push a box out of the room
        if (isWall(level, dest) || boxSet.has(dest)) continue;
        if (flood.reached[from] !== 1) continue;
        const nextBoxes = [...node.boxes];
        nextBoxes[bi] = dest;
        nextBoxes.sort((a, b) => a - b);
        if (hasDeadlock(level, nextBoxes, dead)) continue;
        const h = heuristic(nextBoxes);
        const g = node.g + 1;
        const segment = walkPath(flood, node.player, from) + DIRS[d].letter;
        open.push({
          boxes: nextBoxes,
          player: b,
          g,
          f: g + h,
          h,
          seq: seq++,
          parent: node,
          segment,
        });
      }
    }
  }
  return null;
}
