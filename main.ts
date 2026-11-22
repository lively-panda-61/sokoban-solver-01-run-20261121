// Sokoban solver entrypoint.
//
// Run by the grader as `node /bot/main.ts`: reads every instance under
// /input/<id>/level.txt and writes /output/<id>/solution.txt (creating the
// directory). The input/output locations come from the harness's mount
// variables (MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR): in the grader's
// container they are /input and /output; on the process driver they name
// the host directories. CLI arguments override them for local runs.
// Locally: `node main.ts [inputDir] [outputDir]`, or
// `MAKEFUN_INPUT_DIR=<in> MAKEFUN_OUTPUT_DIR=<out> node main.ts`.
// Deterministic by construction: no wall clock, no randomness; the only
// budget is a node-expansion cap. A failing instance still gets a
// well-formed (empty) answer file, never a crash.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseLevel } from "./src/level.ts";
import { solveLevel } from "./src/solve.ts";

const inputDir =
  process.argv[2] ?? process.env.MAKEFUN_INPUT_DIR ?? "/input";
const outputDir =
  process.argv[3] ?? process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

function main(): void {
  let ids: string[];
  try {
    ids = readdirSync(inputDir)
      .filter((name) => {
        try {
          return existsSync(join(inputDir, name, "level.txt"));
        } catch {
          return false;
        }
      })
      .sort();
  } catch (err) {
    console.log(`[solver] cannot read input dir ${inputDir}: ${err}`);
    process.exitCode = 1;
    return;
  }
  if (ids.length === 0) {
    console.log(`[solver] no instances found under ${inputDir}`);
    return;
  }
  for (const id of ids) {
    const outDir = join(outputDir, id);
    let moves = "";
    try {
      const level = parseLevel(readFileSync(join(inputDir, id, "level.txt"), "utf8"));
      const result = solveLevel(level);
      moves = result.moves;
      console.log(
        `[${id}] ${result.pushes} pushes, ${moves.length} moves, ` +
          `${result.expansions} expansions, rooms: ` +
          result.perRoom.map((r) => `${r.boxes}b/${r.pushes}p`).join(", "),
      );
    } catch (err) {
      console.log(`[${id}] ERROR: ${err} — writing an empty solution`);
      moves = "";
    }
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "solution.txt"), moves, "utf8");
  }
  console.log(`[solver] answered ${ids.length} instance(s) under ${outputDir}`);
}

main();
