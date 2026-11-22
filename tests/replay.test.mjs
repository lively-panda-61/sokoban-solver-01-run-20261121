// TDD: move replay — the checker's semantics, reimplemented for tests.
// RED phase: src/replay.ts does not exist yet.
import test from "node:test";
import assert from "node:assert/strict";
import { parseLevel } from "../src/level.ts";
import { replay, findWalkPath } from "../src/replay.ts";

const TINY = [
  "#####",
  "# . #",
  "# $ #",
  "# @ #",
  "#####",
].join("\n");

test("a single push up solves the tiny level and counts one push", () => {
  const level = parseLevel(TINY);
  const r = replay(level, "u");
  assert.equal(r.legal, true);
  assert.equal(r.solved, true);
  assert.equal(r.pushes, 1);
  assert.equal(r.steps, 1);
});

test("walking without pushing counts zero pushes and does not solve", () => {
  const level = parseLevel(TINY);
  const r = replay(level, "l");
  assert.equal(r.legal, true);
  assert.equal(r.solved, false);
  assert.equal(r.pushes, 0);
});

test("a step into a wall is illegal", () => {
  const level = parseLevel(TINY);
  const r = replay(level, "d");
  assert.equal(r.legal, false);
  assert.equal(r.illegalAt, 0);
});

test("pushing a box into a wall is illegal", () => {
  const level = parseLevel(TINY);
  // u solves; a second u would push the box (now on the goal at row 1)
  // into the wall at row 0.
  const r = replay(level, "uu");
  assert.equal(r.legal, false);
  assert.equal(r.illegalAt, 1);
});

test("any non-LURD, non-whitespace character makes the answer invalid", () => {
  const level = parseLevel(TINY);
  const r = replay(level, "u x");
  assert.equal(r.legal, false);
  const r2 = replay(level, "U"); // upper case is fine
  assert.equal(r2.legal, true);
  assert.equal(r2.solved, true);
});

test("an empty answer is legal, zero pushes, unsolved", () => {
  const level = parseLevel(TINY);
  const r = replay(level, "");
  assert.equal(r.legal, true);
  assert.equal(r.pushes, 0);
  assert.equal(r.solved, false);
});

test("pushing a box into another box is illegal", () => {
  const text = ["######", "# .  #", "# $  #", "# $  #", "# @  #", "######"].join("\n");
  const level = parseLevel(text);
  // Player at (4,2); 'u' pushes the box at (3,2) into the box at (2,2).
  const r = replay(level, "u");
  assert.equal(r.legal, false);
  assert.equal(r.illegalAt, 0);
});

test("findWalkPath walks around a box without pushing it", () => {
  const level = parseLevel(TINY);
  const boxes = new Set(level.boxes);
  // From the player (3,2) to the cell left of the box (2,1): must go around.
  const path = findWalkPath(level, boxes, level.player, 2 * 5 + 1);
  assert.notEqual(path, null);
  assert.match(path, /^[udlr]+$/);
  // Replaying the walk alone must move zero boxes.
  const r = replay(level, path);
  assert.equal(r.legal, true);
  assert.equal(r.pushes, 0);
});

test("findWalkPath returns null when the target is sealed off by boxes", () => {
  const text = ["#####", "#$  #", "# @ #", "#####"].join("\n");
  const level = parseLevel(text);
  const boxes = new Set(level.boxes);
  // Target (1,1) is the box itself: unreachable as a walk destination.
  assert.equal(findWalkPath(level, boxes, level.player, 1 * 5 + 1), null);
});
