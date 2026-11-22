// TDD: XSB level parsing.
// RED phase: src/level.ts does not exist yet.
import test from "node:test";
import assert from "node:assert/strict";
import { parseLevel, isGoal, isWall } from "../src/level.ts";
import { loadPractice } from "./helpers.mjs";

test("parse i001: dimensions, walls, boxes, goals, player", () => {
  const level = parseLevel(loadPractice("i001"));
  assert.equal(level.w, 8);
  assert.equal(level.h, 10);
  // Boxes at (3,3), (5,3), (7,4) -> indices 3*8+3=27, 5*8+3=43, 7*8+4=60.
  assert.deepEqual([...level.boxes].sort((a, b) => a - b), [27, 43, 60]);
  // Goals at (2,1), (2,2), (5,4) -> 17, 18, 44.
  assert.deepEqual([...level.goals].sort((a, b) => a - b), [17, 18, 44]);
  // Player at (8,6) -> 70.
  assert.equal(level.player, 70);
  assert.equal(isWall(level, 0), true); // top-left corner
  assert.equal(isWall(level, 70), false);
  assert.equal(isGoal(level, 17), true);
  assert.equal(isGoal(level, 27), false);
});

test("parse i005: 16 boxes, 16 goals, player in the hallway", () => {
  const level = parseLevel(loadPractice("i005"));
  assert.equal(level.w, 15);
  assert.equal(level.h, 17);
  assert.equal(level.boxes.length, 16);
  assert.equal(level.goals.length, 16);
  assert.equal(level.player, 8 * 15 + 9); // row 8, col 9
});

test("XSB extras: '*' is box on goal, '+' is player on goal", () => {
  const text = ["#####", "#*+ #", "#   #", "#####"].join("\n");
  const level = parseLevel(text);
  assert.equal(level.w, 5);
  assert.equal(level.h, 4);
  // '*' at (1,1) -> 6: a box and a goal.
  assert.deepEqual([...level.boxes], [6]);
  // Both '*' and '+' sit on goals.
  assert.deepEqual([...level.goals].sort((a, b) => a - b), [6, 7]);
  // '+' at (1,2) -> 7: player standing on a goal.
  assert.equal(level.player, 7);
  assert.equal(isGoal(level, 7), true);
});

test("ragged rows are padded with walls to the widest row", () => {
  const level = parseLevel("####\n# @\n######\n#  #");
  assert.equal(level.w, 6);
  assert.equal(level.h, 4);
  assert.equal(isWall(level, 1 * 6 + 4), true); // padded cell
  assert.equal(level.player, 1 * 6 + 2);
});

test("a level with no player throws", () => {
  assert.throws(() => parseLevel("#####\n#   #\n#####"), /player/);
});

test("a level with no boxes is parsed (zero-box edge case)", () => {
  const level = parseLevel("#####\n# @ #\n#####");
  assert.deepEqual([...level.boxes], []);
  assert.deepEqual([...level.goals], []);
});
