// XSB level parsing for the Sokoban solver.
//
// XSB alphabet: '#' wall, ' ' floor, '.' goal, '$' box, '*' box on a goal,
// '@' player, '+' player on a goal. Cells are indexed row-major (y*w+x).
// Direction order is fixed everywhere: 0=up, 1=down, 2=left, 3=right.

export interface Level {
  w: number;
  h: number;
  walls: Uint8Array; // 1 = wall
  goalSet: Uint8Array; // 1 = goal
  goals: number[]; // sorted cell indices
  boxes: number[]; // sorted cell indices
  player: number; // cell index
}

export const DIR_LETTERS = ["u", "d", "l", "r"] as const;

/** Cell deltas for directions [up, down, left, right] on a board of width w. */
export function dirDeltas(w: number): [number, number, number, number] {
  return [-w, w, -1, 1];
}

export function xOf(i: number, w: number): number {
  return i % w;
}

export function yOf(i: number, w: number): number {
  return Math.floor(i / w);
}

export function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

export function isWall(level: Level, i: number): boolean {
  return level.walls[i] === 1;
}

export function isGoal(level: Level, i: number): boolean {
  return level.goalSet[i] === 1;
}

/** Parse XSB text into a Level. Ragged rows are padded with walls. */
export function parseLevel(text: string): Level {
  const rawLines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  while (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }
  if (rawLines.length === 0) throw new Error("level: empty input");
  const w = Math.max(...rawLines.map((line) => line.length));
  const h = rawLines.length;
  const walls = new Uint8Array(w * h);
  const goalSet = new Uint8Array(w * h);
  const goals: number[] = [];
  const boxes: number[] = [];
  let player = -1;
  for (let y = 0; y < h; y++) {
    const line = rawLines[y];
    for (let x = 0; x < w; x++) {
      const ch = x < line.length ? line[x] : "#";
      const i = y * w + x;
      switch (ch) {
        case "#":
          walls[i] = 1;
          break;
        case " ":
          break;
        case ".":
          goalSet[i] = 1;
          goals.push(i);
          break;
        case "$":
          boxes.push(i);
          break;
        case "*":
          goalSet[i] = 1;
          goals.push(i);
          boxes.push(i);
          break;
        case "@":
          if (player >= 0) throw new Error("level: more than one player");
          player = i;
          break;
        case "+":
          if (player >= 0) throw new Error("level: more than one player");
          player = i;
          goalSet[i] = 1;
          goals.push(i);
          break;
        default:
          throw new Error(`level: unknown character ${JSON.stringify(ch)} at ${x},${y}`);
      }
    }
  }
  if (player < 0) throw new Error("level: no player (@) in level");
  boxes.sort((a, b) => a - b);
  goals.sort((a, b) => a - b);
  return { w, h, walls, goalSet, goals, boxes, player };
}
