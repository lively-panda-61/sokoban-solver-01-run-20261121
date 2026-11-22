// Deadlock detection for the push search.
//
// Two sound prunes (they only flag states that can never reach a solution):
//  1. Static dead squares: a free non-goal cell from which no goal is
//     reachable by pushes, ignoring other boxes (reverse reachability).
//  2. Frozen 2x2 blocks: a 2x2 square fully occupied by walls/boxes in
//     which a box that is not on a goal sits can never move again.

import { isGoal, isWall, xOf, yOf } from "./level.ts";
import type { Level } from "./level.ts";

/**
 * Boolean array over cells: true = a box here can never reach a goal.
 * Computed by reverse push-reachability from the goals, ignoring other
 * boxes: a cell c is live when some push from c lands on a live cell and
 * the player can stand on the opposite side (a free cell). Restricted to
 * `region` when given.
 */
export function computeDeadSquares(level: Level, region?: Uint8Array): boolean[] {
  const n = level.w * level.h;
  const live = new Uint8Array(n);
  const inRegion = (i: number): boolean => !region || region[i] === 1;
  const free = (i: number): boolean =>
    !isWall(level, i) && inRegion(i);
  for (const g of level.goals) live[g] = 1;
  // Worklist over live cells; a neighbour c becomes live when it can be
  // pushed onto a live cell with the player standing opposite.
  const stack: number[] = [...level.goals];
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    const cx = xOf(cur, level.w);
    const cy = yOf(cur, level.w);
    for (const [dx, dy] of dirs) {
      // Box at (cx - dx, cy - dy) pushed in direction (dx, dy) lands on cur.
      const bx = cx - dx;
      const by = cy - dy;
      const px = cx - 2 * dx;
      const py = cy - 2 * dy;
      if (bx < 0 || bx >= level.w || by < 0 || by >= level.h) continue;
      if (px < 0 || px >= level.w || py < 0 || py >= level.h) continue;
      const bi = by * level.w + bx;
      const pi = py * level.w + px;
      if (live[bi] === 1) continue;
      if (!free(bi)) continue;
      if (!free(pi)) continue;
      live[bi] = 1;
      stack.push(bi);
    }
  }
  const dead: boolean[] = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (free(i) && !isGoal(level, i) && live[i] === 0) dead[i] = true;
  }
  return dead;
}

/** True when the box configuration is certainly unsolvable. */
export function hasDeadlock(
  level: Level,
  boxes: readonly number[],
  dead?: boolean[],
): boolean {
  const deadSquares = dead ?? computeDeadSquares(level);
  const boxSet = new Set<number>(boxes);
  for (const b of boxes) {
    if (deadSquares[b]) return true;
  }
  // Frozen 2x2: every cell a wall or a box, holding a box off-goal.
  for (let y = 0; y + 1 < level.h; y++) {
    for (let x = 0; x + 1 < level.w; x++) {
      const cells = [
        y * level.w + x,
        y * level.w + x + 1,
        (y + 1) * level.w + x,
        (y + 1) * level.w + x + 1,
      ];
      let filled = true;
      let stuckBox = false;
      for (const c of cells) {
        if (isWall(level, c)) continue;
        if (boxSet.has(c)) {
          if (!isGoal(level, c)) stuckBox = true;
          continue;
        }
        filled = false;
        break;
      }
      if (filled && stuckBox) return true;
    }
  }
  return false;
}
