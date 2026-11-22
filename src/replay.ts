// Move replay (the checker's semantics) and walking path search.
//
// A move string is LURD letters (either case), whitespace ignored; any other
// character makes the answer invalid. A step into a wall, or one pushing a
// box into a wall or another box, is illegal. A replay that ends with every
// box on a goal solves the level. Pushes count the steps that moved a box.

import { DIR_LETTERS, isGoal, isWall, xOf, yOf } from "./level.ts";
import type { Level } from "./level.ts";

export interface ReplayResult {
  legal: boolean;
  solved: boolean;
  pushes: number;
  steps: number;
  /** Index into the moves string of the first illegal/invalid character. */
  illegalAt: number;
}

export function replay(level: Level, moves: string): ReplayResult {
  const boxes = new Set<number>(level.boxes);
  let player = level.player;
  let pushes = 0;
  let steps = 0;
  for (let n = 0; n < moves.length; n++) {
    const ch = moves[n];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") continue;
    const lower = ch.toLowerCase();
    const dir = DIR_LETTERS.indexOf(lower as "u" | "d" | "l" | "r");
    if (dir < 0) {
      return { legal: false, solved: false, pushes, steps, illegalAt: n };
    }
    const dx = dir === 2 ? -1 : dir === 3 ? 1 : 0;
    const dy = dir === 0 ? -1 : dir === 1 ? 1 : 0;
    const px = xOf(player, level.w);
    const py = yOf(player, level.w);
    const tx = px + dx;
    const ty = py + dy;
    if (tx < 0 || tx >= level.w || ty < 0 || ty >= level.h) {
      return { legal: false, solved: false, pushes, steps, illegalAt: n };
    }
    const target = ty * level.w + tx;
    if (isWall(level, target)) {
      return { legal: false, solved: false, pushes, steps, illegalAt: n };
    }
    if (boxes.has(target)) {
      const bx = tx + dx;
      const by = ty + dy;
      if (bx < 0 || bx >= level.w || by < 0 || by >= level.h) {
        return { legal: false, solved: false, pushes, steps, illegalAt: n };
      }
      const beyond = by * level.w + bx;
      if (isWall(level, beyond) || boxes.has(beyond)) {
        return { legal: false, solved: false, pushes, steps, illegalAt: n };
      }
      boxes.delete(target);
      boxes.add(beyond);
      pushes++;
    }
    player = target;
    steps++;
  }
  let solved = true;
  for (const b of boxes) {
    if (!isGoal(level, b)) {
      solved = false;
      break;
    }
  }
  return { legal: true, solved, pushes, steps, illegalAt: -1 };
}

/**
 * Shortest walking path (BFS, fixed neighbour order u/d/l/r) from `from`
 * to `to` over cells that are not walls and not boxes. When `region` is
 * given, only cells marked in it are walkable. Returns the move letters,
 * "" when from === to, or null when unreachable.
 */
export function findWalkPath(
  level: Level,
  boxes: ReadonlySet<number>,
  from: number,
  to: number,
  region?: Uint8Array,
): string | null {
  if (from === to) return "";
  if (isWall(level, to) || boxes.has(to)) return null;
  if (region && region[to] !== 1) return null;
  if (isWall(level, from) || boxes.has(from)) return null;
  const prev = new Int32Array(level.w * level.h).fill(-2);
  const prevDir = new Int8Array(level.w * level.h).fill(-1);
  prev[from] = -1;
  const queue: number[] = [from];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (cur === to) break;
    const cx = xOf(cur, level.w);
    const cy = yOf(cur, level.w);
    for (let d = 0; d < 4; d++) {
      const dx = d === 2 ? -1 : d === 3 ? 1 : 0;
      const dy = d === 0 ? -1 : d === 1 ? 1 : 0;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= level.w || ny < 0 || ny >= level.h) continue;
      const ni = ny * level.w + nx;
      if (prev[ni] !== -2) continue;
      if (isWall(level, ni) || boxes.has(ni)) continue;
      if (region && region[ni] !== 1) continue;
      prev[ni] = cur;
      prevDir[ni] = d;
      queue.push(ni);
    }
  }
  if (prev[to] === -2) return null;
  const letters: string[] = [];
  let cur = to;
  while (cur !== from) {
    letters.push(DIR_LETTERS[prevDir[cur]]);
    cur = prev[cur];
  }
  letters.reverse();
  return letters.join("");
}
