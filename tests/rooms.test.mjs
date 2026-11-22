// TDD: room / door decomposition of a level.
// RED phase: src/rooms.ts does not exist yet.
import test from "node:test";
import assert from "node:assert/strict";
import { parseLevel } from "../src/level.ts";
import { detectRooms } from "../src/rooms.ts";
import { loadPractice, MANIFEST } from "./helpers.mjs";

for (const id of ["i001", "i002", "i003", "i004", "i005"]) {
  test(`${id}: rooms detected with the manifest's box counts`, () => {
    const level = parseLevel(loadPractice(id));
    const found = detectRooms(level);
    assert.notEqual(found, null, `${id}: decomposition failed`);
    const want = MANIFEST[id];
    assert.equal(found.rooms.length, want.rooms.length, `${id}: room count`);
    // Box counts per room come from the level itself: i001 has 3 boxes in
    // its single room; every later room holds 4.
    const boxCounts = found.rooms
      .map((r) => r.boxes.length)
      .sort((a, b) => a - b);
    const expectedBoxCounts =
      id === "i001" ? [3] : Array(want.rooms.length).fill(4);
    assert.deepEqual(boxCounts, expectedBoxCounts, `${id}: boxes per room`);
    // Every room holds as many goals as boxes, and together the rooms
    // cover every box and every goal of the level.
    for (const room of found.rooms) {
      assert.equal(room.goals.length, room.boxes.length);
      assert.ok(room.door >= 0, "door cell set");
      assert.ok(room.entryCell >= 0, "entry cell set");
    }
    const allBoxes = found.rooms.flatMap((r) => r.boxes).sort((a, b) => a - b);
    assert.deepEqual(allBoxes, [...level.boxes].sort((a, b) => a - b));
    const allGoals = found.rooms.flatMap((r) => r.goals).sort((a, b) => a - b);
    assert.deepEqual(allGoals, [...level.goals].sort((a, b) => a - b));
    // The hallway holds the player start.
    assert.equal(found.hallway[level.player], 1);
  });
}

test("a single open room with no hallway door still decomposes", () => {
  const text = ["#######", "# . . #", "# $ $ #", "#  @  #", "#######"].join("\n");
  const level = parseLevel(text);
  // No articulation door exists here (one open space); the detector must
  // not crash and must either return null or a single room covering all.
  const found = detectRooms(level);
  if (found !== null) {
    assert.equal(found.rooms.length, 1);
    assert.equal(found.rooms[0].boxes.length, 2);
  }
});
