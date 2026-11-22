// TDD: deadlock detection (static dead squares + frozen 2x2 blocks).
// RED phase: src/deadlock.ts does not exist yet.
import test from "node:test";
import assert from "node:assert/strict";
import { parseLevel } from "../src/level.ts";
import { computeDeadSquares, hasDeadlock } from "../src/deadlock.ts";
import { loadPractice } from "./helpers.mjs";

test("a corner cell that is not a goal is dead", () => {
  const text = ["#####", "# . #", "# $ #", "#  @#", "#####"].join("\n");
  const level = parseLevel(text);
  const dead = computeDeadSquares(level);
  // Top-left interior corner (1,1) -> 6, and top-right (1,3) -> 8 are dead:
  // a box there can only be pushed along a wall the player cannot stand
  // behind (the wall itself is in the way).
  assert.equal(dead[6], true);
  assert.equal(dead[8], true);
  // The box at (2,2) -> 12 sits on a live cell (one push up onto the goal).
  assert.equal(dead[12], false);
});

test("a goal cell is never dead", () => {
  const text = ["#####", "#.  #", "# $ #", "#  @#", "#####"].join("\n");
  const level = parseLevel(text);
  const dead = computeDeadSquares(level);
  assert.equal(dead[6], false); // goal at (1,1)
});

test("a box in a corner is a deadlock", () => {
  const text = ["#####", "#$  #", "#   #", "#  @#", "#####"].join("\n");
  const level = parseLevel(text);
  assert.equal(hasDeadlock(level, [...level.boxes]), true);
});

test("a box on a live cell is not a deadlock", () => {
  const text = ["#####", "# . #", "# $ #", "# @ #", "#####"].join("\n");
  const level = parseLevel(text);
  assert.equal(hasDeadlock(level, [...level.boxes]), false);
});

test("a frozen 2x2 block of boxes against a wall is a deadlock", () => {
  const text = ["######", "# $$ #", "# $$ #", "#  @ #", "######"].join("\n");
  const level = parseLevel(text);
  // The four boxes form a 2x2 block; none can ever move.
  assert.equal(hasDeadlock(level, [...level.boxes]), true);
});

test("a 2x2 block where every box sits on a goal is not a deadlock", () => {
  const text = ["######", "# ** #", "# ** #", "#  @ #", "######"].join("\n");
  const level = parseLevel(text);
  assert.equal(hasDeadlock(level, [...level.boxes]), false);
});

test("practice levels: no box starts on a dead square", () => {
  // The generator only keeps solvable rooms, so the initial position of
  // every practice level must be deadlock-free.
  for (const id of ["i001", "i002", "i003", "i004", "i005"]) {
    const level = parseLevel(loadPractice(id));
    assert.equal(
      hasDeadlock(level, [...level.boxes]),
      false,
      `${id} starts deadlocked`,
    );
  }
});
