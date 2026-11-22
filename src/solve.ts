// Level orchestration: decompose into rooms, solve each push-optimally,
// and stitch the room solutions together with hallway walks.
//
// Rooms are independent (boxes never leave their room), so the level's
// push count is the sum of the rooms'. A room whose unconstrained optimum
// ends with the player trapped inside must be solved last (or with its
// exit-constrained optimum): the last room is the one where exiting costs
// the most pushes, which minimises the total. Every other room uses its
// exit-constrained optimum so the player can walk on to the next room.

import { replay } from "./replay.ts";
import { findWalkPath } from "./replay.ts";
import { detectRooms } from "./rooms.ts";
import { solveRoom } from "./search.ts";
import type { Level } from "./level.ts";
import type { Room } from "./rooms.ts";
import type { RoomSolution } from "./search.ts";

export interface LevelSolution {
  moves: string;
  pushes: number;
  perRoom: { boxes: number; pushes: number; expansions: number }[];
  expansions: number;
}

export interface SolveOptions {
  nodeCapPerRoom?: number;
}

const DEFAULT_NODE_CAP = 2_000_000;

/** Distance along the hallway from the player start to a room's entry. */
function hallwayDistance(
  level: Level,
  hallway: Uint8Array,
  from: number,
  to: number,
): number {
  const path = findWalkPath(level, new Set<number>(), from, to, hallway);
  return path === null ? Infinity : path.length;
}

export function solveLevel(level: Level, opts: SolveOptions = {}): LevelSolution {
  const nodeCap = opts.nodeCapPerRoom ?? DEFAULT_NODE_CAP;
  const empty: LevelSolution = { moves: "", pushes: 0, perRoom: [], expansions: 0 };
  const found = detectRooms(level);
  if (found === null) {
    // No decomposition: one push search over the whole board.
    const wholeRoom: Room = {
      cells: (() => {
        const cells = new Uint8Array(level.w * level.h);
        for (let i = 0; i < cells.length; i++) cells[i] = 1;
        return cells;
      })(),
      door: -1,
      entryCell: level.player,
      boxes: [...level.boxes],
      goals: [...level.goals],
    };
    const hallway = new Uint8Array(level.w * level.h);
    const sol = solveRoom(level, {
      room: wholeRoom,
      hallway,
      boxes: [...level.boxes],
      playerStart: level.player,
      exitRequired: false,
      nodeCap,
    });
    if (sol === null) return empty;
    const check = replay(level, sol.moves);
    if (!check.legal || !check.solved) return empty;
    return {
      moves: sol.moves,
      pushes: check.pushes,
      perRoom: [{ boxes: level.boxes.length, pushes: sol.pushes, expansions: sol.expansions }],
      expansions: sol.expansions,
    };
  }

  const { rooms, hallway } = found;
  // Per room: unconstrained optimum (a) and exit-constrained optimum (b).
  // (b) is only searched when (a) ends with the player trapped inside.
  interface RoomPlan {
    room: Room;
    a: RoomSolution;
    b: RoomSolution;
  }
  const plans: RoomPlan[] = [];
  let expansions = 0;
  for (const room of rooms) {
    const a = solveRoom(level, {
      room,
      hallway,
      boxes: [...room.boxes],
      playerStart: room.entryCell,
      exitRequired: false,
      nodeCap,
    });
    if (a === null) return empty;
    expansions += a.expansions;
    let b = a;
    // Can the player walk out after (a)? Flood over the region with the
    // solved boxes as obstacles; reaching any hallway cell means exit.
    const solvedBoxes = new Set<number>(a.endBoxes);
    const exitPath = findWalkPath(
      level,
      solvedBoxes,
      a.endPlayer,
      room.entryCell,
      undefined,
    );
    // Reaching the entry cell is enough: it is a hallway cell.
    if (exitPath === null) {
      const bSol = solveRoom(level, {
        room,
        hallway,
        boxes: [...room.boxes],
        playerStart: room.entryCell,
        exitRequired: true,
        nodeCap,
      });
      if (bSol === null) return empty;
      expansions += bSol.expansions;
      b = bSol;
    }
    plans.push({ room, a, b });
  }
  // Last room: the one where exiting costs the most (b - a), so the total
  // sum of b's plus a single a is minimal.
  let lastIdx = 0;
  for (let i = 1; i < plans.length; i++) {
    const cost = plans[i].b.pushes - plans[i].a.pushes;
    const best = plans[lastIdx].b.pushes - plans[lastIdx].a.pushes;
    if (cost > best) lastIdx = i;
  }
  // Order the other rooms by hallway distance from the player start.
  const order = plans
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i !== lastIdx)
    .sort(
      (x, y) =>
        hallwayDistance(level, hallway, level.player, x.p.room.entryCell) -
        hallwayDistance(level, hallway, level.player, y.p.room.entryCell),
    )
    .map(({ p }) => p);
  order.push(plans[lastIdx]);

  // Stitch: walk to each room's entry, then append its solution.
  const allBoxes = new Set<number>(level.boxes);
  let player = level.player;
  let moves = "";
  const perRoom: LevelSolution["perRoom"] = [];
  for (const plan of order) {
    const sol = plan === plans[lastIdx] ? plan.a : plan.b;
    const walk = findWalkPath(level, allBoxes, player, plan.room.entryCell);
    if (walk === null) return empty;
    moves += walk + sol.moves;
    // Update box positions: the room's boxes move to their solved cells.
    for (const b of plan.room.boxes) allBoxes.delete(b);
    for (const b of sol.endBoxes) allBoxes.add(b);
    player = sol.endPlayer;
    perRoom.push({
      boxes: plan.room.boxes.length,
      pushes: sol.pushes,
      expansions: sol.expansions,
    });
  }
  const check = replay(level, moves);
  if (!check.legal || !check.solved) return empty;
  return { moves, pushes: check.pushes, perRoom, expansions };
}
