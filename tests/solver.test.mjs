// TDD: the solver must reach the manifest's push-optimal counts.
// RED phase: src/solve.ts does not exist yet.
import test from "node:test";
import assert from "node:assert/strict";
import { parseLevel } from "../src/level.ts";
import { replay } from "../src/replay.ts";
import { solveLevel } from "../src/solve.ts";
import { loadPractice, MANIFEST } from "./helpers.mjs";

for (const id of ["i001", "i002", "i003", "i004", "i005"]) {
  test(`${id}: solved in exactly P* = ${MANIFEST[id].pushes} pushes`, () => {
    const level = parseLevel(loadPractice(id));
    const result = solveLevel(level);
    const check = replay(level, result.moves);
    assert.equal(check.legal, true, `${id}: solution is illegal`);
    assert.equal(check.solved, true, `${id}: solution does not solve`);
    assert.equal(
      check.pushes,
      MANIFEST[id].pushes,
      `${id}: pushes ${check.pushes} != P* ${MANIFEST[id].pushes}`,
    );
    assert.equal(result.pushes, MANIFEST[id].pushes);
    assert.ok(result.moves.length <= 65536, "solution.txt size cap");
  });
}

test("per-room optima match the manifest's room counts", async () => {
  const { solveRoom } = await import("../src/search.ts");
  const { detectRooms } = await import("../src/rooms.ts");
  for (const id of ["i001", "i002", "i003", "i004", "i005"]) {
    const level = parseLevel(loadPractice(id));
    const found = detectRooms(level);
    assert.notEqual(found, null);
    const got = [];
    for (const room of found.rooms) {
      const sol = solveRoom(level, {
        room,
        hallway: found.hallway,
        boxes: [...room.boxes],
        playerStart: room.entryCell,
        exitRequired: false,
        nodeCap: 2_000_000,
      });
      assert.notEqual(sol, null, `${id}: room unsolved`);
      got.push(sol.pushes);
    }
    assert.deepEqual(
      got.sort((a, b) => a - b),
      [...MANIFEST[id].rooms].sort((a, b) => a - b),
      `${id}: room optima`,
    );
  }
});

test("solving twice yields byte-identical moves (determinism)", () => {
  const level = parseLevel(loadPractice("i003"));
  const a = solveLevel(level);
  const b = solveLevel(level);
  assert.equal(a.moves, b.moves);
});

test("an unsolvable level still returns a well-formed (empty) answer", () => {
  // A box sealed in a corner can never reach its goal.
  const text = ["#####", "#$ .#", "#   #", "#  @#", "#####"].join("\n");
  const level = parseLevel(text);
  const result = solveLevel(level);
  assert.match(result.moves, /^[udlr]*$/);
  const check = replay(level, result.moves);
  assert.equal(check.legal, true);
});
